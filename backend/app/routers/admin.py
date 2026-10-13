from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
import uuid
from datetime import datetime, timezone

from ..core.database import get_db
from ..core.security import require_roles, get_current_user
from ..core.config import settings
from ..models.models import (
    Textbook, Chapter, Topic, Subtopic, VideoUnit, Quiz, Question,
    User, SystemSettings, PipelineStatus, ReviewStatus, Role
)
from ..schemas.schemas import (
    TextbookOut, PipelineTriggerOut, PipelineStatusOut, HierarchyOut,
    ReviewItemOut, ReviewDetailOut, ApprovalIn, ApprovalOut,
    UserCreate, UserOut, SettingsOut, SettingsIn,
    ChapterHierarchyOut, TopicHierarchyOut, SubtopicOut
)
from ..services.pipeline_service import run_stages_1_to_5
from ..core.security import hash_pw

router = APIRouter(prefix="/admin", tags=["Admin Portal"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 1. POST /admin/textbooks (PDF Textbook Upload - FR-001, CON-001, SEC-FILE-001..004)
@router.post("/textbooks", response_model=TextbookOut, status_code=201)
async def upload_textbook(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    # MIME and Extension validation (SEC-FILE-001)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported (CON-001, SEC-FILE-001)")
    
    # Check content_type if provided
    if file.content_type and "pdf" not in file.content_type.lower():
        raise HTTPException(status_code=415, detail="Unsupported media type. Must be application/pdf")

    # Read content to check magic bytes & file size (SEC-FILE-002, SEC-FILE-003)
    content = await file.read()
    file_size = len(content)

    max_bytes = settings.max_upload_mb * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {settings.max_upload_mb}MB")

    # Check magic bytes (%PDF-)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF format: magic bytes %PDF- missing")

    # Safe storage (SEC-FILE-003, SEC-FILE-007)
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    textbook = Textbook(
        title=title,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        status=PipelineStatus.uploaded,
        stage=0,
        stages_log=[]
    )
    db.add(textbook)
    db.commit()
    db.refresh(textbook)
    return textbook

# 2. POST /admin/textbooks/{id}/pipeline (Trigger AI Processing Pipeline Stages 1-5)
@router.post("/textbooks/{id}/pipeline", response_model=PipelineTriggerOut)
def trigger_pipeline(
    id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")

    textbook.status = PipelineStatus.processing
    db.commit()

    # Trigger Stages 1 to 5 asynchronously in background
    background_tasks.add_task(run_stages_1_to_5, db, textbook.id)

    task_id = f"task-pipe-{uuid.uuid4().hex[:8]}"
    return PipelineTriggerOut(
        task_id=task_id,
        textbook_id=textbook.id,
        status="processing",
        message="AI processing pipeline (Stages 1–5) triggered successfully"
    )

# 3. GET /admin/textbooks/{id}/status (Retrieve Pipeline Status)
@router.get("/textbooks/{id}/status", response_model=PipelineStatusOut)
def get_pipeline_status(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")
    return PipelineStatusOut(
        textbook_id=textbook.id,
        status=textbook.status.value,
        stage=textbook.stage,
        stages_log=textbook.stages_log or []
    )

# 4. GET /admin/textbooks/{id}/hierarchy (Retrieve Extracted Content Hierarchy - FR-003)
@router.get("/textbooks/{id}/hierarchy", response_model=HierarchyOut)
def get_hierarchy(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")

    chapters_out = []
    for ch in textbook.chapters:
        topics_out = []
        for top in ch.topics:
            subtopics_out = [
                SubtopicOut(id=sub.id, title=sub.title, order_idx=sub.order_idx)
                for sub in top.subtopics
            ]
            topics_out.append(TopicHierarchyOut(
                id=top.id,
                title=top.title,
                order_idx=top.order_idx,
                subtopics=subtopics_out
            ))
        chapters_out.append(ChapterHierarchyOut(
            id=ch.id,
            title=ch.title,
            order_idx=ch.order_idx,
            topics=topics_out
        ))

    return HierarchyOut(
        textbook_id=textbook.id,
        title=textbook.title,
        chapters=chapters_out
    )

# 5. GET /admin/review/items (List Items Awaiting Review - FR-007, CON-002)
@router.get("/review/items", response_model=List[ReviewItemOut])
def list_review_items(
    status: Optional[str] = "pending_review",
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    rev_status = ReviewStatus(status) if status in [s.value for s in ReviewStatus] else ReviewStatus.pending_review
    
    items = []
    # Video units
    videos = db.query(VideoUnit).filter(VideoUnit.review_status == rev_status).all()
    for v in videos:
        items.append(ReviewItemOut(
            id=v.id,
            type="video",
            item_id=v.id,
            title=v.title,
            topic_title=v.topic.title if v.topic else None,
            review_status=v.review_status.value,
            created_at=v.created_at
        ))
    
    # Quizzes
    quizzes = db.query(Quiz).filter(Quiz.review_status == rev_status).all()
    for q in quizzes:
        items.append(ReviewItemOut(
            id=q.id,
            type="quiz",
            item_id=q.id,
            title=q.title,
            topic_title=q.topic.title if q.topic else None,
            review_status=q.review_status.value,
            created_at=q.created_at
        ))

    return items

# 6. GET /admin/review/items/{id} (Inspect Generated Item)
# Format {id} can be item_id with ?type=video|quiz or by integer id check
@router.get("/review/items/{id}", response_model=ReviewDetailOut)
def get_review_item(
    id: int,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    target_type = type.lower() if type else None
    if target_type == "video" or (target_type is None and db.get(VideoUnit, id)):
        v = db.get(VideoUnit, id)
        if not v:
            raise HTTPException(status_code=404, detail="Video unit not found")
        return ReviewDetailOut(
            id=v.id,
            type="video",
            item_id=v.id,
            title=v.title,
            topic_title=v.topic.title if v.topic else None,
            review_status=v.review_status.value,
            script_text=v.script_text,
            video_url=v.video_url,
            duration_seconds=v.duration_seconds,
            created_at=v.created_at
        )
    elif target_type == "quiz" or (target_type is None and db.get(Quiz, id)):
        q = db.get(Quiz, id)
        if not q:
            raise HTTPException(status_code=404, detail="Quiz not found")
        questions_data = [
            {"id": qu.id, "stem": qu.stem, "options": qu.options, "correct_idx": qu.correct_idx, "objective": qu.objective}
            for qu in q.questions
        ]
        return ReviewDetailOut(
            id=q.id,
            type="quiz",
            item_id=q.id,
            title=q.title,
            topic_title=q.topic.title if q.topic else None,
            review_status=q.review_status.value,
            questions=questions_data,
            created_at=q.created_at
        )
    else:
        raise HTTPException(status_code=404, detail="Review item not found")

# 7. POST /admin/review/items/{id}/approval (Admin Approval & Publishing Gate - FR-007, CON-002, ARCH-V-004)
@router.post("/review/items/{id}/approval", response_model=ApprovalOut)
def approve_item(
    id: int,
    payload: ApprovalIn,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    if payload.decision not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid decision; must be 'approve' or 'reject'")

    new_status = ReviewStatus.published if payload.decision == "approve" else ReviewStatus.rejected
    target_type = type.lower() if type else None

    # Check video
    if target_type == "video" or (target_type is None and db.get(VideoUnit, id)):
        v = db.get(VideoUnit, id)
        if not v:
            raise HTTPException(status_code=404, detail="Video unit not found")
        v.review_status = new_status
        db.commit()
        return ApprovalOut(
            id=v.id,
            type="video",
            item_id=v.id,
            status=v.review_status.value,
            approved_at=datetime.now(timezone.utc)
        )
    # Check quiz
    elif target_type == "quiz" or (target_type is None and db.get(Quiz, id)):
        q = db.get(Quiz, id)
        if not q:
            raise HTTPException(status_code=404, detail="Quiz not found")
        q.review_status = new_status
        db.commit()
        return ApprovalOut(
            id=q.id,
            type="quiz",
            item_id=q.id,
            status=q.review_status.value,
            approved_at=datetime.now(timezone.utc)
        )
    else:
        raise HTTPException(status_code=404, detail="Review item not found")

# 8. GET /admin/users & POST /admin/users (User Management - FR-008)
@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    return db.query(User).all()

@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        user_role = Role(user_in.role.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {[r.value for r in Role]}")

    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_pw(user_in.password),
        role=user_role,
        linked_student_id=user_in.linked_student_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# 9. GET /admin/settings/thresholds & PUT /admin/settings/thresholds (Settings - FR-009)
@router.get("/settings/thresholds", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    s = db.query(SystemSettings).first()
    if not s:
        s = SystemSettings(mastery_threshold=80.0, adaptive_per_weak=3)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

@router.put("/settings/thresholds", response_model=SettingsOut)
def update_settings(
    s_in: SettingsIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    if not (0.0 <= s_in.mastery_threshold <= 100.0):
        raise HTTPException(status_code=400, detail="Mastery threshold must be between 0 and 100")
    if s_in.adaptive_per_weak < 1 or s_in.adaptive_per_weak > 10:
        raise HTTPException(status_code=400, detail="Adaptive questions per weak concept must be between 1 and 10")

    s = db.query(SystemSettings).first()
    if not s:
        s = SystemSettings()
        db.add(s)
    s.mastery_threshold = s_in.mastery_threshold
    s.adaptive_per_weak = s_in.adaptive_per_weak
    db.commit()
    db.refresh(s)
    return s
