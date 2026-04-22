from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.submit import router as submit_router
from routes.auth import router as auth_router
from routes.leaderboard import router as leaderboard_router
from database import init_db

app = FastAPI(
    title="Code Judge API",
    description="A distributed code execution engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

app.include_router(auth_router, prefix="/api/auth")
app.include_router(submit_router, prefix="/api")
app.include_router(leaderboard_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Code Judge API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}