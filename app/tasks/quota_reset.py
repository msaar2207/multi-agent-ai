from datetime import datetime
from app.db import db
from app.utils.logger import logger

async def reset_quotas():
    logger.info("🔁 Running monthly quota reset...")

    # Reset users
    await db["users"].update_many(
        {},
        {
            "$set": {
                "quota.used": 0,
                "quota.reset_date": datetime.utcnow()
            }
        }
    )

    # Reset organizations
    await db["organizations"].update_many(
        {},
        {
            "$set": {
                "usage_quota.used": 0,
                "usage_quota.reset_date": datetime.utcnow()
            }
        }
    )

    logger.info("✅ Quotas reset successfully.")
