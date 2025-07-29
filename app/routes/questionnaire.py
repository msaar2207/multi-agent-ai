from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from bson import ObjectId
from app.utils.logger import logger
from openai import OpenAI
from typing import Dict, List
from app.config import settings

from app.db import db
from app.utils.auth import get_current_user
from app.services.questionnaire import (
    process_questionnaire,
    process_questionnaire_rag,
    generate_docx,
    generate_pdf,
)
from app.schemas.questionnaire import QAResult

router = APIRouter(prefix="/questionnaire", tags=["questionnaire"])
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


async def _role_check(user, org_id: str):
    user_id, role, _ = user
    if role == "admin":
        return
    if role == "organization_head":
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if user_doc and str(user_doc.get("organization_id")) == org_id:
            return
    raise HTTPException(status_code=403, detail="Access denied")


@router.post("/process/{org_id}")
async def process_questions(
    org_id: str, file: UploadFile = File(...), user=Depends(get_current_user)
):
    # await _role_check(user, org_id)
    # logger.info(f"Processing questions for org_id: {org_id}, user_id: {user[0]}")

    file_bytes = await file.read()

    assistant = await db.assistants.find_one({"org_id": ObjectId(org_id)})
    if not assistant or not assistant.get("vector_store_id"):
        logger.error(f"No assistant or vector store found for org_id: {org_id}")
        raise HTTPException(status_code=400, detail="Organization has no vector store")
    vector_store_id = assistant["vector_store_id"]

    file_map: Dict[str, str] = {}
    docs_cursor = db.documents.find({"organization_id": org_id})
    async for doc in docs_cursor:
        fid = doc.get("openai_file_id")
        if fid:
            file_map[fid] = doc.get("filename", fid)

    try:
        results = await process_questionnaire_rag(
            file_bytes,
            file.filename,
            vector_store_id,
            file_map,
            openai_client,
        )
    except ValueError as e:
        logger.error(f"Error processing questions for org_id: {org_id}, error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    logger.info(f"Successfully processed questions for org_id: {org_id}")
    return {"results": results}


@router.post("/process/{org_id}/docx")
async def process_questions_docx(
    org_id: str,
    results: List[QAResult] = Body(...),
    user=Depends(get_current_user),
):
    # await _role_check(user, org_id)
    logger.info(
        f"Generating DOCX export for org_id: {org_id}, user_id: {user[0]}"
    )

    data = generate_docx([r.dict() for r in results])

    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=answers.docx"},
    )


@router.post("/process/{org_id}/pdf")
async def process_questions_pdf(
    org_id: str,
    results: List[QAResult] = Body(...),
    user=Depends(get_current_user),
):
    # await _role_check(user, org_id)
    logger.info(
        f"Generating PDF export for org_id: {org_id}, user_id: {user[0]}"
    )

    data = generate_pdf([r.dict() for r in results])

    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=answers.pdf"},
    )