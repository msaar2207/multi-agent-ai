from app.db import db
from bson import ObjectId
from datetime import datetime
from app.config import settings
from fastapi import HTTPException

DEFAULT_LIMITS = settings.DEFAULT_LIMITS

async def increment_token_usage(user_id: str, tokens_used: int):
    now = datetime.utcnow()
    month_key = now.strftime("%Y-%m")
    usage_record = await db.usage.find_one({"user_id": ObjectId(user_id)})
    total = usage_record.get("monthly", {}).get(month_key, 0) if usage_record else 0

    if total + tokens_used > settings.MAX_MONTHLY_TOKENS:
        raise HTTPException(status_code=403, detail="Monthly token limit exceeded.")

    await db.usage.update_one(
        {"user_id": ObjectId(user_id)},
        {
            "$inc": {"total_tokens": tokens_used, f"monthly.{month_key}": tokens_used}
        },
        upsert=True
    )

async def get_user_usage(user_id: str):
    # Fetch user profile to determine subscription tier
    user_profile = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_profile:
        return {
            "tier": "free",
            "token_usage_monthly": 0,
            "message_count_monthly": 0,
            "limits": DEFAULT_LIMITS["free"],
            "reset_date": None
        }

    tier = user_profile.get("tier", "free")
    limits = DEFAULT_LIMITS.get(tier, DEFAULT_LIMITS["free"])

    # Fetch usage document or return default if not found
    usage = await db.usage.find_one({"user_id": user_id})
    if not usage:
        return {
            "tier": tier,
            "token_usage_monthly": 0,
            "message_count_monthly": 0,
            "limits": limits,
            "reset_date": None
        }

    return {
        "tier": tier,
        "token_usage_monthly": usage.get("token_usage_monthly", 0),
        "message_count_monthly": usage.get("message_count_monthly", 0),
        "limits": usage.get("limits", limits),
        "reset_date": usage.get("last_reset")
    }