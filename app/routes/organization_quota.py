from app.utils.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from bson import ObjectId
from app.db import db

router = APIRouter(prefix="/org/quota-requests", tags=["Quota Requests"])

def get_collection(name: str):
    return db[name]

@router.get("/")
async def list_quota_requests(org_id: str, user_id: str = Depends(get_current_user)):
    # Get all users in the org
    user_docs = await get_collection("users").find({"organization_id": org_id}).to_list(length=200)
    user_ids = [str(u["_id"]) for u in user_docs]

    # Fetch quota requests from those users
    requests = await get_collection("quota_requests").find({
        "user_id": {"$in": user_ids},
        "status": "pending"
    }).to_list(length=100)

    return requests

@router.patch("/update")
async def update_quota_request_status(request: Request, user_id: str = Depends(get_current_user)):
    body = await request.json()
    request_id = body.get("request_id")
    status = body.get("status")

    if status not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    result = await get_collection("quota_requests").update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": status}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or already updated")

    return {"message": f"Request {status}"}
