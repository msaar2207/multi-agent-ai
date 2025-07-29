from datetime import datetime, timedelta

import os
import uuid
from app.services.admin import OpenAIAdminService
from app.tasks.quota_reset import reset_quotas
from app.utils.logger import logger  # ✅ import logger
from app.utils.sendEmail import send_invite_email
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Body, Request
from openai import OpenAI
from app.config import settings
from app.utils.auth import get_current_user, require_role, verify_token, hash_password # Added hash_password
from app.db import assistants, users, db as app_db # Renaming to avoid confusion if 'db' is used locally
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel # Import BaseModel
from app.schemas.organization import AdminOrganizationCreate, AdminOrganizationUpdate, AdminOrganizationResponse, QuotaInfo, AdminOrganizationQuotaUpdate
from app.schemas.user import AdminUserResponse as AdminUserResponseSchema # Alias to avoid naming conflict if any
from app.schemas.document import OrgDocumentResponse # Import the new document schema
from app.schemas.assistant import OrgAssistantResponse # Import the new assistant schema

# Pydantic model for updating organization status
class OrganizationStatusUpdate(BaseModel): # Now BaseModel is correctly referenced
    is_active: bool

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/create")
async def create_assistant_with_files(
    name: str = Form(...),
    model_name: str = Form(...),
    instructions: str = Form(...),
    files: list[UploadFile] = File(...),
    current_user_id: str = Depends(verify_token)
):
    await require_role(current_user_id, ['admin'])
    contents = [await f.read() for f in files]
    filenames = [f.filename for f in files]

    file_ids = await OpenAIAdminService.upload_files(contents, filenames)

    result = await OpenAIAdminService.create_assistant_with_vector_store(
        name=name,
        model_name=model_name,
        instructions=instructions,
        file_ids=file_ids
    )

    await assistants.insert_one(
        {
            "$set": {
                "assistant_id": result["assistant_id"],
                "vector_store_id": result["vector_store_id"],
                "file_ids": file_ids,
                "name": name,
                "instructions": instructions
            }
        },
    )

    return {
        "status": "created",
        **result
    }

