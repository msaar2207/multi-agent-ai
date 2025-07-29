from typing import Optional
from pydantic import BaseModel

class QAResult(BaseModel):
    question: str
    answer: str
    source_file: Optional[str] = None
    source_paragraph: Optional[str] = None
    reference: Optional[str] = None
