from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.submit import router as submit_router

app = FastAPI(
    title="Code Judge API",
    description="A distributed code execution engine",
    version="0.1.0",
)

# Allow requests from our React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(submit_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Code Judge API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}