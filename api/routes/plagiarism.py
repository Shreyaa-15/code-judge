from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, Submission
from auth import get_current_user
from worker.plagiarism import similarity_score
from typing import List

router = APIRouter()

class PlagiarismResult(BaseModel):
    job_id_a: str
    job_id_b: str
    username_a: str
    username_b: str
    language: str
    similarity: float
    verdict: str

class CheckRequest(BaseModel):
    job_id: str  # Check this submission against all others

@router.post("/plagiarism/check", response_model=List[PlagiarismResult])
def check_plagiarism(
    payload: CheckRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get the target submission
    target = db.query(Submission).filter(
        Submission.job_id == payload.job_id
    ).first()

    if not target:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Get all other submissions in the same language
    others = db.query(Submission).filter(
        Submission.language == target.language,
        Submission.job_id != target.job_id,
        Submission.status == "success",
    ).all()

    results = []
    for other in others:
        score = similarity_score(target.code, other.code, target.language)

        if score > 0.3:  # Only report if > 30% similar
            if score >= 0.8:
                verdict = "🚨 HIGH - Likely plagiarized"
            elif score >= 0.5:
                verdict = "⚠️ MEDIUM - Suspicious"
            else:
                verdict = "ℹ️ LOW - Some similarity"

            results.append(PlagiarismResult(
                job_id_a=target.job_id,
                job_id_b=other.job_id,
                username_a=target.username,
                username_b=other.username,
                language=target.language,
                similarity=score,
                verdict=verdict,
            ))

    # Sort by similarity descending
    results.sort(key=lambda x: x.similarity, reverse=True)
    return results

@router.get("/plagiarism/scan", response_model=List[PlagiarismResult])
def scan_all(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scan all submissions for plagiarism pairs"""
    submissions = db.query(Submission).filter(
        Submission.status == "success"
    ).all()

    results = []
    checked = set()

    for i, sub_a in enumerate(submissions):
        for sub_b in submissions[i+1:]:
            if sub_a.language != sub_b.language:
                continue
            pair_key = tuple(sorted([sub_a.job_id, sub_b.job_id]))
            if pair_key in checked:
                continue
            checked.add(pair_key)

            score = similarity_score(sub_a.code, sub_b.code, sub_a.language)
            if score > 0.5:
                verdict = "🚨 HIGH" if score >= 0.8 else "⚠️ MEDIUM"
                results.append(PlagiarismResult(
                    job_id_a=sub_a.job_id,
                    job_id_b=sub_b.job_id,
                    username_a=sub_a.username,
                    username_b=sub_b.username,
                    language=sub_a.language,
                    similarity=score,
                    verdict=verdict,
                ))

    results.sort(key=lambda x: x.similarity, reverse=True)
    return results