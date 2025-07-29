# models/assistant.py

from pydantic import BaseModel, Field
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

class AssistantModel(BaseModel):
    id: Optional[str] = Field(alias="_id")
    name: str
    org_id: str
    created_by: str
    instructions: Optional[str] = "You are a Quran AI assistant..."
    file_ids: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    usage_limit: Optional[int] = None
