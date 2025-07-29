from pydantic import BaseModel, Field
from typing import List, Optional

class AgentBase(BaseModel):
    name: str
    default_prompt: Optional[str] = "You are a Quran AI assistant. Use the provided files to answer questions accurately and respectfully."

class AgentCreate(AgentBase):
    organization_id: str
    created_by: str

class AgentResponse(AgentBase):
    id: str
    organization_id: str
    created_by: str
    files: List[str]
