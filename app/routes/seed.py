import os
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.db import db
from app.utils.auth import get_current_user

router = APIRouter(prefix="/dev", tags=["Dev Seed"])

@router.post("/seed")
async def seed_dev_data(user: str = Depends(get_current_user)):
    # Restrict seeding to superuser/dev only
    
    if os.getenv("ENV") == "production":
        raise HTTPException(403, "Seeding disabled in production")
    
    user = await db["users"].find_one({"_id": ObjectId(user[0])})
    if user["email"] != "admin@dcc.dev":
        raise HTTPException(status_code=403, detail="Not authorized to seed")

    # Insert organization
    org_id = ObjectId()
    head_id = ObjectId()
    user_ids = [ObjectId() for _ in range(3)]
    agent_ids = [ObjectId() for _ in range(2)]

    await db["organizations"].insert_one({
        "_id": org_id,
        "name": "DCC Research Org",
        "head_user_id": head_id,
        "usage_quota": {
            "total_limit": 100000,
            "used": 0,
            "reset_date": None
        },
        "agents": agent_ids
    })

    await db["users"].insert_many([
        {
            "_id": head_id,
            "email": "orghead@example.com",
            "password": "dev_hash",  # Set hashed password via your logic
            "role": "organization_head",
            "organization_id": org_id,
            "agent_id": None,
            "quota": {
                "monthly_limit": 10000,
                "used": 0,
                "reset_date": None
            }
        },
        *[
            {
                "_id": uid,
                "email": f"user{i+1}@example.com",
                "password": "dev_hash",
                "role": "organization_user",
                "organization_id": org_id,
                "agent_id": None,
                "quota": {
                    "monthly_limit": 5000,
                    "used": 0,
                    "reset_date": None
                }
            } for i, uid in enumerate(user_ids)
        ]
    ])

    await db["agents"].insert_many([
        {
            "_id": agent_ids[0],
            "name": "Agent Alpha",
            "organization_id": org_id,
            "created_by": head_id,
            "default_prompt": "You are a Quran AI assistant...",
            "files": []
        },
        {
            "_id": agent_ids[1],
            "name": "Agent Beta",
            "organization_id": org_id,
            "created_by": head_id,
            "default_prompt": "You are a Quran AI assistant...",
            "files": []
        }
    ])

    await db["quota_requests"].insert_many([
        {
            "user_id": str(user_ids[0]),
            "reason": "Need more tokens for project X",
            "status": "pending"
        },
        {
            "user_id": str(user_ids[1]),
            "reason": "Research quota expansion",
            "status": "pending"
        }
    ])

    return {"message": "✅ Dev seed successful"}
