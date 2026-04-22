from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, Submission
from auth import get_current_user
from models import SubmitResponse, JobResult
import redis, json, uuid, os
from rq import Queue

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)
q = Queue(connection=redis_client)

router = APIRouter()

class SubmitRequest(BaseModel):
    code: str
    language: str
    stdin: Optional[str] = ""

@router.post("/submit", response_model=SubmitResponse)
async def submit_code(
    payload: SubmitRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = ["python", "cpp", "java"]
    if payload.language not in allowed:
        raise HTTPException(status_code=400, detail=f"Language must be one of {allowed}")
    if len(payload.code) > 50_000:
        raise HTTPException(status_code=400, detail="Code too long (max 50KB)")

    # Rate limiting — max 10 submissions per minute per user
    recent_key = f"rate:{current_user.id}"
    recent = redis_client.incr(recent_key)
    if recent == 1:
        redis_client.expire(recent_key, 60)
    if recent > 10:
        raise HTTPException(status_code=429, detail="Too many submissions. Wait a minute.")

    job_id = str(uuid.uuid4())

    # Save to PostgreSQL
    submission = Submission(
        job_id=job_id,
        user_id=current_user.id,
        username=current_user.username,
        language=payload.language,
        code=payload.code,
        status="queued",
    )
    db.add(submission)
    db.commit()

    # Store in Redis for fast polling
    redis_client.setex(f"job:{job_id}", 300, json.dumps({
        "status": "queued", "stdout": "", "stderr": ""
    }))

    # Enqueue job
    q.enqueue(
        'worker.tasks.execute_code_task',
        job_id, payload.code, payload.language, payload.stdin,
        job_timeout=30,
    )

    return SubmitResponse(job_id=job_id, status="queued")


@router.get("/result/{job_id}", response_model=JobResult)
async def get_result(job_id: str, db: Session = Depends(get_db)):
    data = redis_client.get(f"job:{job_id}")
    if data:
        job = json.loads(data)
        return JobResult(job_id=job_id, **job)

    # Fallback to DB if Redis TTL expired
    submission = db.query(Submission).filter(Submission.job_id == job_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResult(
        job_id=job_id,
        status=submission.status,
        stdout=submission.stdout,
        stderr=submission.stderr,
    )

    from fastapi import WebSocket, WebSocketDisconnect
import asyncio

@router.websocket("/ws/{job_id}")
async def stream_result(websocket: WebSocket, job_id: str):
    await websocket.accept()
    
    try:
        # Stream status updates until job is complete
        for _ in range(60):  # max 60 seconds
            data = redis_client.get(f"job:{job_id}")
            
            if not data:
                await websocket.send_json({"status": "not_found"})
                break
            
            job = json.loads(data)
            await websocket.send_json(job)
            
            # If job is finished, close connection
            if job["status"] not in ("queued", "running"):
                break
                
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()