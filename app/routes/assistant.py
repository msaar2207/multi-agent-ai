import asyncio
from datetime import datetime
import json
# import os # No longer needed after removing local file management
# import uuid # No longer needed after removing local file management
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Form, UploadFile
from typing import List
from fastapi.responses import StreamingResponse
from fastapi.encoders import jsonable_encoder
from bson import ObjectId

from app.schemas.assistant import QueryInput, AssistantUpdate # Import AssistantUpdate
from app.services.organization import OpenAIOrganizationService
from app.utils.auth import get_current_user
from app.db import db
from app.config import settings
from app.utils.title import generate_chat_title
from app.utils.logger import logger
from app.utils.footnote import extract_footnotes
from app.utils.quota import enforce_quota_and_update
from app.utils.tokenizer import count_tokens
from openai import OpenAI # Import OpenAI
import openai # Added import openai

router = APIRouter(prefix="/assistant", tags=["assistant"])
# UPLOAD_DIR = "uploads" # No longer needed

# Initialize OpenAI client
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

OPENAI_HEADERS = {
    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
    "OpenAI-Beta": "assistants=v2",
    "Content-Type": "application/json"
}

@router.post("/stream")
async def stream_answer(query: QueryInput, user=Depends(get_current_user)):
    # user is a tuple: (user_id, role, email)
    current_user_id_str = user[0]
    user_email = user[2]
    logger.info(f"📥 Received stream request from user: {user_email} (ID: {current_user_id_str}), chat_id: {query.chat_id}")
    logger.info(f"🔍 User question: {query.question}")

    # 1. User and Agent Identification
    user_doc = await db.users.find_one({"_id": ObjectId(current_user_id_str)})
    if not user_doc:
        logger.error(f"User not found in DB: {current_user_id_str}")
        raise HTTPException(status_code=403, detail="User not found.")

    organization_id = user_doc.get("organization_id")
    agent_id_in_user = user_doc.get("agent_id")
    if organization_id:
    # if not organization_id:
    #     logger.warning(f"User {current_user_id_str} does not belong to an organization.")
    #     raise HTTPException(status_code=403, detail="User not associated with an organization.")

        if not agent_id_in_user:
            logger.warning(f"User {current_user_id_str} in org {organization_id} is not assigned an agent.")
            raise HTTPException(status_code=403, detail="User not assigned an agent.")

        logger.info(f"User {current_user_id_str} belongs to org {organization_id} and is assigned agent {agent_id_in_user}")

        # 2. Fetch Agent's OpenAI Assistant Details
        # agent_id_in_user is the MongoDB ObjectId of the assistant document
        assistant_doc = await db.assistants.find_one({"_id": ObjectId(agent_id_in_user)})
        if not assistant_doc:
            logger.error(f"Assistant document not found for agent_id: {agent_id_in_user} (user: {current_user_id_str})")
            raise HTTPException(status_code=404, detail="Assigned agent details not found.")

        openai_assistant_id = assistant_doc.get("openai_assistant_id")
        if not openai_assistant_id:
            logger.error(f"OpenAI assistant ID not found in assistant document: {agent_id_in_user} (user: {current_user_id_str})")
            raise HTTPException(status_code=500, detail="Configuration error: OpenAI assistant ID missing for the assigned agent.")

        logger.info(f"Using OpenAI Assistant ID: {openai_assistant_id} for user {current_user_id_str} (agent_id: {agent_id_in_user})")

        estimated_token_count = count_tokens(query.question)
        # Assuming enforce_quota_and_update uses string user_id
        await enforce_quota_and_update(user_id=current_user_id_str, tokens_used=estimated_token_count)

        # Fetch chat and ensure thread exists
        chat = await db.chats.find_one({"_id": ObjectId(query.chat_id), "user_id": ObjectId(current_user_id_str)})
        if not chat:
            logger.warning(f"Chat not found for chat_id: {query.chat_id} and user_id: {current_user_id_str}")
            raise HTTPException(status_code=404, detail="Chat not found")

        # Generate title if needed
        if chat.get("title") in ["New Chat", "Untitled", ""]:
            title = generate_chat_title(query.question)
            await db.chats.update_one({"_id": ObjectId(query.chat_id)}, {"$set": {"title": title}})
            logger.info(f"✏️ Chat title updated for chat_id {query.chat_id}: {title}")

        # Load or create thread
        thread_id = chat.get("thread_id")
        if not thread_id:
            async with httpx.AsyncClient(timeout=30.0) as client: # Added client for thread creation
                thread_resp = await client.post(
                    "https://api.openai.com/v1/threads",
                    headers=OPENAI_HEADERS,
                    json={}
                )
                thread_resp.raise_for_status()
                thread_id = thread_resp.json()["id"]
            await db.chats.update_one(
                {"_id": ObjectId(query.chat_id)},
                {"$set": {"thread_id": thread_id}}
            )
            logger.info(f"🧵 New thread created and saved for chat {query.chat_id}: {thread_id}")
        else:
            logger.info(f"♻️ Reusing existing thread for chat {query.chat_id}: {thread_id}")

        # Pass openai_assistant_id to the stream generator
        stream_generator = openai_stream(thread_id, query.question, openai_assistant_id, current_user_id_str, query.chat_id)
        return StreamingResponse(stream_generator, media_type="text/event-stream")
    
    else:
        user_id = current_user_id_str
        estimated_token_count = count_tokens(query.question)
        await enforce_quota_and_update(user_id=str(user_id), tokens_used=estimated_token_count)

        chat = await db.chats.find_one({"_id": ObjectId(query.chat_id), "user_id": ObjectId(user_id)})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        if chat.get("title") in ["New Chat", "Untitled", ""]:
            title = generate_chat_title(query.question)
            await db.chats.update_one({"_id": ObjectId(query.chat_id)}, {"$set": {"title": title}})
            logger.info(f"✏️ Chat title updated: {title}")

        thread_id = chat.get("thread_id")
        client = httpx.AsyncClient(timeout=60.0)

        if not thread_id:
            thread_resp = await client.post(
                "https://api.openai.com/v1/threads",
                headers=OPENAI_HEADERS,
                json={}
            )
            if thread_resp.status_code != 200:
                raise Exception(f"Failed to create thread: {thread_resp.text}")
            thread_data = thread_resp.json()
            thread_id = thread_data.get("id")
            if not thread_id:
                raise Exception(f"Thread creation failed. Missing ID: {thread_data}")
            await db.chats.update_one(
                {"_id": ObjectId(query.chat_id)},
                {"$set": {"thread_id": thread_id}}
            )
            logger.info(f"🧵 New thread created and saved: {thread_id}")
        else:
            logger.info(f"♻️ Reusing existing thread: {thread_id}")

        async def openai_stream():
            try:
                # Add user message
                msg_resp = await client.post(
                    f"https://api.openai.com/v1/threads/{thread_id}/messages",
                    headers=OPENAI_HEADERS,
                    json={"role": "user", "content": query.question}
                )
                if msg_resp.status_code != 200:
                    raise Exception(f"Failed to add user message: {msg_resp.text}")
                logger.info(f"📨 User message added to thread")

                # Run assistant
                config = await db.assistants.find_one({"_id": "default_assistant"})
                assistant_id = config["assistant_id"]

                run_resp = await client.post(
                    f"https://api.openai.com/v1/threads/{thread_id}/runs",
                    headers=OPENAI_HEADERS,
                    json={"assistant_id": assistant_id}
                )
                if run_resp.status_code != 200:
                    raise Exception(f"Failed to start run: {run_resp.text}")
                run_data = run_resp.json()
                run_id = run_data.get("id")
                if not run_id:
                    raise Exception(f"Run creation failed. Missing ID: {run_data}")
                logger.info(f"🏃 Assistant run started: {run_id}")

                # Wait for run to complete
                while True:
                    status_resp = await client.get(
                        f"https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}",
                        headers=OPENAI_HEADERS
                    )
                    status_data = status_resp.json()
                    status = status_data.get("status")
                    logger.info(f"⏳ Run status: {status}")
                    if status in ["completed", "failed", "cancelled"]:
                        break
                    await asyncio.sleep(1)

                if status != "completed":
                    raise Exception(f"Run did not complete successfully: {status}")

                # Fetch assistant message
                msg_resp = await client.get(
                    f"https://api.openai.com/v1/threads/{thread_id}/messages",
                    headers=OPENAI_HEADERS
                )
                messages = msg_resp.json()["data"]
                latest_assistant_reply = None
                for msg in messages:
                    if msg["role"] == "assistant" and msg.get("run_id") == run_id:
                        latest_assistant_reply = msg["content"][0]["text"]["value"].strip()
                        logger.info("✅ Assistant response retrieved.")
                        break
                if not latest_assistant_reply:
                    logger.warning("⚠️ Assistant reply not found for current run.")
                    latest_assistant_reply = "Sorry, no response was received from the assistant."

                # Stream each token
                for chunk in latest_assistant_reply.split():
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                    await asyncio.sleep(0.01)

                # Post-processing
                footnotes = await extract_footnotes(latest_assistant_reply)
                total_tokens_used = count_tokens(latest_assistant_reply) + count_tokens(query.question)
                await enforce_quota_and_update(user_id=str(user_id), tokens_used=total_tokens_used)

                await db.chats.update_one(
                    {"_id": ObjectId(query.chat_id)},
                    {"$push": {
                        "messages": {
                            "role": "assistant",
                            "content": latest_assistant_reply,
                            "footnotes": footnotes,
                            "createdAt": datetime.utcnow()
                        }
                    }}
                )
                logger.info(f"✅ Response saved. Tokens: {total_tokens_used}, Footnotes: {len(footnotes)}")

                yield f"data: {json.dumps({'type': 'done'})}\n\n"

            except Exception as e:
                logger.exception("❌ Error during OpenAI assistant response")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        return StreamingResponse(openai_stream(), media_type="text/event-stream")


