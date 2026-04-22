from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db, Contest, ContestSubmission, Submission
from auth import get_current_user
from worker.executor import run_code
import uuid, redis, json, os
from rq import Queue

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)
q = Queue(connection=redis_client)

router = APIRouter()

# ---------- Pydantic schemas ----------

class Problem(BaseModel):
    id: str
    title: str
    description: str
    sample_input: str
    sample_output: str
    test_input: str
    test_output: str

class CreateContestRequest(BaseModel):
    name: str
    description: str
    start_time: datetime
    end_time: datetime
    problems: List[Problem]

class ContestResponse(BaseModel):
    id: int
    name: str
    description: str
    start_time: datetime
    end_time: datetime
    problems: list
    created_by: str
    is_active: bool
    status: str  # "upcoming", "live", "ended"

class ContestSubmitRequest(BaseModel):
    contest_id: int
    problem_id: str
    code: str
    language: str

class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    solved: int
    total_time_seconds: float
    submissions: int

# ---------- Helper ----------

def contest_status(c: Contest) -> str:
    now = datetime.utcnow()
    if now < c.start_time:
        return "upcoming"
    elif now > c.end_time:
        return "ended"
    return "live"

# ---------- Routes ----------

@router.post("/contests", response_model=ContestResponse)
def create_contest(
    payload: CreateContestRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.end_time <= payload.start_time:
        raise HTTPException(400, "End time must be after start time")

    contest = Contest(
        name=payload.name,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        problems=[p.dict() for p in payload.problems],
        created_by=current_user.username,
    )
    db.add(contest)
    db.commit()
    db.refresh(contest)

    return ContestResponse(
        **{c: getattr(contest, c) for c in [
            'id','name','description','start_time',
            'end_time','problems','created_by','is_active'
        ]},
        status=contest_status(contest)
    )

@router.get("/contests", response_model=List[ContestResponse])
def list_contests(db: Session = Depends(get_db)):
    contests = db.query(Contest).filter(Contest.is_active == True).all()
    return [
        ContestResponse(
            **{c: getattr(con, c) for c in [
                'id','name','description','start_time',
                'end_time','problems','created_by','is_active'
            ]},
            status=contest_status(con)
        )
        for con in contests
    ]

@router.get("/contests/{contest_id}", response_model=ContestResponse)
def get_contest(contest_id: int, db: Session = Depends(get_db)):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(404, "Contest not found")
    return ContestResponse(
        **{c: getattr(contest, c) for c in [
            'id','name','description','start_time',
            'end_time','problems','created_by','is_active'
        ]},
        status=contest_status(contest)
    )

@router.post("/contests/submit")
def contest_submit(
    payload: ContestSubmitRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contest = db.query(Contest).filter(Contest.id == payload.contest_id).first()
    if not contest:
        raise HTTPException(404, "Contest not found")
    if contest_status(contest) != "live":
        raise HTTPException(400, "Contest is not live")

    # Find the problem
    problem = next((p for p in contest.problems if p["id"] == payload.problem_id), None)
    if not problem:
        raise HTTPException(404, "Problem not found in contest")

    job_id = str(uuid.uuid4())

    # Save contest submission
    sub = ContestSubmission(
        contest_id=payload.contest_id,
        job_id=job_id,
        user_id=current_user.id,
        username=current_user.username,
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        status="queued",
    )
    db.add(sub)
    db.commit()

    # Store in Redis
    redis_client.setex(f"job:{job_id}", 300, json.dumps({
        "status": "queued", "stdout": "", "stderr": ""
    }))

    # Enqueue with test input
    q.enqueue(
        'worker.tasks.execute_contest_task',
        job_id,
        payload.code,
        payload.language,
        problem["test_input"],
        problem["test_output"],
        payload.contest_id,
        job_timeout=30,
    )

    return {"job_id": job_id, "status": "queued"}

@router.get("/contests/{contest_id}/leaderboard", response_model=List[LeaderboardEntry])
def contest_leaderboard(contest_id: int, db: Session = Depends(get_db)):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(404, "Contest not found")

    subs = db.query(ContestSubmission).filter(
        ContestSubmission.contest_id == contest_id,
        ContestSubmission.status == "success",
    ).all()

    # Aggregate: per user, per problem — only count first successful submission
    user_stats: dict = {}
    for sub in subs:
        if sub.username not in user_stats:
            user_stats[sub.username] = {"solved": set(), "total_time": 0.0, "submissions": 0}
        user_stats[sub.username]["submissions"] += 1
        if sub.problem_id not in user_stats[sub.username]["solved"]:
            user_stats[sub.username]["solved"].add(sub.problem_id)
            elapsed = (sub.submitted_at - contest.start_time).total_seconds()
            user_stats[sub.username]["total_time"] += elapsed

    # Sort: most solved first, then least time
    sorted_users = sorted(
        user_stats.items(),
        key=lambda x: (-len(x[1]["solved"]), x[1]["total_time"])
    )

    return [
        LeaderboardEntry(
            rank=i + 1,
            username=username,
            solved=len(data["solved"]),
            total_time_seconds=round(data["total_time"], 1),
            submissions=data["submissions"],
        )
        for i, (username, data) in enumerate(sorted_users)
    ]