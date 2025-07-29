from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.tasks.quota_reset import reset_quotas


def start_scheduler():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(reset_quotas, "cron", day=1, hour=0, minute=0)
    scheduler.start()
