from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime

class Footnote(BaseModel):
    reference: str
    arabic: str
    english: str

class ChatMessage(BaseModel):
    role: Literal['user', 'assistant']
    content: str
    footnotes: Optional[List[Footnote]] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class ChatCreate(BaseModel):
    title: Optional[str] = None

class ChatResponse(BaseModel):
    id: str
    title: str
    messages: List[ChatMessage]
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    thread_id: Optional[str] = None
