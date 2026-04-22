from worker.executor import run_code
from database import SessionLocal, Submission
import redis, json, os, time

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

def execute_code_task(job_id: str, code: str, language: str, stdin: str = ""):
    redis_client.setex(f"job:{job_id}", 300,
        json.dumps({"status": "running", "stdout": "", "stderr": ""}))

    start = time.time()
    result = run_code(code, language, stdin)
    execution_time = round(time.time() - start, 3)

    # Update Redis
    redis_client.setex(f"job:{job_id}", 300, json.dumps({
        "status": result["status"],
        "stdout": result["stdout"],
        "stderr": result["stderr"],
    }))

    # Update PostgreSQL permanently
    db = SessionLocal()
    try:
        submission = db.query(Submission).filter(Submission.job_id == job_id).first()
        if submission:
            submission.status = result["status"]
            submission.stdout = result["stdout"]
            submission.stderr = result["stderr"]
            submission.execution_time = execution_time
            db.commit()
    finally:
        db.close()