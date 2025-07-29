from pydantic import BaseModel
from datetime import datetime
from typing import Dict, Optional


class UsageStats(BaseModel):
    """API schema representing a user's usage statistics."""

    tier: str
    token_usage_monthly: int
    message_count_monthly: int
    limits: Dict[str, int]
    reset_date: Optional[datetime]