async def openai_stream(thread_id: str, question: str, assistant_id_to_use: str, user_id_str: str, chat_id_str: str):
    try:
        client = httpx.AsyncClient(timeout=60.0)

        # Add user message to thread
        await client.post(
            f"https://api.openai.com/v1/threads/{thread_id}/messages",
            headers=OPENAI_HEADERS,
            json={"role": "user", "content": question}
        )
        logger.info(f"📨 User message added to thread {thread_id} by user {user_id_str}")

        # Run assistant using the dynamically fetched assistant_id_to_use
        run_resp = await client.post(
            f"https://api.openai.com/v1/threads/{thread_id}/runs",
            headers=OPENAI_HEADERS,
            json={"assistant_id": assistant_id_to_use}
        )
        run_resp.raise_for_status()
        run_id = run_resp.json()["id"]
        logger.info(f"🏃 Assistant run started: {run_id} on thread {thread_id} with assistant {assistant_id_to_use} for user {user_id_str}")

        # Wait for run to finish
        status = None  # Initialize status
        run_status_data = None # Initialize to store full run status response
        while True:
            run_status_resp = await client.get(
                f"https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}",
                headers=OPENAI_HEADERS
            )
            run_status_resp.raise_for_status() # Check for HTTP errors during polling
            run_status_data = run_status_resp.json()
            status = run_status_data["status"]
            logger.info(f"⏳ Run status for run {run_id}: {status}")
            # More comprehensive list of terminal or action-required states
            if status in ["completed", "failed", "cancelled", "expired", "requires_action"]:
                break
            await asyncio.sleep(1) # Wait before polling again

        # Check status after the loop
        if status != "completed":
            error_message_detail = "No specific error message from OpenAI."
            last_error = run_status_data.get("last_error") if run_status_data else None
            if last_error:
                error_code = last_error.get('code')
                error_message = last_error.get('message')
                error_message_detail = f"OpenAI Error Code: {error_code}, Message: {error_message}"

            full_error_log = f"Run {run_id} for thread {thread_id} (user {user_id_str}) did not complete. Final status: {status}. Details: {error_message_detail}"
            logger.error(full_error_log)
            # Include run_status_data in exception for more context if needed, but keep message clean for client
            raise Exception(f"Assistant run failed or was cancelled. Status: {status}. {error_message_detail}")

        # Retrieve assistant's reply from the current run ONLY if status is "completed"
        msg_resp = await client.get(
            f"https://api.openai.com/v1/threads/{thread_id}/messages",
            headers=OPENAI_HEADERS,
            params={"run_id": run_id, "order": "desc", "limit": 10} # More specific query
        )
        msg_resp.raise_for_status()
        messages_data = msg_resp.json()
        messages = messages_data["data"]

        latest_assistant_reply = None
        references = []
        # Iterate through messages to find the one from the assistant for this run
        # Messages are typically ordered newest first by API default, but run_id helps ensure correctness.
        for msg in messages:
            if msg["role"] == "assistant" and msg.get("run_id") == run_id:
                if (
                    msg.get("content")
                    and len(msg["content"]) > 0
                    and "text" in msg["content"][0]
                    and "value" in msg["content"][0]["text"]
                ):
                    text_block = msg["content"][0]["text"]
                    latest_assistant_reply = text_block["value"].strip()
                    for ann in text_block.get("annotations", []):
                        if ann.get("type") == "file_citation":
                            fid = ann["file_citation"].get("file_id", "")
                            quote = ann["file_citation"].get("quote", "")
                            doc = await db.documents.find_one({"openai_file_id": fid})
                            fname = doc.get("filename", fid) if doc else fid
                            page_no = 1
                            base_name = fname
                            if "_chunk_" in fname:
                                base_name, rest = fname.split("_chunk_", 1)
                                try:
                                    page_no = int(rest.split(".")[0]) + 1
                                except Exception:
                                    page_no = 1
                            snippet = quote[:20]
                            references.append(f"({base_name}, {page_no}, {snippet}...)")
                    logger.info(f"✅ Assistant response retrieved for run {run_id}.")
                    break

        if not latest_assistant_reply:
            logger.warning(f"⚠️ Assistant reply not found for completed run {run_id} in thread {thread_id}.")
            # This could happen if the run completed but produced no message, or message format is unexpected
            latest_assistant_reply = "Sorry, the assistant completed the request but did not provide a textual response."

        # Stream response
        for chunk in latest_assistant_reply.split():  # Consider more robust chunking if needed
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            await asyncio.sleep(0.01)  # Small delay for streaming effect

        if references:
            yield f"data: {json.dumps({'type': 'references', 'content': references})}\n\n"

        # Post-process and save to DB
        footnotes = await extract_footnotes(latest_assistant_reply) # This should be fine
        # Calculate tokens for the assistant's reply only
        output_tokens_charged = count_tokens(latest_assistant_reply)
        await enforce_quota_and_update(user_id=user_id_str, tokens_used=output_tokens_charged)

        await db.chats.update_one(
            {"_id": ObjectId(chat_id_str)},
            {"$push": {
                "messages": {
                    "role": "assistant",
                    "content": latest_assistant_reply,
                    "footnotes": footnotes,
                    "references": references,
                    "createdAt": datetime.utcnow()
                }
            }}
        )
        input_tokens_previously_charged = count_tokens(question)
        logger.info(f"✅ Response saved. Output Tokens charged this step: {output_tokens_charged}. Input Tokens (estimated & charged earlier): {input_tokens_previously_charged}. Footnotes: {len(footnotes)}")

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        logger.exception("❌ Error during OpenAI assistant response")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

