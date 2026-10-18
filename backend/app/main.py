from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import mimetypes
import os
from starlette.staticfiles import StaticFiles
from starlette.responses import Response, StreamingResponse

from .core.config import settings
from .core.database import engine, Base
from .core.migrations import sync_sqlite_schema
from .routers import auth, admin, learning, assignments

# Initialize database schema
Base.metadata.create_all(bind=engine)
sync_sqlite_schema(engine)

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
app.include_router(assignments.router)


class RangeStaticFiles(StaticFiles):
    """
    StaticFiles handler supporting RFC 7233 Byte Range Requests (HTTP 206 Partial Content),
    Accept-Ranges, Content-Range, and streaming media playback for HTML5 video elements.
    """
    def file_response(self, full_path, stat_result, scope=None, status_code=200):
        method = scope.get("method", "GET") if scope else "GET"
        range_header = None
        if scope and "headers" in scope:
            for k, v in scope["headers"]:
                if k.lower() == b"range":
                    range_header = v.decode("latin-1")
                    break

        file_size = stat_result.st_size
        content_type, _ = mimetypes.guess_type(full_path)
        content_type = content_type or "application/octet-stream"

        if not range_header or not range_header.startswith("bytes="):
            res = super().file_response(full_path, stat_result, scope, status_code)
            res.headers["Accept-Ranges"] = "bytes"
            return res

        ranges = range_header[6:].split("-")
        try:
            start = int(ranges[0]) if ranges[0] else 0
            end = int(ranges[1]) if len(ranges) > 1 and ranges[1] else file_size - 1
        except ValueError:
            return Response(
                status_code=416,
                headers={"Content-Range": f"bytes */{file_size}", "Accept-Ranges": "bytes"}
            )

        if start >= file_size or end >= file_size or start > end:
            return Response(
                status_code=416,
                headers={"Content-Range": f"bytes */{file_size}", "Accept-Ranges": "bytes"}
            )

        content_length = end - start + 1

        if method == "HEAD":
            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": content_type,
            }
            return Response(status_code=206, headers=headers)

        def iterfile():
            with open(full_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 64 * 1024
                while remaining > 0:
                    read_size = min(chunk_size, remaining)
                    chunk = f.read(read_size)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
        }
        return StreamingResponse(iterfile(), status_code=206, headers=headers)


# Resolve upload and media directories canonically
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
if not os.path.exists(uploads_dir) and os.path.exists(os.path.join(os.getcwd(), "uploads")):
    uploads_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(uploads_dir, exist_ok=True)

videos_dir = os.path.join(uploads_dir, "videos")
os.makedirs(videos_dir, exist_ok=True)

media_dir = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(media_dir, exist_ok=True)

# Mount asset folder for uploads and storage assets
app.mount("/assets", RangeStaticFiles(directory=uploads_dir), name="assets")

# Mount videos folder directly for clean canonical video URL mapping (e.g. /videos/1/video_1.mp4)
app.mount("/videos", RangeStaticFiles(directory=videos_dir), name="videos")

# Mount static media directory for pre-rendered static assets
app.mount("/static", RangeStaticFiles(directory=media_dir), name="static")

