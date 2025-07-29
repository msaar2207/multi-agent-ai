from pydantic import BaseModel

class QueryInput(BaseModel):
    chat_id: str
    question: str

class AssistantResponse(BaseModel):
    reply: str

from typing import Optional

from typing import Optional, List # Ensure List is imported

class AssistantUpdate(BaseModel):
    name: Optional[str] = None
    instructions: Optional[str] = None
    file_ids: Optional[List[str]] = None # List of OpenAI File IDs
    model: Optional[str] = None # If model updates are allowed

from datetime import datetime # Import datetime

class OrgAssistantResponse(BaseModel):
    id: str # MongoDB _id
    name: str
    assistant_id: Optional[str] = None # OpenAI's actual assistant ID
    model_name: Optional[str] = None
    instructions: Optional[str] = None
    file_ids: List[str] = []
    created_at: Optional[datetime] = None
    organization_id: str

    class Config:
        from_attributes = True