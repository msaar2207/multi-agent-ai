from fastapi import APIRouter, Depends, HTTPException, Request
from bson import ObjectId
from datetime import datetime
from app.db import db
from app.utils.auth import verify_token, require_role
from app.utils.logger import logger

router = APIRouter(prefix="/admin/stats", tags=["Admin Stats"])

@router.get("/summary")
async def get_admin_summary(user_id: str = Depends(verify_token)):
    logger.debug("Fetching admin summary for user_id: %s", user_id)
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    users = await db["users"].find().to_list(length=1000)
    usage_docs = await db["usage"].find().to_list(length=1000)
    orgs = await db["organizations"].find().to_list(length=100)

    breakdown = {}
    for u in users:
        breakdown[u["role"]] = breakdown.get(u["role"], 0) + 1

    total_tokens = sum(u.get("token_usage_monthly", 0) for u in usage_docs)
    pending_requests = await db["quota_requests"].count_documents({"status": "pending"})

    return {
        "users_total": len(users),
        "users_breakdown": breakdown,
        "orgs_total": len(orgs),
        "tokens_used": total_tokens,
        "quota_requests_pending": pending_requests
    }

@router.get("/usage")
async def get_usage_breakdown(user_id: str = Depends(verify_token)):
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    orgs = await db["organizations"].find().to_list(length=100)
    org_map = {str(o["_id"]): o["name"] for o in orgs}
    user_list = await db["users"].find().to_list(length=1000)
    usage_docs = await db["usage"].find().to_list(length=1000)

    org_tokens = {}
    for u in user_list:
        uid = str(u["_id"])
        oid = str(u.get("organization_id"))
        usage = next((x for x in usage_docs if str(x["user_id"]) == uid), None)
        if usage:
            org_tokens[oid] = org_tokens.get(oid, 0) + usage.get("token_usage_monthly", 0)

    per_organization = [
        {"org": org_map.get(oid, "—"), "tokens": total}
        for oid, total in org_tokens.items()
    ]

    daily_usage = [
        {"date": f"2024-05-{day:02d}", "tokens": (200 + (day * 15)) % 600}
        for day in range(1, 31)
    ]

    return {
        "per_organization": per_organization,
        "daily_usage": daily_usage
    }

@router.get("/top-users")
async def get_top_users(user_id: str = Depends(verify_token)):
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    usage = await db["usage"].find().sort("token_usage_monthly", -1).limit(10).to_list(length=10)
    user_ids = [u["user_id"] for u in usage]
    users_map = {
        str(u["_id"]): u for u in await db["users"].find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}).to_list(length=100)
    }

    org_map = {
        str(o["_id"]): o["name"] for o in await db["organizations"].find().to_list(length=100)
    }

    return [
        {
            "email": users_map[str(u["user_id"])]["email"],
            "role": users_map[str(u["user_id"])]["role"],
            "organization": org_map.get(str(users_map[str(u["user_id"])].get("organization_id")), None),
            "tokens_used": u["token_usage_monthly"]
        }
        for u in usage if str(u["user_id"]) in users_map
    ]

@router.get("/quota-requests")
async def get_all_quota_requests(user_id: str = Depends(verify_token)):
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    requests = await db["quota_requests"].find({"status": "pending"}).to_list(length=100)
    user_ids = [ObjectId(req["user_id"]) for req in requests]
    users_map = {
        str(u["_id"]): u["email"] for u in await db["users"].find({"_id": {"$in": user_ids}}).to_list(length=100)
    }

    return [
        {
            "_id": str(r["_id"]),
            "user_email": users_map.get(r["user_id"], "Unknown"),
            "reason": r["reason"],
            "status": r["status"]
        }
        for r in requests
    ]

@router.patch("/quota-requests/update")
async def update_quota_request_status(req: Request, user_id: str = Depends(verify_token)):
    await require_role(user_id, ['admin'])
    body = await req.json()
    request_id = body.get("request_id")
    status = body.get("status")

    if status not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    await db["quota_requests"].update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": status}}
    )

    return {"message": f"Request {status}"}


@router.get("/quota-requests")
async def get_quota_requests(user_id: str = Depends(verify_token)):
    logger.info("Fetching quota requests")
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    requests = await db["quota_requests"].find().to_list(length=100)
    return requests


@router.get("/timeline")
async def get_usage_timeline(user_id: str = Depends(verify_token)):
    logger.info("Fetching usage timeline for admin")
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    pipeline = [
        {
            # Ensure timestamp exists and is a valid date type
            "$match": {
                "timestamp": { "$exists": True, "$type": "date" }
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": { "format": "%Y-%m-%d", "date": "$timestamp" }
                },
                "tokens": { "$sum": "$tokens_used" }
            }
        },
        { "$sort": { "_id": 1 } }
    ]

    usage_data = await db["usage"].aggregate(pipeline).to_list(length=100)
    return [{"date": entry["_id"], "tokens": entry["tokens"]} for entry in usage_data]


@router.get("/assistants")
async def get_assistant_stats(user_id: str = Depends(verify_token)):
    logger.info("Fetching assistant stats for admin")
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    orgs = await db["organizations"].find().to_list(None)
    users = await db["users"].find().to_list(None)
    assistants_data = await db["assistants"].find().to_list(None)

    user_map = {str(u["_id"]): u for u in users}

    stats = []
    for org in orgs:
        org_users = [u for u in users if u.get("organization_id") == str(org["_id"])]
        org_user_ids = {str(u["_id"]) for u in org_users}

        org_assistants = [a for a in assistants_data if str(a.get("user_id")) in org_user_ids]
        total_assistants = len(org_assistants)
        total_files = sum(len(a.get("file_ids", [])) for a in org_assistants)

        stats.append({
            "organization": org["name"],
            "assistant_count": total_assistants,
            "total_files": total_files,
        })

    return stats


@router.get("/billing-history")
async def get_billing_history(user_id: str = Depends(verify_token)):
    logger.info("Fetching billing history for admin")
    await require_role(user_id, ['admin'])
    # user = await db["users"].find_one({"_id": ObjectId(user_id)}) # No longer needed
    # if user["role"] != "admin": # No longer needed
    #     raise HTTPException(status_code=403)

    events = await db["billing_events"].find().sort("created", -1).to_list(100)
    orgs = await db["organizations"].find().to_list(None)
    org_map = {org.get("stripe_customer_id"): org.get("name", "Unknown Org") for org in orgs}

    results = []
    for event in events:
        customer_id = event.get("customer")
        results.append({
            "organization": org_map.get(customer_id, "Unknown Org"),
            "amount": round(event.get("amount_paid", 0) / 100, 2),
            "currency": event.get("currency", "usd").upper(),
            "status": event.get("status", "unknown"),
            "date": event.get("created", "")[:10]
        })

    return results
