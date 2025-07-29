from app.utils.auth import get_current_user
from fastapi import APIRouter, Depends
from app.schemas.usage import UsageStats
from app.utils.tracker import get_user_usage

router = APIRouter(prefix="/usage", tags=["usage"])

@router.get("/me", response_model=UsageStats)
async def usage_stats(user=Depends(get_current_user)):
    user_id, _ , email= user
    return await get_user_usage(user_id)

@router.get("/status")
async def usage_status(user=Depends(get_current_user)):
    user_id, _, _ = user
    return await get_user_usage(user_id)