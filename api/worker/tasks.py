from worker.executor import run_code
from database import SessionLocal, Submission
import redis, json, os, time
from database import SessionLocal, Submission, ContestSubmission

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

def execute_contest_task(
    job_id: str, code: str, language: str,
    test_input: str, expected_output: str,
    contest_id: int
):
    redis_client.setex(f"job:{job_id}", 300,
        json.dumps({"status": "running", "stdout": "", "stderr": ""}))

    start = time.time()
    result = run_code(code, language, test_input)
    execution_time = round(time.time() - start, 3)

    # Check if output matches expected
    actual = result["stdout"].strip()
    expected = expected_output.strip()
    passed = actual == expected and result["status"] == "success"
    final_status = "success" if passed else "wrong_answer"
    if result["status"] == "runtime_error":
        final_status = "runtime_error"

    redis_client.setex(f"job:{job_id}", 300, json.dumps({
        "status": final_status,
        "stdout": result["stdout"],
        "stderr": result["stderr"],
    }))

    db = SessionLocal()
    try:
        # Update contest submission
        sub = db.query(ContestSubmission).filter(
            ContestSubmission.job_id == job_id
        ).first()
        if sub:
            sub.status = final_status
            sub.execution_time = execution_time
            db.commit()
    finally:
        db.close()