@router.get("/details")
async def get_all_assistants(user=Depends(get_current_user)):
    try:
        assistants_cursor = db.assistants.find()
        assistants_list = await assistants_cursor.to_list(length=100)

        processed_assistants = []
        for assistant in assistants_list:
            if "_id" in assistant and isinstance(assistant["_id"], ObjectId):
                assistant["_id"] = str(assistant["_id"])
            if "org_id" in assistant and isinstance(assistant["org_id"], ObjectId):
                assistant["org_id"] = str(assistant["org_id"])
            if "created_by" in assistant and isinstance(assistant["created_by"], ObjectId):
                assistant["created_by"] = str(assistant["created_by"])
            # Ensure other potential ObjectId fields are handled by jsonable_encoder or explicitly if needed
            processed_assistants.append(assistant)

        return jsonable_encoder(processed_assistants)
    except Exception as e:
        logger.error(f"❌ Failed to fetch all assistants: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve assistants")
    
@router.get("/{org_id}/assistants")
async def list_assistants(org_id: str, current_user=Depends(get_current_user)):
    user_id_from_token = current_user[0]
    logger.info(f"User {user_id_from_token} attempting to list assistants for org {org_id}.")

    # Authorization Check
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        logger.warning(f"User {user_id_from_token} not found in database during list assistants for org {org_id}.")
        raise HTTPException(status_code=404, detail="User not found.")

    user_role = user_doc.get("role")
    user_org_id_str = str(user_doc.get("organization_id"))

    if user_role == "admin":
        logger.info(f"Admin user {user_id_from_token} authorized to list assistants for org {org_id}.")
        pass # Admin is authorized
    elif user_role == "organization_head":
        if user_org_id_str == org_id:
            logger.info(f"Organization head {user_id_from_token} authorized to list assistants for org {org_id}.")
            pass # Organization head is authorized for their own organization
        else:
            logger.warning(f"Organization head {user_id_from_token} (org: {user_org_id_str}) attempted to list assistants for unauthorized org {org_id}.")
            raise HTTPException(status_code=403, detail="Organization head not authorized for this organization.")
    else:
        logger.warning(f"User {user_id_from_token} with role '{user_role}' attempted to list assistants for org {org_id}. Forbidden.")
        raise HTTPException(status_code=403, detail="User not authorized to list assistants for this organization.")

    # If authorization passed, continue
    try:
        assistants_list = await db["assistants"].find({"org_id": ObjectId(org_id)}).to_list(length=100)
    except Exception as e:
        logger.error(f"Error converting org_id '{org_id}' to ObjectId: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid organization ID format: {org_id}")

    processed_assistants = []
    for a in assistants_list:
        if "_id" in a and isinstance(a["_id"], ObjectId):
            a["_id"] = str(a["_id"])
        if "org_id" in a and isinstance(a["org_id"], ObjectId):
            a["org_id"] = str(a["org_id"])
        if "created_by" in a and isinstance(a["created_by"], ObjectId):
            a["created_by"] = str(a["created_by"])
        processed_assistants.append(a)
    return jsonable_encoder(processed_assistants)

