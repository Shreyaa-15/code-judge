# Code Judge — Distributed Code Execution Engine

A production-grade, LeetCode-style code execution engine built from scratch.
Supports Python, C++, and Java with secure Docker sandboxing, async job queuing,
real-time WebSocket streaming, JWT authentication, plagiarism detection, and contest mode.

## Live Demo

> Register → Write code → Hit Run → See results stream live via WebSocket

## Features

- Multi-language support — Python 3.12, C++, Java 21
- Secure sandboxing — Docker containers with no network access, 128MB RAM cap, CPU limits, non-root user
- Async job queue — Redis + RQ worker pool, horizontally scalable
- Real-time streaming — WebSocket pushes execution status live to the browser
- JWT authentication — Register, login, protected endpoints
- Rate limiting — 10 submissions per minute per user
- Persistent storage — All submissions stored in PostgreSQL
- Leaderboard — Ranked by successful submissions and success rate
- Submission history — Full history per user
- Plagiarism detection — Winnowing algorithm (same technique as Stanford MOSS)
- Contest mode — Timed contests with per-problem leaderboard ranked by solve count and time
- One-command setup — `docker compose up --build`

## Architecture
Browser (React + Monaco Editor)
|
| HTTP + WebSocket
v
FastAPI (Python) --- JWT Auth --- Rate Limiting
|
v
Redis Queue (RQ)
|
v
Worker Pool -----> Docker Sandbox (no network, memory/CPU limits)
|                  |__ judge-python
|                  |__ judge-cpp
|                  |__ judge-java
v
PostgreSQL (users, submissions, contests)
|
v
WebSocket push back to browser

## Tech Stack

| Layer      | Technology                  |
|------------|-----------------------------|
| Frontend   | React, TypeScript, Monaco Editor |
| API        | FastAPI (Python 3.12)       |
| Queue      | Redis + RQ                  |
| Sandbox    | Docker                      |
| Database   | PostgreSQL 15               |
| Auth       | JWT (python-jose + bcrypt)  |
| Infra      | Docker Compose              |

## Running Locally

Prerequisites: Docker Desktop, Git

```bash
# Clone
git clone https://github.com/Shreyaa-15/code-judge.git
cd code-judge

# Build sandbox images
docker build -t judge-python ./sandboxes/python
docker build -t judge-cpp ./sandboxes/cpp
docker build -t judge-java ./sandboxes/java

# Start everything
docker compose up --build
```

Open http://localhost:3000

## Security Model

Each submission runs in a fresh Docker container with the following restrictions:

| Restriction        | Value                    |
|--------------------|--------------------------|
| Network            | Disabled                 |
| Memory             | 128MB max                |
| CPU                | 50% of one core          |
| Execution timeout  | 30 seconds               |
| User               | Non-root (uid 1000)      |
| Filesystem         | Read-only mount          |

## Plagiarism Detection

Uses the Winnowing algorithm — the same approach as Stanford MOSS:

1. Tokenize code and normalize all variable names to a placeholder
2. Generate k-grams (sequences of k tokens)
3. Hash each k-gram with MD5
4. Select fingerprints using a sliding window minimum
5. Compare fingerprint sets using Jaccard similarity

Similarity above 80% is flagged as high risk. Above 50% is flagged as suspicious.

## Scaling Workers

```bash
# Run 5 parallel workers
docker compose up --scale worker=5
```

## Project Structure
code-judge/
├── api/
│   ├── main.py              # FastAPI app entry point
│   ├── auth.py              # JWT utilities
│   ├── database.py          # SQLAlchemy models
│   ├── routes/
│   │   ├── submit.py        # Submit endpoint + WebSocket stream
│   │   ├── auth.py          # Register and login
│   │   ├── leaderboard.py   # Leaderboard and history
│   │   ├── plagiarism.py    # Plagiarism detection
│   │   └── contest.py       # Contest mode
│   └── worker/
│       ├── executor.py      # Docker sandbox runner
│       ├── tasks.py         # RQ task definitions
│       └── plagiarism.py    # Winnowing algorithm
├── sandboxes/
│   ├── python/Dockerfile
│   ├── cpp/Dockerfile
│   └── java/Dockerfile
├── frontend/                # React + TypeScript
└── docker-compose.yml       # One-command setup