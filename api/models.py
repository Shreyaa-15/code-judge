from pydantic import BaseModel
from typing import Optional

class SubmitRequest(BaseModel):
    code: str
    language: str  # "python", "cpp", "java"
    stdin: Optional[str] = ""

class SubmitResponse(BaseModel):
    job_id: str
    status: str

class JobResult(BaseModel):
    job_id: str
    status: str
    stdout: str
    stderr: str