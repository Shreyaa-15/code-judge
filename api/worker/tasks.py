from worker.executor import run_code
import redis
import json

import os
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

def execute_code_task(job_id: str, code: str, language: str, stdin: str = ""):
    """This function runs inside the RQ worker"""

    # Mark job as running
    redis_client.setex(
        f"job:{job_id}",
        300,  # expire after 5 minutes
        json.dumps({"status": "running", "stdout": "", "stderr": ""})
    )

    # Run the code in Docker sandbox
    result = run_code(code, language, stdin)

    # Store the result in Redis
    redis_client.setex(
        f"job:{job_id}",
        300,
        json.dumps({
            "status": result["status"],
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        })
    )