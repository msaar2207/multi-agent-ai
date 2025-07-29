import asyncio # Add asyncio import
from app.utils.logger import logger  # ✅ import logger
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Body
from fastapi.responses import FileResponse, PlainTextResponse
from pathlib import Path
from app.db import db
from app.utils.auth import get_current_user
from app.schemas.document import DocumentOut
from datetime import datetime
from openai import OpenAI
import os
from bson import ObjectId
from app.config import settings

router = APIRouter(prefix="/documents", tags=["documents"])
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

UPLOAD_DIR = Path(os.path.abspath("uploads/islamic_agent"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
# Ensure the upload directory exists
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
@router.post("/upload", response_model=DocumentOut)
async def upload_doc(file: UploadFile = File(...), user=Depends(get_current_user)):
    user_id, role = user
    if role != 'admin':
        raise HTTPException(status_code=403, detail="Admins only")

    contents = await file.read()
    contents = await file.read()
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as f:
        f.write(contents)

    openai_file = None  # Initialize openai_file
    try:
        openai_file = openai_client.files.create(
            file=open(temp_filename, "rb"),
            purpose="assistants"
        )
    except Exception as e:
        # Clean up temp file if OpenAI call fails
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        logger.error(f"OpenAI file creation failed for {file.filename}. Error: {repr(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI file creation failed: {str(e)}")
    
    # Remove temp file after successful OpenAI upload or if it still exists
    if os.path.exists(temp_filename):
        os.remove(temp_filename)

    # Ensure openai_file is not None before proceeding
    if not openai_file or not openai_file.id:
        # This case should ideally be caught by the previous try-except,
        # but as a safeguard:
        logger.error(f"OpenAI file object or ID is missing after creation attempt for {file.filename}.")
        raise HTTPException(status_code=500, detail="Failed to obtain a valid OpenAI file ID after upload.")

    logger.info(f"Admin {user_id}: Successfully uploaded file {file.filename} to OpenAI, OpenAI file ID: {openai_file.id}")

    doc = {
        "user_id": ObjectId(user_id),
        "filename": file.filename,
        "openai_file_id": openai_file.id,
        "created_at": datetime.utcnow()
    }

    try:
        result = await db.documents.insert_one(doc)
        logger.info(f"Admin {user_id}: Successfully saved metadata for OpenAI file {openai_file.id} to DB, doc ID: {result.inserted_id}")
        return DocumentOut(
            id=str(result.inserted_id), 
            filename=file.filename, 
            openai_file_id=openai_file.id, 
            uploaded_at=doc['created_at']
        )
    except Exception as e:
        logger.error(f"Database insert_one failed for {file.filename} after OpenAI upload {openai_file.id}. DB Exception: {repr(e)}")
        # Attempt to delete the orphaned OpenAI file
        try:
            logger.info(f"Attempting to delete orphaned OpenAI file {openai_file.id} due to DB storage failure.")
            await asyncio.to_thread(openai_client.files.delete, openai_file.id) # Use asyncio.to_thread for sync call
            logger.info(f"Successfully deleted orphaned OpenAI file {openai_file.id}.")
            raise HTTPException(status_code=500, detail=f"File uploaded to OpenAI (ID: {openai_file.id}), but failed to save to database. OpenAI file has been cleaned up.")
        except Exception as cleanup_e:
            logger.critical(f"CRITICAL: Failed to delete orphaned OpenAI file {openai_file.id} after DB storage failure. Cleanup Exception: {repr(cleanup_e)}")
            raise HTTPException(status_code=500, detail=f"File uploaded to OpenAI (ID: {openai_file.id}), but failed to save to database. CRITICAL: Failed to clean up OpenAI file. Please report OpenAI file ID: {openai_file.id}.")

@router.get("/list", response_model=list[DocumentOut])
async def list_docs(user=Depends(get_current_user)):
    _, role = user
    if role != 'admin':
        raise HTTPException(status_code=403, detail="Admins only")

    cursor = db.documents.find()
    docs = []
    async for doc in cursor:
        docs.append(DocumentOut(
            id=str(doc['_id']),
            filename=doc['filename'],
            openai_file_id=doc['openai_file_id'],
            uploaded_at=doc['created_at']
        ))
    return docs

@router.delete("/{doc_id}")
async def delete_doc(doc_id: str, user=Depends(get_current_user)):
    _, role = user
    if role != 'admin':
        raise HTTPException(status_code=403, detail="Admins only")

    doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    openai_client.files.delete(doc['openai_file_id'])
    await db.documents.delete_one({"_id": ObjectId(doc_id)})
    return {"detail": "Deleted"}


@router.get("/uploads/islamic_agent/list")
async def list_islamic_agent_files():
    try:
        files = [f.name for f in UPLOAD_DIR.iterdir() if f.is_file()]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading files: {str(e)}")
    
@router.get("/get-docx-file")
async def get_docx_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    logger.info(f"File path: {file_path}")
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )
    
@router.get("/openai-files", response_model=list[dict])
async def list_openai_files():
 
    try:
        files = openai_client.files.list()
        return [{"id": f.id, "filename": f.filename, "createdAt": f.created_at} for f in files.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

@router.get("/openai-files/{file_id}/content", response_class=PlainTextResponse)
async def get_openai_file_content(file_id: str):

    try:
        response = openai_client.files.content(file_id)
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI content error: {str(e)}")

@router.delete("/openai-files/{doc_id}")
async def delete_openai_file(doc_id: str, user=Depends(get_current_user)):
    _, role, email = user
    if role != 'admin':
        raise HTTPException(status_code=403, detail="Admins only")

    try:
        openai_client.files.delete(doc_id)
    except Exception as e:
        logger.error(f"Failed to delete OpenAI file: {e}")

    await db.documents.delete_one({"_id": doc_id})
    return {"detail": "File deleted successfully"}


@router.delete("/openai-files/bulk")
async def bulk_delete_openai_files(
    file_ids: list[str] = Body(...),
    user=Depends(get_current_user)
):
    _, role, email = user
    if role != 'admin':
        raise HTTPException(status_code=403, detail="Admins only")

    deleted = []
    failed = []

    for file_id in file_ids:
        try:
            # Attempt to delete from OpenAI
            openai_client.files.delete(file_id)
        except Exception as e:
            logger.warning(f"Failed to delete file from OpenAI: {file_id} — {e}")
            failed.append(file_id)
            continue

        # Attempt to remove from MongoDB
        result = await db.documents.delete_one({"openai_file_id": file_id})
        if result.deleted_count:
            deleted.append(file_id)
        else:
            failed.append(file_id)

    return {
        "deleted": deleted,
        "failed": failed,
        "total_requested": len(file_ids)
    }

    