@router.post("/{org_id}/assistants/create")
async def create_assistant(org_id: str,
                           name: str = Form(...),
                           instructions: str = Form(...),
                           file_ids: List[str] = Form(None), # Changed to None for optional
                           current_user=Depends(get_current_user)):
    user_id_from_token = current_user[0]
    logger.info(f"Received request to create assistant: {name} for org: {org_id} by user: {user_id_from_token}")
    logger.info(f"File IDs provided: {file_ids}")

    # Authorization Check
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        logger.warning(f"User {user_id_from_token} not found in database during assistant creation for org {org_id}.")
        raise HTTPException(status_code=404, detail="User not found.")

    user_role = user_doc.get("role")
    user_org_id_str = str(user_doc.get("organization_id")) # Get user's org_id from DB

    if user_role == "admin":
        logger.info(f"Admin user {user_id_from_token} authorized to create assistant for org {org_id}.")
        pass # Admin is authorized
    elif user_role == "organization_head":
        if user_org_id_str == org_id:
            logger.info(f"Organization head {user_id_from_token} authorized for org {org_id}.")
            pass # Organization head is authorized for their own organization
        else:
            logger.warning(f"Organization head {user_id_from_token} (org: {user_org_id_str}) attempted to create assistant for unauthorized org {org_id}.")
            raise HTTPException(status_code=403, detail="Organization head not authorized for this organization.")
    else:
        logger.warning(f"User {user_id_from_token} with role '{user_role}' attempted to create assistant for org {org_id}. Forbidden.")
        raise HTTPException(status_code=403, detail="User not authorized to create assistants.")

    # If authorization passed, continue with assistant creation logic
    openai_assistant_id = None
    vector_store_id = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            assistant_payload = {
                "name": name,
                "instructions": instructions,
                "model": "gpt-4o", # Or make this configurable
            }

            if file_ids:
                # Create a vector store
                vector_store_response = await client.post(
                    "https://api.openai.com/v1/vector_stores",
                    headers=OPENAI_HEADERS,
                    json={
                        "file_ids": file_ids,
                        "name": f"Vector store for {name}"
                    }
                )
                vector_store_response.raise_for_status()
                vector_store_id = vector_store_response.json()["id"]
                logger.info(f"Vector store created: {vector_store_id} with files: {file_ids}")

                assistant_payload["tool_resources"] = {"file_search": {"vector_store_ids": [vector_store_id]}}
                assistant_payload["tools"] = [{"type": "file_search"}]


            # Create the assistant
            response = await client.post(
                "https://api.openai.com/v1/assistants",
                headers=OPENAI_HEADERS,
                json=assistant_payload
            )
            response.raise_for_status()  # Raise an exception for HTTP error codes
            openai_assistant_data = response.json()
            openai_assistant_id = openai_assistant_data["id"]
            logger.info(f"OpenAI Assistant created successfully: {openai_assistant_id}")

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
            # Attempt to delete vector store if assistant creation failed
            if vector_store_id:
                try:
                    logger.info(f"Attempting to delete vector store {vector_store_id} due to assistant creation failure.")
                    await client.delete(f"https://api.openai.com/v1/vector_stores/{vector_store_id}", headers=OPENAI_HEADERS)
                    logger.info(f"Successfully deleted vector store {vector_store_id}.")
                except httpx.HTTPStatusError as ve:
                    logger.error(f"Failed to delete vector store {vector_store_id}: {ve.response.status_code} - {ve.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to create OpenAI assistant: {e.response.text}")
        except Exception as e:
            logger.error(f"An unexpected error occurred: {str(e)}")
            if vector_store_id: # Also attempt to cleanup vector store on other errors
                try:
                    logger.info(f"Attempting to delete vector store {vector_store_id} due to an unexpected error.")
                    await client.delete(f"https://api.openai.com/v1/vector_stores/{vector_store_id}", headers=OPENAI_HEADERS)
                    logger.info(f"Successfully deleted vector store {vector_store_id}.")
                except httpx.HTTPStatusError as ve:
                    logger.error(f"Failed to delete vector store {vector_store_id}: {ve.response.status_code} - {ve.response.text}")
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

    assistant_doc = {
        "name": name,
        "org_id": ObjectId(org_id), # Ensure org_id is stored as ObjectId
        "openai_assistant_id": openai_assistant_id,
        "created_by": user_id_from_token, # This is current_user[0]
        "instructions": instructions,
        "file_ids": file_ids if file_ids else [],
        "vector_store_id": vector_store_id,
        "created_at": datetime.utcnow(),
    }
    # Also ensure created_by is stored as ObjectId if it's a user ID string
    assistant_doc["created_by"] = ObjectId(user_id_from_token)

    result = await db["assistants"].insert_one(assistant_doc)
    assistant_mongo_id = result.inserted_id
    logger.info(f"Assistant document saved to DB with ID: {assistant_mongo_id}")

    try:
        document_mongo_ids = []
        if file_ids: # file_ids are OpenAI file IDs from the request
            logger.info(f"Processing file_ids {file_ids} for assistant {assistant_mongo_id}")
            for openai_file_id in file_ids:
                # Query the documents collection
                # Ensure org_id is ObjectId for the query if it's stored as such in 'documents'
                # Based on 'org_upload_file_to_openai', 'organization_id' in 'documents' is stored as string.
                # However, the 'create_assistant' function receives org_id as string and converts to ObjectId for assistant_doc.
                # Let's assume 'documents.organization_id' is stored as string.
                document = await db.documents.find_one({
                    "openai_file_id": openai_file_id,
                    "organization_id": org_id # org_id is a string here from the path parameter
                })
                if document:
                    document_mongo_ids.append(str(document["_id"]))
                    logger.info(f"Found document mongo_id {document['_id']} for openai_file_id {openai_file_id} in org {org_id}")
                else:
                    logger.warning(f"Document not found for openai_file_id {openai_file_id} and org_id {org_id}")

        new_agent_entry = {
            "assistant_id": str(assistant_mongo_id), # Storing MongoDB _id of the assistant
            "documents": document_mongo_ids # Storing MongoDB _ids of linked documents
        }

        # Update the organizations collection
        update_org_result = await db.organizations.update_one(
            {"_id": ObjectId(org_id)}, # Query by ObjectId of the organization
            {"$push": {"agents": new_agent_entry}}
        )

        if update_org_result.modified_count == 1:
            logger.info(f"Successfully added agent entry to organization {org_id} for assistant {assistant_mongo_id}")
        else:
            # This could happen if the org_id is valid but no document was found, or if $push somehow failed without error.
            logger.error(f"Failed to update organization {org_id} with new agent entry for assistant {assistant_mongo_id}. Modified count: {update_org_result.modified_count}")
            # Depending on strictness, you might raise an HTTPException here or just log the error.
            # For now, logging as error. If the organization document must exist, this is a problem.

    except Exception as e:
        logger.error(f"Error processing file_ids or updating organization for assistant {assistant_mongo_id}: {e}")
        # Potentially re-raise or handle if this failure should prevent successful assistant creation response
        # For now, logging the error and proceeding to return the assistant details.
        # Consider if the main assistant creation should be rolled back or flagged if this part fails.

    # Prepare response_doc after all DB operations related to linking are attempted.
    response_doc = assistant_doc.copy() # assistant_doc is the original document inserted
    response_doc["_id"] = str(assistant_mongo_id) # Use the retrieved ID

    # Explicitly convert ObjectId fields to strings for the response
    if "org_id" in response_doc and isinstance(response_doc["org_id"], ObjectId):
        response_doc["org_id"] = str(response_doc["org_id"])

    if "created_by" in response_doc and isinstance(response_doc["created_by"], ObjectId):
        response_doc["created_by"] = str(response_doc["created_by"])

    logger.info(f"Assistant creation process complete for {assistant_mongo_id}. Response doc prepared with string ObjectIds.")

    # Return the complete assistant document, including the MongoDB _id and openai_assistant_id
    return jsonable_encoder(response_doc)

# Removed local file upload endpoint: POST /{org_id}/assistants/upload
# async def upload_file(org_id: str, file: UploadFile = File(...), current_user=Depends(get_current_user)):
#     org_dir = os.path.join(UPLOAD_DIR, org_id)
#     os.makedirs(org_dir, exist_ok=True)
#
#     filename = f"{uuid.uuid4()}_{file.filename}"
#     file_path = os.path.join(org_dir, filename)
#
#     with open(file_path, "wb") as f:
#         f.write(await file.read())
#
#     return {"filename": filename, "path": f"{org_id}/{filename}"}

