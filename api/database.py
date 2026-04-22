from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://judge:judgepass@localhost:5432/codejudge")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    username = Column(String, nullable=False)
    language = Column(String, nullable=False)
    code = Column(Text, nullable=False)
    status = Column(String, default="queued")
    stdout = Column(Text, default="")
    stderr = Column(Text, default="")
    execution_time = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Contest(Base):
    __tablename__ = "contests"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, default="")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    problems = Column(JSON, default=list)
    created_by = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ContestSubmission(Base):
    __tablename__ = "contest_submissions"
    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, nullable=False)
    job_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, nullable=False)
    username = Column(String, nullable=False)
    problem_id = Column(String, nullable=False)
    language = Column(String, nullable=False)
    code = Column(Text, nullable=False)
    status = Column(String, default="queued")
    execution_time = Column(Float, default=0.0)
    submitted_at = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)