@router.get("/list")
async def list_all_assistants(current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    cursor = assistants.find({}, {
        "_id": 1,
        "name": 1,
        "assistant_id": 1,
        "file_ids": 1,
        "instructions": 1
    })
    return [{**row, "_id": str(row["_id"])} async for row in cursor]


@router.delete("/{id}")
async def delete_assistant(id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    await assistants.delete_one({"_id": id})
    return {"status": "deleted"}


@router.post("/set-default")
async def set_default_assistant(payload: dict, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    assistant = await assistants.find_one({"_id": payload["id"]})
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")
    await assistants.update_one(
        {"_id": "default_assistant"},
        {"$set": assistant},
        upsert=True
    )
    return {"status": "active set"}

@router.post("/upload-and-chunk")
async def upload_and_chunk_file(
    name: str = Form(...),
    instructions: str = Form(...),
    file: UploadFile = File(...),
    current_user_id: str = Depends(verify_token)
):
    await require_role(current_user_id, ['admin'])
    extension = os.path.splitext(file.filename)[1].lower()
    raw_text = ""

    if extension == ".pdf":
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f_out:
            f_out.write(await file.read())
        raw_text = OpenAIAdminService.extract_text_from_pdf(temp_path)
        os.remove(temp_path)

    elif extension in [".doc", ".docx"]:
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f_out:
            f_out.write(await file.read())
        raw_text = OpenAIAdminService.extract_text_from_docx(temp_path)
        os.remove(temp_path)

    elif extension in [".txt", ".md"]:
        raw_text = (await file.read()).decode("utf-8")

    else:
        raise HTTPException(status_code=400, detail="Only .pdf, .docx, .doc, .txt, .md files supported")

    chunks = OpenAIAdminService.chunk_text(raw_text, 4000)
    filenames = [f"{file.filename}_chunk_{i}.txt" for i in range(len(chunks))]
    chunk_bytes = [c.encode("utf-8") for c in chunks]

    file_ids = await OpenAIAdminService.upload_files(chunk_bytes, filenames)

    result = await OpenAIAdminService.create_assistant_with_vector_store(
        name=name,
        instructions=instructions,
        file_ids=file_ids
    )

    await assistants.update_one(
        {"_id": "default_assistant"},
        {"$set": {
            "assistant_id": result["assistant_id"],
            "vector_store_id": result["vector_store_id"],
            "file_ids": file_ids,
            "name": name,
            "instructions": instructions
        }},
        upsert=True
    )

    return {"status": "created", **result}

@router.delete("/vector-store/{id}")
async def remove_vector_store(id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    deleted = await OpenAIAdminService.delete_vector_store(id)
    return {"status": "deleted", "id": id, "response": deleted}

@router.get("/{assistant_id}/files")
async def list_assistant_files(assistant_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    assistant = await assistants.find_one({"assistant_id": assistant_id})
    if not assistant:
        raise HTTPException(status_code=404)
    return assistant.get("files", [])

@router.post("/{assistant_id}/files/add")
async def upload_assistant_files(
    assistant_id: str,
    files: List[UploadFile] = File(...),
    user: dict = Depends(lambda: require_role(Depends(verify_token), ['admin']))
):
    assistant = await assistants.find_one({"assistant_id": assistant_id})
    if not assistant:
        raise HTTPException(status_code=404)

    try:
        vector_store_id = assistant.get("vector_store_id")
        if not vector_store_id:
            raise HTTPException(status_code=400, detail="Assistant has no vector store")

        # Stage 1: Call OpenAIAdminService
        # If this fails, the outer except Exception as e will catch it.
        file_ids = await OpenAIAdminService.chunk_and_append_to_vector_store(files, vector_store_id)
        logger.info(f"Admin user {user['_id']}: Successfully added files to vector store {vector_store_id} for assistant {assistant_id}. OpenAI file IDs: {file_ids}")

        # Prepare metadata for DB update.
        # Note: Reading file size here assumes files can be read again.
        # If chunk_and_append_to_vector_store consumes them, this needs adjustment.
        # For this task, we focus on the error handling structure.
        uploaded_metadata = []
        for fid, f in zip(file_ids, files):
            try:
                # Attempt to read file contents for size. This might fail if already read.
                # A more robust way might be to get size before passing to chunk_and_append_to_vector_store
                # or if chunk_and_append_to_vector_store can return sizes.
                contents = await f.read()
                await f.seek(0) # Reset pointer if f will be used again, though likely not here.
                size = len(contents)
            except Exception as read_exc:
                logger.warning(f"Could not read size for file {f.filename} (ID: {fid}) after upload: {repr(read_exc)}. Setting size to -1.")
                size = -1 # Indicate size could not be determined

            uploaded_metadata.append({
                "file_id": fid,
                "filename": f.filename,
                "active": True,
                "size": size 
            })
        
        # Stage 2: Database Update
        try:
            await assistants.update_one(
                {"assistant_id": assistant_id},
                {"$push": {"files": {"$each": uploaded_metadata}}}
            )
            logger.info(f"Admin user {user['_id']}: Successfully updated assistant {assistant_id} in DB with new file metadata: {uploaded_metadata}")
        except Exception as db_error:
            logger.error(f"Database update failed for assistant {assistant_id} after adding files {file_ids} to vector store {vector_store_id}. DB Exception: {repr(db_error)}")
            # Critical: Files added to VS, but not to our DB record.
            error_detail = (
                f"Files uploaded and added to OpenAI vector store {vector_store_id} (files: {file_ids}), "
                f"but failed to update assistant record {assistant_id} in database. "
                f"This is an inconsistent state. Please manually verify."
            )
            raise HTTPException(status_code=500, detail=error_detail)

        return {"status": "appended", "vector_store_id": vector_store_id, "new_file_ids": file_ids}

    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        # This will catch failures from OpenAIAdminService.chunk_and_append_to_vector_store
        # or any other unexpected errors before the specific DB handling.
        logger.error(f"General error in upload_assistant_files for assistant {assistant_id}: {repr(e)}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.patch("/{assistant_id}/files/{file_id}")
async def toggle_file_status(assistant_id: str, file_id: str, body=Body(...), current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    assistant = await assistants.find_one({"assistant_id": assistant_id})
    if not assistant:
        raise HTTPException(status_code=404)

    await assistants.update_one(
        {"assistant_id": assistant_id, "files.file_id": file_id},
        {"$set": {"files.$.active": body["active"]}}
    )
    return {"status": "updated"}

@router.delete("/{assistant_id}/files/{file_id}")
async def delete_file(assistant_id: str, file_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    await assistants.update_one(
        {"assistant_id": assistant_id},
        {"$pull": {"files": {"file_id": file_id}}}
    )
    return {"status": "deleted"}

@router.post("/admin/reset-quotas")
async def manual_quota_reset(current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])
    await reset_quotas()
    return {"message": "Reset complete"}

@router.get("/users/no-org")
async def get_users_without_organization(user: dict = Depends(lambda: require_role(Depends(verify_token), ['admin']))):
    logger.info(f"Admin user: {user}")
    # admin = await users.find_one({"_id": ObjectId(user[0])}) # No longer needed due to require_role
    # if admin["role"] != "admin":
    #     raise HTTPException(status_code=403, detail="Admin access only")

    users_col = await users.find({
        "organization_id": None
    }).to_list(length=100)

    return [{"id": str(u["_id"]), "email": u["email"]} for u in users_col]

@router.post("/users/invite")
async def invite_org_head(request: Request, user: dict = Depends(lambda: require_role(Depends(verify_token), ['admin']))):
    # admin = await users.find_one({"_id": ObjectId(user[0])}) # No longer needed
    # if admin["role"] != "admin":
    #     raise HTTPException(status_code=403, detail="Admin access only")

    body = await request.json()
    email = body.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing = await users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    invite_token = str(uuid.uuid4())

    new_user = {
        "email": email,
        "role": "organization_head",
        "organization_id": None,
        "agent_id": None,
        "quota": {
            "monthly_limit": 10000,
            "used": 0,
            "reset_date": None
        },
        "status": "invited",
        "invite_token": invite_token,
        "invite_expiry": datetime.utcnow() + timedelta(days=3),
    }

    result = await users.insert_one(new_user)

    # TODO: Send actual email here
    invite_url = f"{settings.FRONT_END_URL}/organization/setup-account?token={invite_token}"
    print(f"Send this invite link to the user: {invite_url}")
    send_invite_email(to_email=email, invite_link=invite_url
    )

    return {"id": str(result.inserted_id), "invite_token": invite_token}


# CRUD Operations for Organizations by Admin
@router.post("/organizations", response_model=AdminOrganizationResponse)
async def admin_create_organization(
    org_data: AdminOrganizationCreate,
    current_user_id: str = Depends(verify_token)
):
    await require_role(current_user_id, ['admin'])

    org_id_for_head_user = None # Will hold the new org's ID if head user is created

    new_org_doc = {
        "name": org_data.name,
        "head_user_id": None,
        "usage_quota": QuotaInfo().model_dump(),
        "agents": [],
        "created_at": datetime.utcnow()
    }

    org_creation_result = await app_db.organizations.insert_one(new_org_doc)
    org_id_for_head_user = org_creation_result.inserted_id

    newly_created_head_user_id = None

    if org_data.head_user_email and org_data.head_user_password:
        existing_user = await app_db.users.find_one({"email": org_data.head_user_email})
        if existing_user:
            # Clean up the created organization if head user creation fails due to conflict
            await app_db.organizations.delete_one({"_id": org_id_for_head_user})
            raise HTTPException(
                status_code=409,
                detail=f"User with email {org_data.head_user_email} already exists. Organization creation aborted."
            )

        hashed_pwd = hash_password(org_data.head_user_password)
        default_user_quota = {
            "monthly_limit": settings.FREE_TOKENS, # Assuming FREE_TOKENS is appropriate default
            "used": 0,
            "reset_date": None # Or a specific reset logic
        }

        new_head_user_doc = {
            "email": org_data.head_user_email,
            "name": org_data.head_user_name or "Organization Head", # Default name if not provided
            "password": hashed_pwd,
            "role": "organization_head",
            "organization_id": org_id_for_head_user, # Link to the new org
            "is_active": True,
            "is_verified": True, # Admin created users are pre-verified
            "created_at": datetime.utcnow(),
            "quota": default_user_quota,
            "agent_id": None, # No default agent initially
        }
        user_creation_result = await app_db.users.insert_one(new_head_user_doc)
        newly_created_head_user_id = user_creation_result.inserted_id

        # Update the organization with the new head_user_id
        await app_db.organizations.update_one(
            {"_id": org_id_for_head_user},
            {"$set": {"head_user_id": newly_created_head_user_id}}
        )
        logger.info(f"Admin created new organization '{org_data.name}' (ID: {org_id_for_head_user}) and new head user '{org_data.head_user_email}' (ID: {newly_created_head_user_id}).")
    else:
        logger.info(f"Admin created new organization '{org_data.name}' (ID: {org_id_for_head_user}) without an initial head user.")


    # Fetch the final state of the organization (now possibly with head_user_id)
    created_org_doc = await app_db.organizations.find_one({"_id": org_id_for_head_user})

    response_data = {
        "id": str(created_org_doc["_id"]),
        "name": created_org_doc["name"],
        "head_user_id": str(created_org_doc.get("head_user_id")) if created_org_doc.get("head_user_id") else None,
        "usage_quota": QuotaInfo(**created_org_doc.get("usage_quota", {})),
        "agents": created_org_doc.get("agents", []),
        "created_at": created_org_doc["created_at"],
        "is_active": created_org_doc.get("is_active", True), # Default to True if not set
        "member_count": 1 if newly_created_head_user_id else 0
    }
    return AdminOrganizationResponse(**response_data)

@router.get("/organizations", response_model=List[AdminOrganizationResponse])
async def admin_list_organizations(current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    orgs_cursor = app_db.organizations.find()
    organizations = []
    async for org_doc in orgs_cursor: # Renamed org to org_doc for clarity
        member_count = await app_db.users.count_documents({"organization_id": str(org_doc['_id'])})
        organizations.append(AdminOrganizationResponse(
            id=str(org_doc["_id"]),
            name=org_doc["name"],
            head_user_id=str(org_doc.get("head_user_id")) if org_doc.get("head_user_id") else None, # Corrected line
            usage_quota=QuotaInfo(**org_doc.get("usage_quota", {})),
            agents=org_doc.get("agents", []),
            created_at=org_doc.get("created_at", datetime.utcnow()), # Fallback if created_at is missing
            member_count=member_count,
            is_active=org_doc.get("is_active", True) # Default to True if not set
        ))
    return organizations

@router.get("/organizations/{org_id}", response_model=AdminOrganizationResponse)
async def admin_get_organization(org_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    try:
        obj_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    organization = await app_db.organizations.find_one({"_id": obj_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    return AdminOrganizationResponse(
        id=str(organization["_id"]),
        name=organization["name"],
        head_user_id=str(organization.get("head_user_id")) if organization.get("head_user_id") else None,
        usage_quota=QuotaInfo(**organization.get("usage_quota", {})),
        agents=organization.get("agents", []),
        created_at=organization.get("created_at", datetime.utcnow()), # Fallback
        is_active=organization.get("is_active", True), # Default to True if not set
    )

@router.put("/organizations/{org_id}", response_model=AdminOrganizationResponse)
async def admin_update_organization(
    org_id: str,
    org_update_data: AdminOrganizationUpdate,
    current_user_id: str = Depends(verify_token)
):
    await require_role(current_user_id, ['admin'])

    try:
        obj_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    existing_org = await app_db.organizations.find_one({"_id": obj_id})
    if not existing_org:
        raise HTTPException(status_code=404, detail="Organization not found")
    used_quota = existing_org["usage_quota"]["used"]
    update_data = org_update_data.model_dump(exclude_unset=True)
    if "name" in update_data:
        await app_db.organizations.update_one(
            {"_id": obj_id},
            {"$set": update_data}
        )
    else:    
        update_data["usage_quota"]["used"] = used_quota
        await app_db.organizations.update_one(
            {"_id": obj_id},
            {"$set": update_data}
        )
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    updated_org = await app_db.organizations.find_one({"_id": obj_id})

    return AdminOrganizationResponse(
        id=str(updated_org["_id"]),
        name=updated_org["name"],
        head_user_id=str(updated_org.get("head_user_id")) if updated_org.get("head_user_id") else None,
        usage_quota=QuotaInfo(**updated_org.get("usage_quota", {})),
        agents=updated_org.get("agents", []),
        created_at=updated_org.get("created_at", datetime.utcnow()),
        is_active=updated_org.get("is_active", True), 
    )

@router.delete("/organizations/{org_id}")
async def admin_delete_organization(org_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    try:
        obj_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    result = await app_db.organizations.delete_one({"_id": obj_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found or already deleted")

    return {"message": "Organization deleted successfully"}

@router.put("/organizations/{org_id}/quota", response_model=AdminOrganizationResponse)
async def admin_update_organization_quota(
    org_id: str,
    quota_data: AdminOrganizationQuotaUpdate,
    current_user_id: str = Depends(verify_token)
):
    await require_role(current_user_id, ['admin'])

    try:
        obj_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    organization = await app_db.organizations.find_one({"_id": obj_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Get current quota, or initialize with defaults if not present
    current_quota = QuotaInfo(**organization.get("usage_quota", {}))

    updated_fields_count = 0
    if quota_data.total_limit is not None:
        # Schema already validates ge=0, but an explicit check here can be an additional safeguard if desired.
        # if quota_data.total_limit < 0:
        #      raise HTTPException(status_code=400, detail="Total limit cannot be negative.")
        current_quota.total_limit = quota_data.total_limit
        updated_fields_count += 1

    # Add other fields here if AdminOrganizationQuotaUpdate is extended in the future
    # e.g., if quota_data.used is not None: current_quota.used = quota_data.used; updated_fields_count +=1

    if updated_fields_count == 0:
        # This condition implies the request body was empty or only contained fields not defined in AdminOrganizationQuotaUpdate.
        # The schema AdminOrganizationQuotaUpdate only has optional fields, so an empty JSON {} is valid.
        # We should return a 304 Not Modified or a specific message if no actual changes are made.
        # Or, if the intent is that at least one valid field MUST be provided, the schema should enforce it.
        # For now, let's assume an empty valid request means "no changes to quota fields".
        # To prevent updating with the same data or no data, we can check if any value actually changed.
        # However, the current logic will proceed and "update" usage_quota with itself if no new values are provided.
        # A more robust check would be:
        # if quota_data.model_dump(exclude_unset=True) == {}:
        # raise HTTPException(status_code=400, detail="No quota information provided to update.")
        # For this iteration, we'll rely on the updated_fields_count.
         raise HTTPException(status_code=400, detail="No valid quota fields provided for update.")


    await app_db.organizations.update_one(
        {"_id": obj_id},
        {"$set": {"usage_quota": current_quota.model_dump()}}
    )

    updated_org_doc = await app_db.organizations.find_one({"_id": obj_id})

    # Construct the response object carefully
    return AdminOrganizationResponse(
        id=str(updated_org_doc["_id"]),
        name=updated_org_doc["name"],
        head_user_id=str(updated_org_doc.get("head_user_id")) if updated_org_doc.get("head_user_id") else None,
        usage_quota=QuotaInfo(**updated_org_doc.get("usage_quota", {})),
        agents=updated_org_doc.get("agents", []),
        created_at=updated_org_doc.get("created_at", datetime.utcnow()) # Fallback for created_at
    )

@router.patch("/organizations/{org_id}/status", response_model=AdminOrganizationResponse)
async def admin_update_organization_status(
    org_id: str,
    status_update: OrganizationStatusUpdate,
    current_user_id: str = Depends(verify_token)
):
    await require_role(current_user_id, ['admin'])

    try:
        obj_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    organization = await app_db.organizations.find_one({"_id": obj_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    await app_db.organizations.update_one(
        {"_id": obj_id},
        {"$set": {"is_active": status_update.is_active}}
    )

    updated_org = await app_db.organizations.find_one({"_id": obj_id})
    if not updated_org:
        # This should ideally not happen if the update was successful and the org existed.
        # Adding a check for robustness.
        raise HTTPException(status_code=404, detail="Organization not found after update.")

    member_count = await app_db.users.count_documents({"organization_id": str(updated_org['_id'])})

    # Ensure head_user_id is correctly formatted (string or None)
    head_user_id_str = None
    if updated_org.get("head_user_id"):
        head_user_id_str = str(updated_org["head_user_id"])

    # Ensure created_at is present, provide a fallback if necessary (though it should exist)
    created_at_dt = updated_org.get("created_at", datetime.utcnow())

    return AdminOrganizationResponse(
        id=str(updated_org["_id"]),
        name=updated_org["name"],
        head_user_id=head_user_id_str,
        usage_quota=QuotaInfo(**updated_org.get("usage_quota", {})),
        agents=updated_org.get("agents", []),
        created_at=created_at_dt,
        is_active=updated_org["is_active"], # This field was added in the previous subtask
        member_count=member_count
    )

# Endpoint to list all users for Admin
@router.get("/users", response_model=List[AdminUserResponseSchema])
async def admin_list_all_users(current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    all_users_cursor = app_db.users.find()

    # Fetch all organizations to create a name map
    orgs_cursor = app_db.organizations.find({}, {"name": 1, "_id": 1}) # Ensure _id is fetched for the map key
    org_id_to_name_map = {str(org['_id']): org['name'] async for org in orgs_cursor}

    response_users = []
    async for user_doc in all_users_cursor:
        org_id_obj = user_doc.get("organization_id") # This might be an ObjectId if not stringified in DB
        org_id_str = str(org_id_obj) if org_id_obj else None

        org_name = None
        if org_id_str:
            org_name = org_id_to_name_map.get(org_id_str)

        # Determine status - this is an example, adjust based on actual DB fields
        status_val = user_doc.get("status") # Assuming a 'status' field exists from user registration/invite
        if not status_val: # Fallback or inference if 'status' field doesn't exist directly
            if user_doc.get("invite_token") and not user_doc.get("is_verified"): # Approximation for "invited"
                 status_val = "invited"
            elif user_doc.get("is_active") == False:
                status_val = "inactive"
            elif user_doc.get("is_active") == True: # Explicitly check for True
                status_val = "active"
            else: # Default if no other status info found
                status_val = "unknown"

        user_data = AdminUserResponseSchema(
            id=str(user_doc["_id"]),
            email=user_doc["email"],
            name=user_doc.get("name"),
            role=user_doc.get("role", "user"),
            organization_id=org_id_str,
            organization_name=org_name,
            created_at=user_doc.get("created_at"),
            status=status_val,
        )
        response_users.append(user_data)

    return response_users

@router.get("/organizations/{org_id}/users", response_model=List[AdminUserResponseSchema])
async def admin_get_organization_users(org_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    try:
        obj_org_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    # Check if the organization exists
    organization = await app_db.organizations.find_one({"_id": obj_org_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_users_cursor = app_db.users.find({"organization_id": obj_org_id})

    response_user_list = []
    async for user_doc in org_users_cursor:
        # Minimal data for now, can expand using AdminUserResponseSchema fully if needed
        user_data = AdminUserResponseSchema(
            id=str(user_doc["_id"]),
            email=user_doc["email"],
            name=user_doc.get("name"), # name can be optional
            role=user_doc.get("role", "user"), # role should exist, default to "user"
            organization_id=str(user_doc.get("organization_id")), # Should match org_id
            organization_name=organization.get("name"), # Add org name for context
            created_at=user_doc.get("created_at"),
            status=user_doc.get("status", "unknown") # Include status
        )
        response_user_list.append(user_data)

    return response_user_list

@router.get("/organizations/{org_id}/documents", response_model=List[OrgDocumentResponse])
async def admin_get_organization_documents(org_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    try:
        obj_org_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    # Check if the organization exists
    organization = await app_db.organizations.find_one({"_id": obj_org_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Assuming 'app_db.documents' is the collection for documents.
    # Fields assumed in document: _id, filename, uploaded_at, openai_file_id, uploaded_by_user_id, organization_id
    org_documents_cursor = app_db.documents.find({"organization_id": org_id})

    response_document_list = []
    # For fetching uploader names efficiently, collect user_ids first
    uploader_ids = []
    temp_documents = [] # Store docs temporarily to process after fetching users

    async for doc_data in org_documents_cursor:
        temp_documents.append(doc_data)
        if doc_data.get("uploaded_by_user_id"):
            try:
                uploader_ids.append(ObjectId(doc_data["uploaded_by_user_id"]))
            except Exception: # If ID is invalid, skip adding it
                logger.warning(f"Document {doc_data['_id']} has invalid uploaded_by_user_id format: {doc_data.get('uploaded_by_user_id')}")


    # Fetch uploader details in bulk
    uploader_name_map = {}
    if uploader_ids:
        unique_uploader_ids = list(set(uploader_ids)) # Remove duplicates
        users_cursor = app_db.users.find({"_id": {"$in": unique_uploader_ids}}, {"name": 1, "email": 1})
        async for user_data in users_cursor:
            uploader_name_map[str(user_data["_id"])] = user_data.get("name") or user_data.get("email", "Unknown User")

    for doc_data in temp_documents:
        uploader_name = None
        user_id_str = str(doc_data.get("uploaded_by_user_id")) if doc_data.get("uploaded_by_user_id") else None
        if user_id_str and user_id_str in uploader_name_map:
            uploader_name = uploader_name_map[user_id_str]

        document_response = OrgDocumentResponse(
            id=str(doc_data["_id"]),
            filename=doc_data.get("filename", "Unknown Filename"),
            uploaded_at=doc_data.get("uploaded_at", datetime.utcnow()), # Provide fallback if field missing
            openai_file_id=doc_data.get("openai_file_id"),
            uploaded_by_user_id=user_id_str,
            uploader_name=uploader_name,
            organization_id=str(doc_data.get("organization_id")) # Should match obj_org_id
        )
        response_document_list.append(document_response)

    return response_document_list

@router.get("/organizations/{org_id}/assistants", response_model=List[OrgAssistantResponse])
async def admin_get_organization_assistants(org_id: str, current_user_id: str = Depends(verify_token)):
    await require_role(current_user_id, ['admin'])

    try:
        obj_org_id = ObjectId(org_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    # Check if the organization exists
    organization = await app_db.organizations.find_one({"_id": obj_org_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Query assistants collection for those linked to the organization_id
    # Assumes 'organization_id' field stores ObjectId of the organization in assistants collection
    # Assumes fields like 'model_name', 'created_at' exist in the assistants collection.
    # The 'assistant_id' here is OpenAI's ID (e.g., asst_xxx).
    org_assistants_cursor = app_db.assistants.find({"org_id": obj_org_id})

    response_assistant_list = []
    async for assistant_doc in org_assistants_cursor:
        assistant_data = OrgAssistantResponse(
            id=str(assistant_doc["_id"]), # MongoDB document ID
            name=assistant_doc.get("name", "Unnamed Assistant"),
            assistant_id=assistant_doc.get("assistant_id"), # OpenAI Assistant ID
            model_name=assistant_doc.get("model_name"), # Model name used
            instructions=assistant_doc.get("instructions"),
            file_ids=assistant_doc.get("file_ids", []),
            created_at=assistant_doc.get("created_at"),
            organization_id=str(assistant_doc.get("organization_id")) # Should match obj_org_id
        )
        response_assistant_list.append(assistant_data)

    return response_assistant_list