# Removed local file listing endpoint: GET /{org_id}/assistants/list
# async def list_files(org_id: str, current_user=Depends(get_current_user)):
#     org_dir = os.path.join(UPLOAD_DIR, org_id)
#     if not os.path.exists(org_dir):
#         return []
#
#     return [{"filename": f} for f in os.listdir(org_dir)]

@router.post("/upload-and-create")
async def upload_and_create_assistant(
    org_id: str,
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    user_id = current_user[0] # Extract user_id
    file_ids = await OpenAIOrganizationService.process_and_store_file_for_org(org_id, file, user_id) # Pass user_id

    return {"file_ids": file_ids}


@router.post("/{org_id}/files/upload")
async def org_upload_file_to_openai(org_id: str, files: List[UploadFile] = File(...), current_user=Depends(get_current_user)):
    user_id = current_user[0]
    results = []

    # 1. Authorization (applies to the whole batch)
    user_info = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_info:
        raise HTTPException(status_code=403, detail="User not found.")

    if user_info.get("role") != "organization_head" and str(user_info.get("organization_id")) != org_id:
        logger.warning(f"User {user_id} with role {user_info.get('role')} and org {user_info.get('organization_id')} "
                       f"attempted to upload to org {org_id} without sufficient privileges.")
        raise HTTPException(status_code=403, detail="User not authorized to upload files for this organization.")

    for file in files:
        logger.info(f"User {user_id} authorized. Proceeding with file upload: {file.filename} for org: {org_id}")
        openai_file_id = None
        try:
            # 2. OpenAI Upload using SDK
            file_content = await file.read()
            # IMPORTANT: After reading, reset the file pointer if the file object needs to be read again by the framework
            # or another part of the code. For simple UploadFile from FastAPI, this might not be strictly necessary
            # if it's only read once here. However, if there were issues or retries, it would be.
            # await file.seek(0) # Not strictly needed if read once and then passed as bytes.

            logger.info(f"Attempting SDK upload for {file.filename} to OpenAI...")
            # Pass file content as bytes directly to avoid issues with file pointers in async threads
            openai_response = await asyncio.to_thread(
                openai_client.files.create,
                file=(file.filename, file_content, file.content_type), # Pass as tuple
                purpose="assistants"
            )
            openai_file_id = openai_response.id
            logger.info(f"SDK File uploaded to OpenAI successfully: {openai_file_id}, filename: {file.filename}")

            # Verify file upload (optional, but good for ensuring status)
            # file_details = await asyncio.to_thread(openai_client.files.retrieve, openai_file_id)
            # logger.info(f"File verification from OpenAI: ID={file_details.id}, Status={file_details.status}")

            # 3. Database Storage
            document_to_store = {
                "filename": file.filename,
                "openai_file_id": openai_file_id,
                "organization_id": org_id, # Store as ObjectId
                "uploaded_by_user_id": user_id, # Store as ObjectId
                "uploaded_at": datetime.utcnow(),
                "storage_type": "organization_openai",
                "purpose": "assistants"
            }
            result = await db["documents"].insert_one(document_to_store)
            # Prepare a serializable version for the results list
            stored_doc_response = document_to_store.copy()
            stored_doc_response["_id"] = str(result.inserted_id)
            stored_doc_response["organization_id"] = org_id # Return as string
            stored_doc_response["uploaded_by_user_id"] = user_id # Return as string
            logger.info(f"File metadata stored in DB for {file.filename}, doc_id: {result.inserted_id}, openai_file_id: {openai_file_id}")

            # New logic to add file to assistant vector stores
            if openai_file_id: # Ensure we have an OpenAI file ID
                logger.info(f"Attempting to add OpenAI file {openai_file_id} to vector stores for organization {org_id}")
                try:
                    assistants_cursor = db.assistants.find({"org_id": ObjectId(org_id)})
                    async for assistant in assistants_cursor:
                        assistant_id_str = str(assistant["_id"])
                        assistant_vector_store_id = assistant.get("vector_store_id")
                        if assistant_vector_store_id:
                            logger.info(f"Processing assistant {assistant_id_str} with vector store {assistant_vector_store_id}")
                            try:
                                await asyncio.to_thread(
                                    openai_client.beta.vector_stores.files.create,
                                    vector_store_id=assistant_vector_store_id,
                                    file_id=openai_file_id
                                )
                                logger.info(f"Successfully added file {openai_file_id} to vector store {assistant_vector_store_id} for assistant {assistant_id_str}")
                                # Update the assistant document to include the new file_id
                                await db.assistants.update_one(
                                    {"_id": assistant["_id"]},
                                    {"$addToSet": {"file_ids": openai_file_id}}
                                )
                                logger.info(f"Successfully updated assistant {assistant_id_str} document with new file_id {openai_file_id}")
                            except openai.APIError as oe: # More specific error type for OpenAI calls
                                # Handle cases like file already in vector store (error code: 'vector_store_file_already_exists')
                                if hasattr(oe, 'code') and oe.code == 'vector_store_file_already_exists':
                                    logger.info(f"File {openai_file_id} already exists in vector store {assistant_vector_store_id} for assistant {assistant_id_str}. Adding to DB.")
                                    # Even if it's already in the VS, ensure it's in our DB representation of the assistant's files
                                    await db.assistants.update_one(
                                        {"_id": assistant["_id"]},
                                        {"$addToSet": {"file_ids": openai_file_id}}
                                    )
                                    logger.info(f"Ensured file_id {openai_file_id} is in assistant {assistant_id_str} document.")
                                else:
                                    logger.error(f"OpenAI APIError adding file {openai_file_id} to vector store {assistant_vector_store_id} for assistant {assistant_id_str}: {str(oe)}")
                                    # Do not re-raise, allow overall file upload to succeed.
                            except Exception as e_vs:
                                logger.error(f"Failed to add file {openai_file_id} to vector store {assistant_vector_store_id} for assistant {assistant_id_str}: {str(e_vs)}")
                                # Do not re-raise, log and continue.
                        else:
                            logger.info(f"Assistant {assistant_id_str} does not have a vector_store_id. Skipping.")
                except Exception as e_outer_vs:
                    logger.error(f"Error during vector store update process for org {org_id}, file {openai_file_id}: {str(e_outer_vs)}")
                    # This error means the loop for assistants might have failed, but the primary file upload succeeded.

            results.append({"status": "success", "file_info": jsonable_encoder(stored_doc_response)})

        except openai.APIError as e:
            logger.error(f"OpenAI SDK APIError during file upload for {file.filename}: {type(e).__name__} - {str(e)}")
            results.append({"status": "error", "filename": file.filename, "detail": f"OpenAI SDK Error: {str(e)}"})
        except Exception as e:
            logger.error(f"Unexpected error during SDK file upload for {file.filename}: {type(e).__name__} - {str(e)}")
            logger.error(f"Unexpected SDK upload error details: Exception Type: {type(e)}, Exception Args: {e.args}")
            results.append({"status": "error", "filename": file.filename, "detail": f"An unexpected error occurred: {str(e)}"})
            # If openai_file_id was obtained before a subsequent error (e.g., DB error), attempt cleanup.
            if openai_file_id:
                logger.info(f"Attempting to delete orphaned OpenAI file {openai_file_id} due to error for {file.filename}.")
                try:
                    await asyncio.to_thread(openai_client.files.delete, openai_file_id)
                    logger.info(f"Successfully deleted orphaned OpenAI file {openai_file_id}.")
                except Exception as cleanup_e:
                    logger.critical(f"CRITICAL: Failed to delete orphaned OpenAI file {openai_file_id} after error for {file.filename}. Cleanup Exception: {repr(cleanup_e)}")
                    results[-1]["detail"] += f" CRITICAL: Failed to clean up OpenAI file {openai_file_id}."

    return results

@router.get("/{org_id}/files")
async def list_organization_files(org_id: str, current_user=Depends(get_current_user)):
    user_id = current_user[0] # Changed to current_user[0]

    # 1. Authorization (similar to file upload)
    user_info = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_info:
        raise HTTPException(status_code=403, detail="User not found.")

    if user_info.get("role") != "organization_head" or str(user_info.get("organization_id")) != org_id:
        logger.warning(f"User {user_id} with role {user_info.get('role')} and org {user_info.get('organization_id')} "
                       f"attempted to list files for org {org_id} without sufficient privileges.")
        raise HTTPException(status_code=403, detail="User not authorized to list files for this organization.")

    logger.info(f"User {user_id} authorized. Listing files for org: {org_id}")

    try:
        # 2. Database Query
        # Fetch documents matching organization_id.
        # We can also filter by storage_type if needed, e.g., "organization_openai"
        org_files_cursor = db.documents.find({"organization_id": org_id})
        org_files = await org_files_cursor.to_list(length=None) # Get all matching documents

        # 3. Prepare Return Value
        # Convert ObjectId to string for JSON serialization and structure the response
        result_files = []
        for f in org_files:
            f["id"] = str(f["_id"])
            # Ensure other ObjectId fields are also converted if they exist and are needed directly
            if "uploaded_by_user_id" in f and isinstance(f["uploaded_by_user_id"], ObjectId):
                f["uploaded_by_user_id"] = str(f["uploaded_by_user_id"])
            if "organization_id" in f and isinstance(f["organization_id"], ObjectId):
                 f["organization_id"] = str(f["organization_id"])
            # Remove the original '_id' if 'id' is preferred
            f.pop("_id", None)
            result_files.append(f)

        logger.info(f"Found {len(result_files)} files for org_id: {org_id}")
        return jsonable_encoder(result_files)

    except Exception as e:
        logger.error(f"Error fetching files for organization {org_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve files for organization: {str(e)}")


@router.patch("/{org_id}/assistants/{assistant_db_id}")
async def update_assistant_details(
    org_id: str,
    assistant_db_id: str,
    payload: AssistantUpdate,
    current_user=Depends(get_current_user)
):
    user_id_from_token = current_user[0]
    logger.info(f"User {user_id_from_token} attempting to update assistant {assistant_db_id} for org {org_id}.")

    # 1. Authorization
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        logger.warning(f"User {user_id_from_token} not found in database.")
        raise HTTPException(status_code=404, detail="User not found.")

    user_role = user_doc.get("role")
    user_org_id_db = str(user_doc.get("organization_id"))

    authorized = False
    if user_role == "admin":
        logger.info(f"Admin user {user_id_from_token} is proceeding with assistant update for org {org_id}.")
        authorized = True
    elif user_role == "organization_head" and user_org_id_db == org_id:
        logger.info(f"Organization head {user_id_from_token} authorized for org {org_id}.")
        authorized = True

    if not authorized:
        logger.warning(f"User {user_id_from_token} with role '{user_role}' (org: {user_org_id_db}) "
                       f"attempted to update assistant {assistant_db_id} for org {org_id}. Forbidden.")
        raise HTTPException(status_code=403, detail="User not authorized for this action.")

    # 2. Fetch Assistant from DB
    assistant_obj_id = ObjectId(assistant_db_id)
    assistant_doc = await db.assistants.find_one({"_id": assistant_obj_id})

    if not assistant_doc:
        raise HTTPException(status_code=404, detail=f"Assistant with ID {assistant_db_id} not found.")

    # For org_head, ensure the assistant belongs to their organization
    if user_role == "organization_head" and str(assistant_doc.get("org_id")) != org_id:
        logger.warning(f"Org head {user_id_from_token} attempted to update assistant {assistant_db_id} not belonging to their org ({assistant_doc.get('org_id')}).")
        raise HTTPException(status_code=403, detail="Assistant does not belong to your organization.")
    elif user_role == "admin" and str(assistant_doc.get("org_id")) != org_id:
        logger.warning(f"Admin {user_id_from_token} attempting to update assistant {assistant_db_id} whose org_id ({assistant_doc.get('org_id')}) does not match path org_id ({org_id}).")
        raise HTTPException(status_code=400, detail=f"Assistant's organization ID ({assistant_doc.get('org_id')}) does not match the organization ID in the request path ({org_id}).")

    # 3. Prepare updates for DB and OpenAI Assistant object
    update_data_db = {}
    update_data_openai_assistant = {}

    if payload.name is not None:
        update_data_db["name"] = payload.name
        update_data_openai_assistant["name"] = payload.name
    if payload.instructions is not None:
        update_data_db["instructions"] = payload.instructions
        update_data_openai_assistant["instructions"] = payload.instructions
    if payload.model is not None:
        update_data_db["model"] = payload.model
        update_data_openai_assistant["model"] = payload.model

    openai_assistant_id = assistant_doc.get("openai_assistant_id")
    current_vector_store_id = assistant_doc.get("vector_store_id")
    newly_created_vector_store_id = None

    # 4. Handle File IDs and Vector Store Management
    if payload.file_ids is not None:
        update_data_db["file_ids"] = payload.file_ids

        if not current_vector_store_id and payload.file_ids:
            logger.info(f"No vector store for assistant {assistant_db_id}. Creating new one.")
            try:
                vs_name = f"VS for {assistant_doc.get('name', assistant_db_id)}"
                vector_store = await asyncio.to_thread(
                    openai_client.beta.vector_stores.create,
                    name=vs_name,
                    file_ids=payload.file_ids
                )
                newly_created_vector_store_id = vector_store.id
                current_vector_store_id = newly_created_vector_store_id
                update_data_db["vector_store_id"] = current_vector_store_id
                logger.info(f"New vector store {current_vector_store_id} created and files attached for assistant {assistant_db_id}.")
                update_data_openai_assistant["tool_resources"] = {"file_search": {"vector_store_ids": [current_vector_store_id]}}
                update_data_openai_assistant["tools"] = [{"type": "file_search"}]
            except Exception as e:
                logger.error(f"Failed to create new vector store or attach files for assistant {assistant_db_id}. Error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error creating vector store: {str(e)}")

        elif current_vector_store_id:
            logger.info(f"Reconciling files for assistant {assistant_db_id} in VS {current_vector_store_id}")
            try:
                existing_vs_files_resp = await asyncio.to_thread(
                    openai_client.beta.vector_stores.files.list,
                    vector_store_id=current_vector_store_id
                )
                existing_openai_files_in_vs = {file.id for file in existing_vs_files_resp.data}

                newly_provided_file_ids = set(payload.file_ids)

                files_to_add_to_vs = newly_provided_file_ids - existing_openai_files_in_vs
                files_to_remove_from_vs = existing_openai_files_in_vs - newly_provided_file_ids

                for file_id in files_to_add_to_vs:
                    logger.info(f"Adding file {file_id} to VS {current_vector_store_id}")
                    await asyncio.to_thread(
                        openai_client.beta.vector_stores.files.create,
                        vector_store_id=current_vector_store_id,
                        file_id=file_id
                    )

                for file_id in files_to_remove_from_vs:
                    logger.info(f"Removing file {file_id} from VS {current_vector_store_id}")
                    await asyncio.to_thread(
                        openai_client.beta.vector_stores.files.delete,
                        vector_store_id=current_vector_store_id,
                        file_id=file_id
                    )

                if not payload.file_ids and existing_openai_files_in_vs:
                    logger.info(f"Payload file_ids is empty. All files removed from VS {current_vector_store_id}.")
                    update_data_openai_assistant["tool_resources"] = {"file_search": {"vector_store_ids": []}}
            except Exception as e:
                logger.error(f"Failed to reconcile files in VS {current_vector_store_id} for assistant {assistant_db_id}. Error: {str(e)}")
                pass

    # 5. Database Update
    if update_data_db:
        await db.assistants.update_one({"_id": assistant_obj_id}, {"$set": update_data_db})
        logger.info(f"Assistant {assistant_db_id} updated in DB with data: {update_data_db}")

    # 6. OpenAI Assistant Object Update
    if openai_assistant_id and update_data_openai_assistant:
        try:
            logger.info(f"Attempting to update OpenAI assistant object {openai_assistant_id} with data: {update_data_openai_assistant}")
            def _update_assistant_in_thread():
                assistant_service = openai_client.beta.assistants  # Use v2 API
                logger.info(f"Accessed openai_client.beta.assistants in thread (update): {type(assistant_service)}")
                return assistant_service.update(
                    assistant_id=openai_assistant_id,
                    **update_data_openai_assistant
                )
            await asyncio.to_thread(_update_assistant_in_thread)
            logger.info(f"OpenAI assistant object {openai_assistant_id} updated successfully.")
        except Exception as e:
            logger.error(f"CRITICAL: Failed to update OpenAI assistant object {openai_assistant_id} after DB update for assistant {assistant_db_id}. Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to update OpenAI assistant: {str(e)}")

    # 7. Return updated document
    updated_assistant_doc = await db.assistants.find_one({"_id": assistant_obj_id})
    if updated_assistant_doc:
        if "_id" in updated_assistant_doc and isinstance(updated_assistant_doc["_id"], ObjectId):
            updated_assistant_doc["_id"] = str(updated_assistant_doc["_id"])
        if "org_id" in updated_assistant_doc and isinstance(updated_assistant_doc["org_id"], ObjectId):
            updated_assistant_doc["org_id"] = str(updated_assistant_doc["org_id"])
        if "created_by" in updated_assistant_doc and isinstance(updated_assistant_doc["created_by"], ObjectId):
            updated_assistant_doc["created_by"] = str(updated_assistant_doc["created_by"])

    return jsonable_encoder(updated_assistant_doc)

@router.delete("/{org_id}/assistants/{assistant_db_id}")
async def delete_assistant_endpoint(
    org_id: str,
    assistant_db_id: str,
    current_user=Depends(get_current_user)
):
    user_id_from_token = current_user[0]
    logger.info(f"User {user_id_from_token} attempting to delete assistant {assistant_db_id} for org {org_id}.")

    # 1. Authorization
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        logger.warning(f"User {user_id_from_token} not found in database during assistant deletion.")
        raise HTTPException(status_code=404, detail="User not found.")

    user_role = user_doc.get("role")
    user_org_id_db = str(user_doc.get("organization_id"))

    authorized = False
    if user_role == "admin":
        logger.info(f"Admin user {user_id_from_token} authorized for assistant deletion.")
        authorized = True
    elif user_role == "organization_head" and user_org_id_db == org_id:
        logger.info(f"Organization head {user_id_from_token} authorized for org {org_id}.")
        authorized = True

    if not authorized:
        logger.warning(f"User {user_id_from_token} with role '{user_role}' (org: {user_org_id_db}) "
                       f"attempted to delete assistant {assistant_db_id} for org {org_id}. Forbidden.")
        raise HTTPException(status_code=403, detail="User not authorized for this action.")

    # 2. Fetch Assistant Document
    assistant_obj_id = ObjectId(assistant_db_id)
    assistant_doc = await db.assistants.find_one({"_id": assistant_obj_id})

    if not assistant_doc:
        raise HTTPException(status_code=404, detail=f"Assistant with ID {assistant_db_id} not found.")

    if user_role == "organization_head" and str(assistant_doc.get("org_id")) != org_id:
        logger.warning(f"Org head {user_id_from_token} attempted to delete assistant {assistant_db_id} "
                       f"not belonging to their org (assistant's org: {assistant_doc.get('org_id')}, user's org: {org_id}).")
        raise HTTPException(status_code=403, detail="Assistant does not belong to your organization.")
    elif user_role == "admin" and str(assistant_doc.get("org_id")) != org_id:
        logger.warning(f"Admin {user_id_from_token} attempting to delete assistant {assistant_db_id} whose org_id "
                       f"({assistant_doc.get('org_id')}) does not match path org_id ({org_id}).")
        raise HTTPException(status_code=400, detail="Assistant's organization ID does not match the organization ID in the request path.")

    openai_assistant_id = assistant_doc.get("openai_assistant_id")
    vector_store_id = assistant_doc.get("vector_store_id")

    # 3. Delete OpenAI Vector Store (if applicable)
    if vector_store_id:
        try:
            logger.info(f"Attempting to delete OpenAI Vector Store {vector_store_id} for assistant {assistant_db_id}.")
            await asyncio.to_thread(openai_client.beta.vector_stores.delete, vector_store_id)
            logger.info(f"OpenAI Vector Store {vector_store_id} deleted successfully.")
        except Exception as e:
            logger.error(f"Failed to delete OpenAI Vector Store {vector_store_id} for assistant {assistant_db_id}. Error: {str(e)}")

    # 4. Delete OpenAI Assistant (if applicable)
    if openai_assistant_id:
        try:
            logger.info(f"Attempting to delete OpenAI Assistant {openai_assistant_id} for assistant DB ID {assistant_db_id}.")
            def _delete_assistant_in_thread():
                assistant_service = openai_client.beta.assistants  # Use v2 API
                logger.info(f"Accessed openai_client.beta.assistants in thread (delete): {type(assistant_service)}")
                return assistant_service.delete(assistant_id=openai_assistant_id)
            await asyncio.to_thread(_delete_assistant_in_thread)
            logger.info(f"OpenAI Assistant {openai_assistant_id} deleted successfully.")
        except Exception as e:
            logger.error(f"Failed to delete OpenAI Assistant {openai_assistant_id} for assistant DB ID {assistant_db_id}. Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to delete OpenAI assistant: {str(e)}")

    # 5. Database Deletion
    delete_result = await db.assistants.delete_one({"_id": assistant_obj_id})
    if delete_result.deleted_count == 0:
        logger.error(f"Assistant {assistant_db_id} was fetched but not found for deletion from DB.")
        raise HTTPException(status_code=404, detail="Assistant found initially but could not be deleted from database.")

    logger.info(f"Assistant {assistant_db_id} deleted from database by user {user_id_from_token}.")
    return {"message": f"Assistant {assistant_db_id} and associated OpenAI resources (if any) deleted successfully."}

@router.delete("/{org_id}/files/{openai_file_id}")
async def delete_org_openai_file(org_id: str, openai_file_id: str, current_user=Depends(get_current_user)):
    user_id_from_token = current_user[0]
    logger.info(f"User {user_id_from_token} attempting to delete OpenAI file {openai_file_id} for org {org_id}.")

    # 1. Authorization
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        logger.warning(f"User {user_id_from_token} not found in database.")
        raise HTTPException(status_code=404, detail="User not found.")

    user_role = user_doc.get("role")
    user_org_id_str = str(user_doc.get("organization_id"))

    authorized = False
    if user_role == "admin":
        logger.info(f"Admin user {user_id_from_token} authorized for general file deletion attempt.")
        authorized = True # Admin can attempt to delete any file, but we'll check DB ownership next
    elif user_role == "organization_head" and user_org_id_str == org_id:
        logger.info(f"Organization head {user_id_from_token} authorized for org {org_id}.")
        authorized = True

    if not authorized:
        logger.warning(f"User {user_id_from_token} with role '{user_role}' (org: {user_org_id_str}) "
                       f"attempted to delete file {openai_file_id} for org {org_id}. Forbidden.")
        raise HTTPException(status_code=403, detail="User not authorized for this action.")

    # 2. Delete from DB first (ensures the file belongs to the specified org according to our records)
    # This also prevents an org_head from deleting a file not associated with their org in our DB,
    # even if they somehow knew its openai_file_id.
    # Admins will also be restricted by this, meaning they can only delete files via this endpoint
    # if the file is tracked in the DB for that org.
    doc_to_delete = await db.documents.find_one_and_delete({
        "openai_file_id": openai_file_id,
        "organization_id": org_id
    })

    if not doc_to_delete:
        # If an admin was authorized, but the file isn't in this org's DB records, they might still want to delete from OpenAI.
        # However, the current flow requires it to be in DB for safety / consistency.
        # If not found in our DB for this org, it means either it never existed for this org,
        # was already deleted, or does not belong to this org.
        logger.warning(f"File {openai_file_id} not found in organization {org_id}'s records. User: {user_id_from_token}.")
        raise HTTPException(status_code=404, detail="File not found in this organization's records.")

    original_filename = doc_to_delete.get("filename", "N/A")
    logger.info(f"File record for '{original_filename}' (OpenAI ID: {openai_file_id}) deleted from DB for org {org_id}.")

    # 3. Delete from OpenAI
    try:
        delete_response = await asyncio.to_thread(openai_client.files.delete, openai_file_id)
        if not delete_response.deleted: # Check the 'deleted' attribute in the FileDeleted object
             logger.error(f"OpenAI reported file {openai_file_id} was not deleted, but no error raised. Response: {delete_response}")
             # This state is problematic: deleted from DB, not from OpenAI.
             # Re-inserting into DB to reflect reality or manual cleanup needed.
             # For now, we'll raise an error to alert.
             # Consider re-inserting or flagging: await db.documents.insert_one(doc_to_delete) (handle potential _id conflict)
             raise HTTPException(status_code=500, detail="File removed from organization records, but OpenAI reported it was not deleted.")

        logger.info(f"File {openai_file_id} ('{original_filename}') successfully deleted from OpenAI by user {user_id_from_token} for org {org_id}.")

    except openai.APIError as e: # More specific OpenAI error catching
        logger.error(f"CRITICAL: File {openai_file_id} ('{original_filename}') deleted from DB but FAILED to delete from OpenAI. Error: {str(e)}")
        # Attempt to restore the document record as the source of truth (OpenAI) still has the file.
        # We need to remove the '_id' from doc_to_delete if it was added by find_one_and_delete before re-inserting.
        # However, find_one_and_delete returns the doc as it was BEFORE deletion.
        try:
            await db.documents.insert_one(doc_to_delete)
            logger.info(f"DB record for file {openai_file_id} ('{original_filename}') restored due to OpenAI deletion failure.")
        except Exception as db_reinsert_error:
            logger.critical(f"CRITICAL_DB_REINSERT_FAIL: Failed to restore DB record for {openai_file_id} after OpenAI delete error. DB Error: {db_reinsert_error}")
        raise HTTPException(status_code=500, detail=f"File removed from organization records, but failed to delete from OpenAI: {str(e)}. Record restored. Please try again or contact support.")
    except Exception as e: # Catch any other unexpected errors
        logger.error(f"CRITICAL: Unexpected error during OpenAI file deletion for {openai_file_id} ('{original_filename}'). Error: {str(e)}")
        try:
            await db.documents.insert_one(doc_to_delete) # Attempt to restore
            logger.info(f"DB record for file {openai_file_id} ('{original_filename}') restored due to unexpected OpenAI deletion error.")
        except Exception as db_reinsert_error:
            logger.critical(f"CRITICAL_DB_REINSERT_FAIL: Failed to restore DB record for {openai_file_id} after unexpected OpenAI delete error. DB Error: {db_reinsert_error}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during OpenAI file deletion. Record restored.")

    return {"message": f"File '{original_filename}' (OpenAI ID: {openai_file_id}) deleted successfully."}
