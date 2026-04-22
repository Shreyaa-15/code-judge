from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, Submission
from auth import get_current_user
from typing import List
from pydantic import BaseModel

router = APIRouter()

class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    total_submissions: int
    successful: int
    success_rate: float

class SubmissionHistory(BaseModel):
    job_id: str
    language: str
    status: str
    execution_time: float
    created_at: str

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(db: Session = Depends(get_db)):
    # Get all submissions grouped by username
    rows = (
        db.query(Submission.username, Submission.status)
        .all()
    )

    # Aggregate in Python — simple and reliable
    stats = {}
    for row in rows:
        if row.username not in stats:
            stats[row.username] = {"total": 0, "successful": 0}
        stats[row.username]["total"] += 1
        if row.status == "success":
            stats[row.username]["successful"] += 1

    # Sort by successful submissions desc
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]["successful"], reverse=True)

    leaderboard = []
    for rank, (username, data) in enumerate(sorted_stats[:20], start=1):
        total = data["total"]
        successful = data["successful"]
        leaderboard.append(LeaderboardEntry(
            rank=rank,
            username=username,
            total_submissions=total,
            successful=successful,
            success_rate=round((successful / total * 100) if total > 0 else 0, 1),
        ))
    return leaderboard

@router.get("/history", response_model=List[SubmissionHistory])
def get_history(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    submissions = (
        db.query(Submission)
        .filter(Submission.user_id == current_user.id)
        .order_by(Submission.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        SubmissionHistory(
            job_id=s.job_id,
            language=s.language,
            status=s.status,
            execution_time=s.execution_time,
            created_at=s.created_at.isoformat(),
        )
        for s in submissions
    ]