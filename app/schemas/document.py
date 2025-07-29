from pydantic import BaseModel
from datetime import datetime

class DocumentOut(BaseModel):
    id: str
    filename: str
    openai_file_id: str
    uploaded_at: datetime

from typing import Optional

class OrgDocumentResponse(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime
    openai_file_id: Optional[str] = None
    uploaded_by_user_id: Optional[str] = None
    uploader_name: Optional[str] = None
    organization_id: str

    class Config:
        from_attributes = True # Replaces orm_mode in Pydantic v2