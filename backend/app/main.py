from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os

from .core.config import settings
from .core.database import engine, Base
from .routers import auth, admin, learning

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI-Powered Textbook-to-Video Learning & Student Performance Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Policy: Supports admin.example.com and learn.example.com as well as local development ports (SEC-API-004)
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://admin.example.com",
    "https://learn.example.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive in local dev, configurable via settings in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoints per Deployment Spec Sec 13.2
@app.get("/health/liveness", tags=["Health"])
def liveness():
    return {"status": "ok", "service": "liveness"}

@app.get("/health/readiness", tags=["Health"])
def readiness():
    # Verify database connection
    try:
        with engine.connect() as conn:
            conn.execute(Base.metadata.tables["users"].select().limit(1))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    return {"status": "ok" if "error" not in db_status else "degraded", "database": db_status}

# Mount routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(learning.router)

# Mount asset folder if exists
static_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(static_dir, exist_ok=True)
app.mount("/assets", StaticFiles(directory=static_dir), name="assets")

# Mount static media directory for pre-rendered video assets (NFR-002, ARCH-V-005)
media_dir = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(media_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=media_dir), name="static")
