import os
import uuid
import logging
import numpy as np
from openai import OpenAI # Modified import
import openai # Added for openai.APIError
import tiktoken
import httpx # Added
import asyncio # Added
from typing import List # Added
from fastapi import UploadFile, HTTPException # Added HTTPException
from datetime import datetime
from bson import ObjectId
from app.config import settings
from app.db import db
from app.utils.logger import logger # Changed to use app.utils.logger

# Cached tokenizer
_tokenizer = tiktoken.encoding_for_model("gpt-4")

# Initialize OpenAI client
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


class OpenAIOrganizationService:

    @staticmethod
    async def process_and_store_file_for_org(org_id: str, file: UploadFile, user_id: str) -> List[str]:
        logger.info(f"User {user_id} in org {org_id} initiating file processing for: {file.filename}")
        openai_file_id = None # Initialize openai_file_id

        try:
            # 1. OpenAI Upload using SDK
            file_content = await file.read()
            await file.seek(0)  # Reset file pointer

            logger.info(f"Attempting SDK upload for {file.filename} to OpenAI by user {user_id} for org {org_id}...")
            openai_response = await asyncio.to_thread(
                openai_client.files.create,
                file=(file.filename, file_content, file.content_type), # Pass tuple: (name, content, type)
                purpose="assistants"
            )
            openai_file_id = openai_response.id
            logger.info(f"SDK File uploaded to OpenAI successfully by user {user_id} for org {org_id}: {openai_file_id}, filename: {file.filename}")

        except openai.APIError as e:
            logger.error(f"OpenAI SDK APIError during file upload for {file.filename} (org {org_id}, user {user_id}): {type(e).__name__} - {str(e)}")
            raise HTTPException(status_code=getattr(e, 'status_code', 500), detail=f"OpenAI SDK Error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during SDK file upload for {file.filename} (org {org_id}, user {user_id}): {type(e).__name__} - {str(e)}")
            logger.error(f"Unexpected SDK upload error details: Exception Type: {type(e)}, Exception Args: {e.args}") # Log type and args
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred during file upload: {str(e)}")

        # Ensure openai_file_id was obtained
        if not openai_file_id:
            # This case should ideally be caught by earlier exceptions if upload failed.
            logger.error(f"OpenAI file ID not obtained for {file.filename} (org {org_id}, user {user_id}) though no direct upload exception was caught.")
            raise HTTPException(status_code=500, detail="Failed to obtain OpenAI file ID after upload attempt.")

        # 2. Database Storage
        try:
            document_to_store = {
                "filename": file.filename,
                "openai_file_id": openai_file_id,
                "organization_id": ObjectId(org_id),
                "uploaded_by_user_id": ObjectId(user_id),
                "uploaded_at": datetime.utcnow(),
                "storage_type": "organization_openai_service", # New type
                "purpose": "assistants"
            }
            result = await db["documents"].insert_one(document_to_store)
            logger.info(f"File metadata stored in DB for org {org_id}, user {user_id}. Doc ID: {result.inserted_id}, OpenAI File ID: {openai_file_id}")
            
            return [openai_file_id]

        except Exception as db_e:
            logger.error(f"Database insert_one failed for {file.filename} (org: {org_id}, user: {user_id}) after OpenAI upload {openai_file_id}. Exception Type: {type(db_e)}, Exception Args: {db_e.args}")
            # Attempt to delete the orphaned OpenAI file
            try:
                logger.info(f"Attempting to delete orphaned OpenAI file {openai_file_id} due to DB storage failure (org {org_id}, user {user_id}).")
                await asyncio.to_thread(openai_client.files.delete, openai_file_id)
                logger.info(f"Successfully deleted orphaned OpenAI file {openai_file_id} (org {org_id}, user {user_id}).")
                raise HTTPException(status_code=500, detail=f"File uploaded to OpenAI (ID: {openai_file_id}), but failed to save to database for organization {org_id}. OpenAI file has been cleaned up. Please try again.")
            except Exception as cleanup_e:
                logger.critical(f"CRITICAL: Failed to delete orphaned OpenAI file {openai_file_id} (org {org_id}, user {user_id}) after DB storage failure. Cleanup Exception: {repr(cleanup_e)}")
                raise HTTPException(status_code=500, detail=f"File uploaded to OpenAI (ID: {openai_file_id}), but failed to save to database for organization {org_id}. CRITICAL: Failed to clean up OpenAI file. Please report OpenAI file ID: {openai_file_id} to support.")


    @staticmethod
    def chunk_text(text: str, max_tokens=2000, overlap=400) -> list[str]:
        logger.info("🔧 Starting text chunking")
        tokens = _tokenizer.encode(text)
        chunks = []
        start = 0
        while start < len(tokens):
            end = min(start + max_tokens, len(tokens))
            chunk = tokens[start:end]
            chunks.append(_tokenizer.decode(chunk))
            start += max_tokens - overlap
        logger.info(f"✅ Created {len(chunks)} chunks from input text")
        return chunks

    @staticmethod
    async def get_embeddings(texts: list[str]) -> np.ndarray:
        logger.info("📡 Requesting OpenAI embeddings")
        response = openai.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        )
        vectors = [record.embedding for record in response.data]
        logger.info("✅ Embeddings received from OpenAI")
        return np.array(vectors, dtype=np.float32)
