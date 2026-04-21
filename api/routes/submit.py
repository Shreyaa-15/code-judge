from fastapi import APIRouter, HTTPException
from models import SubmitRequest, SubmitResponse, JobResult
import redis
import json
import uuid
from rq import Queue

import os
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)
q = Queue(connection=redis_client)

router = APIRouter()

@router.post("/submit", response_model=SubmitResponse)
async def submit_code(payload: SubmitRequest):
    allowed = ["python", "cpp", "java"]
    if payload.language not in allowed:
        raise HTTPException(status_code=400, detail=f"Language must be one of {allowed}")

    if len(payload.code) > 50_000:
        raise HTTPException(status_code=400, detail="Code too long (max 50KB)")

    job_id = str(uuid.uuid4())

    # Store initial state in Redis
    redis_client.setex(
        f"job:{job_id}",
        300,
        json.dumps({"status": "queued", "stdout": "", "stderr": ""})
    )

    # Enqueue the job — worker picks this up asynchronously
    q.enqueue(
        'worker.tasks.execute_code_task',
        job_id,
        payload.code,
        payload.language,
        payload.stdin,
        job_timeout=30,
    )

    return SubmitResponse(job_id=job_id, status="queued")


@router.get("/result/{job_id}", response_model=JobResult)
async def get_result(job_id: str):
    data = redis_client.get(f"job:{job_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = json.loads(data)
    return JobResult(
        job_id=job_id,
        status=job["status"],
        stdout=job["stdout"],
        stderr=job["stderr"],
    )