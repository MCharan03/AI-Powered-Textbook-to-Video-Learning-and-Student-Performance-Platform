from app.models.models import utcnow
import os
import math
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Union, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import require_roles, get_current_user, hash_pw
from ..core.config import settings
from ..core.storage import get_storage
from ..models.models import (
    Textbook, Chapter, Topic, Subtopic, Video, Quiz, Question,
    User, Student, Parent, Teacher, StudentParent, TeacherStudent,
    StudentSubject, Subject, ProcessingJob, SystemSettings,
    PipelineStatus, ReviewStatus, Role, VideoStatus
)
from ..schemas.schemas import (
    TextbookOut, TextbookListItemOut, TextbookDetailOut,
    PipelineTriggerOut, PipelineStatusOut, HierarchyOut,
    ReviewItemOut, ReviewDetailOut, ApprovalIn, ApprovalOut,
    UserCreate, UserOut, SettingsOut, SettingsIn,
    ChapterHierarchyOut, TopicHierarchyOut, SubtopicOut,
    SubjectCreate, SubjectOut, SubjectUpdate, SubjectDetailOut,
    PaginatedResponse, StudentCreate, StudentUpdate, StudentOut, StudentDetailOut,
    ParentLinkOut, TeacherLinkOut, SubjectLinkOut, StudentLinkOut,
    ParentCreate, ParentUpdate, ParentOut, ParentDetailOut,
    TeacherCreate, TeacherUpdate, TeacherOut, TeacherDetailOut,
    StudentParentLinkIn, TeacherStudentLinkIn, StudentSubjectLinkIn,
    ChapterCreate, ChapterUpdate, ChapterOut, ChapterDetailOut,
    TopicCreate, TopicUpdate, TopicOut, TopicDetailOut,
    SubtopicCreate, SubtopicUpdate,
    ChapterPatch, TopicPatch, SubtopicPatch,
    RegenerationRequest, RegenerationComparisonOut,
    VideoPlanOut, VideoPlanPatch, VideoPlanRegenerationOut, VideoPlanGenerateRequest,
    ScriptOut, ScriptPatch, ScriptRegenerationPreview, ScriptGenerateRequest, ScriptSection,
    VideoRenderOut, VideoGenerationStatusOut, VideoGenerateRequest, VideoRegenerateRequest,
    VideoApproveRequest, VideoPublishRequest, SceneOut,
    AdminQuizOut, AdminQuestionOut, QuizGenerateRequest, QuizPatchRequest,
    QuestionPatchRequest, QuestionCreateRequest
)
from ..services.pipeline_service import (
    run_stages_1_to_5,
    run_textbook_ingestion_pipeline,
    regenerate_textbook_curriculum,
    approve_textbook_curriculum
)
from ..services.video_segmentation import VideoSegmentationService
from ..services.script_generation import ScriptService, AIProviderUnavailableError
from ..services.video_rendering import VideoGenerationService, get_tts_engine
from ..services.quiz_service import QuizService, QuizQuestionValidator

router = APIRouter(prefix="/admin", tags=["Admin Portal"])


# 1. POST /admin/textbooks (PDF Textbook Upload - FR-001, CON-001, SEC-FILE-001..004)
@router.post("/textbooks", response_model=TextbookOut, status_code=201)
async def upload_textbook(
    title: str = Form(...),
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    subject_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    # MIME and Extension validation (SEC-FILE-001)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported (CON-001, SEC-FILE-001)")

    if file.content_type and "pdf" not in file.content_type.lower():
        raise HTTPException(status_code=400, detail="Unsupported media type. Must be application/pdf")

    content = await file.read()
    file_size = len(content)

    max_bytes = settings.max_upload_mb * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {settings.max_upload_mb}MB")

    # Check magic bytes (%PDF-)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF format: magic bytes %PDF- missing")

    # Store via storage abstraction
    storage = get_storage()
    storage_key = storage.save_file(content, file.filename, folder="uploads")
    local_path = storage.get_local_path(storage_key)

    textbook = Textbook(
        title=title,
        description=description,
        original_filename=file.filename,
        filename=file.filename,
        storage_key=storage_key,
        file_path=local_path,
        file_size=file_size,
        subject_id=subject_id,
        uploaded_by=admin.id,
        status=PipelineStatus.uploaded,
        stage=0,
        stages_log=[]
    )
    db.add(textbook)
    db.flush()

    # Create processing job record
    job = ProcessingJob(
        textbook_id=textbook.id,
        job_type="TEXTBOOK_INGESTION",
        status="QUEUED",
        progress=0.0,
        current_stage="QUEUED",
        started_at=datetime.now(timezone.utc)
    )
    db.add(job)
    db.commit()
    db.refresh(textbook)
    return textbook


# 1b. GET /admin/textbooks (List all textbooks with counts and pipeline state)
@router.get("/textbooks", response_model=List[TextbookListItemOut])
def list_textbooks(
    title: Optional[str] = None,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Textbook)
    if title:
        query = query.filter(Textbook.title.ilike(f"%{title}%"))
    if subject_id:
        query = query.filter(Textbook.subject_id == subject_id)
    if status:
        query = query.filter(Textbook.status == status)

    textbooks = query.order_by(Textbook.created_at.desc()).all()
    results = []
    for tb in textbooks:
        status_val = tb.status.value if hasattr(tb.status, "value") else str(tb.status)
        subj = tb.subject
        uploader = tb.uploader

        job = db.query(ProcessingJob).filter(
            ProcessingJob.textbook_id == tb.id
        ).order_by(ProcessingJob.created_at.desc()).first()

        ch_count = len(tb.chapters)
        top_count = sum(len(c.topics) for c in tb.chapters)
        sub_count = sum(len(t.subtopics) for c in tb.chapters for t in c.topics)

        results.append(TextbookListItemOut(
            id=tb.id,
            title=tb.title,
            description=tb.description,
            subject_id=tb.subject_id,
            subject_name=subj.name if subj else None,
            original_filename=tb.original_filename or tb.filename,
            storage_key=tb.storage_key,
            status=status_val.upper(),
            current_stage=job.current_stage if job else ("QUEUED" if status_val == "queued" else None),
            progress=job.progress if job else (100.0 if status_val in ["completed", "approved", "published"] else 0.0),
            error_message=job.error_message if job else None,
            uploaded_by=tb.uploaded_by,
            uploaded_by_name=uploader.username if uploader else None,
            chapters_count=ch_count,
            topics_count=top_count,
            subtopics_count=sub_count,
            created_at=tb.created_at
        ))
    return results


# 1c. GET /admin/textbooks/{id} (Retrieve Textbook Detail)
@router.get("/textbooks/{id}", response_model=TextbookDetailOut)
def get_textbook(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    tb = db.get(Textbook, id)
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    status_val = tb.status.value if hasattr(tb.status, "value") else str(tb.status)
    subj = tb.subject
    uploader = tb.uploader

    job = db.query(ProcessingJob).filter(
        ProcessingJob.textbook_id == tb.id
    ).order_by(ProcessingJob.created_at.desc()).first()

    ch_count = len(tb.chapters)
    top_count = sum(len(c.topics) for c in tb.chapters)
    sub_count = sum(len(t.subtopics) for c in tb.chapters for t in c.topics)

    return TextbookDetailOut(
        id=tb.id,
        title=tb.title,
        description=tb.description,
        subject_id=tb.subject_id,
        subject_name=subj.name if subj else None,
        original_filename=tb.original_filename or tb.filename,
        storage_key=tb.storage_key,
        status=status_val.upper(),
        current_stage=job.current_stage if job else None,
        progress=job.progress if job else (100.0 if status_val in ["completed", "approved", "published"] else 0.0),
        error_message=job.error_message if job else None,
        uploaded_by=tb.uploaded_by,
        uploaded_by_name=uploader.username if uploader else None,
        chapters_count=ch_count,
        topics_count=top_count,
        subtopics_count=sub_count,
        created_at=tb.created_at,
        stages_log=tb.stages_log or []
    )


# 2a. POST /admin/textbooks/{id}/process (Trigger / Retry 7-Stage Curriculum Extraction Pipeline)
@router.post("/textbooks/{id}/process", response_model=PipelineTriggerOut)
def process_textbook(
    id: int,
    background_tasks: BackgroundTasks,
    sync: bool = Query(False, description="Run synchronously if True (ideal for testing)"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")

    job = db.query(ProcessingJob).filter(
        ProcessingJob.textbook_id == textbook.id
    ).order_by(ProcessingJob.created_at.desc()).first()

    if not job or job.status in ["COMPLETED", "FAILED"]:
        job = ProcessingJob(
            textbook_id=textbook.id,
            job_type="TEXTBOOK_INGESTION",
            status="QUEUED",
            progress=0.0,
            current_stage="QUEUED",
            started_at=datetime.now(timezone.utc)
        )
        db.add(job)
        db.commit()

    if sync:
        run_textbook_ingestion_pipeline(db, textbook.id, job.id)
    else:
        background_tasks.add_task(run_textbook_ingestion_pipeline, db, textbook.id, job.id)

    task_id = f"task-proc-{uuid.uuid4().hex[:8]}"
    return PipelineTriggerOut(
        task_id=task_id,
        textbook_id=textbook.id,
        status="processing",
        message="Textbook curriculum extraction pipeline (Stages 1–7) triggered successfully"
    )


# 2b. POST /admin/textbooks/{id}/pipeline (Legacy Compatibility)
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
    
    job = ProcessingJob(
        textbook_id=textbook.id,
        job_type="INGESTION",
        status="PROCESSING",
        progress=0.0,
        current_stage="Stage 1: PDF Ingestion & OCR",
        started_at=datetime.now(timezone.utc)
    )
    db.add(job)
    db.commit()

    background_tasks.add_task(run_stages_1_to_5, db, textbook.id)

    task_id = f"task-pipe-{uuid.uuid4().hex[:8]}"
    return PipelineTriggerOut(
        task_id=task_id,
        textbook_id=textbook.id,
        status="processing",
        message="AI processing pipeline (Stages 1–5) triggered successfully"
    )


# 3. GET /admin/textbooks/{id}/status (Retrieve Pipeline Status & Progress)
@router.get("/textbooks/{id}/status", response_model=PipelineStatusOut)
def get_pipeline_status(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")

    job = db.query(ProcessingJob).filter(
        ProcessingJob.textbook_id == textbook.id
    ).order_by(ProcessingJob.created_at.desc()).first()

    status_val = textbook.status.value if hasattr(textbook.status, "value") else str(textbook.status)
    return PipelineStatusOut(
        textbook_id=textbook.id,
        status=status_val,
        stage=textbook.stage,
        current_stage=job.current_stage if job else None,
        progress=job.progress if job else (100.0 if status_val in ["completed", "approved", "published"] else 0.0),
        error_message=job.error_message if job else None,
        stages_log=textbook.stages_log or []
    )


# 4. GET /admin/textbooks/{id}/hierarchy (Retrieve Extracted Content Hierarchy with Traceability)
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
                SubtopicOut(
                    id=sub.id,
                    topic_id=sub.topic_id,
                    title=sub.title,
                    description=sub.description,
                    sequence_number=sub.sequence_number,
                    order_idx=sub.order_idx,
                    created_at=sub.created_at,
                    updated_at=sub.updated_at
                )
                for sub in top.subtopics
            ]
            topics_out.append(TopicHierarchyOut(
                id=top.id,
                title=top.title,
                description=top.description,
                sequence_number=top.sequence_number,
                order_idx=top.order_idx,
                source_start_page=top.source_start_page,
                source_end_page=top.source_end_page,
                status=top.status,
                confidence_score=top.confidence_score,
                subtopics=subtopics_out
            ))
        chapters_out.append(ChapterHierarchyOut(
            id=ch.id,
            title=ch.title,
            description=ch.description,
            chapter_number=ch.chapter_number,
            order_idx=ch.order_idx,
            source_start_page=ch.source_start_page,
            source_end_page=ch.source_end_page,
            status=ch.status,
            confidence_score=ch.confidence_score,
            topics=topics_out
        ))

    status_val = textbook.status.value if hasattr(textbook.status, "value") else str(textbook.status)
    return HierarchyOut(
        textbook_id=textbook.id,
        title=textbook.title,
        status=status_val.upper(),
        subject_id=textbook.subject_id,
        subject_name=textbook.subject.name if textbook.subject else None,
        chapters=chapters_out
    )


# 4b. POST /admin/textbooks/{id}/approve (Approve Extracted Curriculum)
@router.post("/textbooks/{id}/approve")
def approve_curriculum_endpoint(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")

    approved_tb = approve_textbook_curriculum(db, id)
    status_str = approved_tb.status.value if hasattr(approved_tb.status, "value") else str(approved_tb.status)
    return {
        "textbook_id": approved_tb.id,
        "status": status_str.upper(),
        "message": "Curriculum successfully approved and published for learning pipeline"
    }


# 4c. POST /admin/textbooks/{id}/regenerate (Safe Curriculum Regeneration & Comparison)
@router.post("/textbooks/{id}/regenerate", response_model=RegenerationComparisonOut)
def regenerate_curriculum_endpoint(
    id: int,
    req: RegenerationRequest = RegenerationRequest(),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    textbook = db.get(Textbook, id)
    if not textbook:
        raise HTTPException(status_code=404, detail="Textbook not found")

    res = regenerate_textbook_curriculum(db, id, target=req.target)
    return RegenerationComparisonOut(
        textbook_id=res["textbook_id"],
        target=res["target"],
        current_curriculum=res["current_curriculum"],
        draft_curriculum=res["draft_curriculum"],
        comparison={
            "canonical_chapters_count": len(res.get("current_curriculum", [])),
            "extracted_chapters_count": len(res.get("draft_curriculum", [])),
            "current_curriculum": res.get("current_curriculum", []),
            "draft_curriculum": res.get("draft_curriculum", [])
        },
        message=res["message"]
    )


# 4d. PATCH /admin/chapters/{id} (Update Chapter in Review/Catalog)
@router.patch("/chapters/{id}", response_model=ChapterOut)
def patch_chapter(
    id: int,
    patch: ChapterPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    chapter = db.get(Chapter, id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if patch.title is not None:
        chapter.title = patch.title
    if patch.description is not None:
        chapter.description = patch.description
    if patch.chapter_number is not None:
        chapter.chapter_number = patch.chapter_number
        chapter.order_idx = patch.chapter_number
    if patch.source_start_page is not None:
        chapter.source_start_page = patch.source_start_page
    if patch.source_end_page is not None:
        chapter.source_end_page = patch.source_end_page

    db.commit()
    db.refresh(chapter)
    return chapter


# 4e. PATCH /admin/topics/{id} (Update Topic in Review/Catalog)
@router.patch("/topics/{id}", response_model=TopicOut)
def patch_topic(
    id: int,
    patch: TopicPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    topic = db.get(Topic, id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if patch.title is not None:
        topic.title = patch.title
    if patch.description is not None:
        topic.description = patch.description
    if patch.sequence_number is not None:
        topic.sequence_number = patch.sequence_number
        topic.order_idx = patch.sequence_number
    if patch.source_start_page is not None:
        topic.source_start_page = patch.source_start_page
    if patch.source_end_page is not None:
        topic.source_end_page = patch.source_end_page

    db.commit()
    db.refresh(topic)
    return topic


# 4f. PATCH /admin/subtopics/{id} (Update Subtopic in Review/Catalog)
@router.patch("/subtopics/{id}", response_model=SubtopicOut)
def patch_subtopic(
    id: int,
    patch: SubtopicPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subtopic = db.get(Subtopic, id)
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")

    if patch.title is not None:
        subtopic.title = patch.title
    if patch.description is not None:
        subtopic.description = patch.description
    if patch.sequence_number is not None:
        subtopic.sequence_number = patch.sequence_number
        subtopic.order_idx = patch.sequence_number
    if patch.source_start_page is not None:
        subtopic.source_start_page = patch.source_start_page
    if patch.source_end_page is not None:
        subtopic.source_end_page = patch.source_end_page

    db.commit()
    db.refresh(subtopic)
    return subtopic


# ==============================================================================
# BUILD 04: INTELLIGENT VIDEO SEGMENTATION & VIDEO PLANS
# ==============================================================================

def serialize_video_plan(v: Video) -> VideoPlanOut:
    topic = v.topic
    chapter = topic.chapter if topic else None
    subject = chapter.subject if chapter else None
    subtopic = v.subtopic

    return VideoPlanOut(
        id=v.id,
        title=v.title,
        description=v.description,
        topic_id=v.topic_id,
        topic_title=topic.title if topic else None,
        chapter_id=chapter.id if chapter else None,
        chapter_title=chapter.title if chapter else None,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        subtopic_id=v.subtopic_id,
        subtopic_title=subtopic.title if subtopic else None,
        sequence_number=v.sequence_number,
        duration_seconds=v.duration_seconds,
        estimated_duration_seconds=v.estimated_duration_seconds or v.duration_seconds,
        source_start_page=v.source_start_page,
        source_end_page=v.source_end_page,
        learning_objective=v.learning_objective,
        content_outline=v.content_outline or [],
        status=v.status.upper() if v.status else "REVIEW",
        created_at=v.created_at,
        updated_at=v.updated_at
    )


# 4g. POST /admin/topics/{topic_id}/video-plans/generate (Generate Video Plan for Topic)
@router.post("/topics/{topic_id}/video-plans/generate", response_model=List[VideoPlanOut])
def generate_topic_video_plan(
    topic_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        videos = VideoSegmentationService.generate_video_plan_for_topic(
            db=db,
            topic_id=topic_id,
            force_regenerate=force
        )
        return [serialize_video_plan(v) for v in videos]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 4h. POST /admin/chapters/{chapter_id}/video-plans/generate (Generate Video Plans for Chapter)
@router.post("/chapters/{chapter_id}/video-plans/generate", response_model=List[VideoPlanOut])
def generate_chapter_video_plans(
    chapter_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        videos = VideoSegmentationService.generate_video_plans_for_chapter(
            db=db,
            chapter_id=chapter_id,
            force_regenerate=force
        )
        return [serialize_video_plan(v) for v in videos]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 4i. POST /admin/textbooks/{textbook_id}/video-plans/generate (Generate Video Plans for Textbook)
@router.post("/textbooks/{textbook_id}/video-plans/generate", response_model=List[VideoPlanOut])
def generate_textbook_video_plans(
    textbook_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        videos = VideoSegmentationService.generate_video_plans_for_textbook(
            db=db,
            textbook_id=textbook_id,
            force_regenerate=force
        )
        return [serialize_video_plan(v) for v in videos]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 4j. GET /admin/video-plans (List Video Plans with Hierarchical Scope Filters)
@router.get("/video-plans", response_model=List[VideoPlanOut])
def list_video_plans(
    topic_id: Optional[int] = None,
    chapter_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Video)
    if topic_id:
        query = query.filter(Video.topic_id == topic_id)
    if chapter_id:
        query = query.join(Topic, Video.topic_id == Topic.id).filter(Topic.chapter_id == chapter_id)
    if subject_id:
        query = query.join(Topic, Video.topic_id == Topic.id).join(Chapter, Topic.chapter_id == Chapter.id).filter(Chapter.subject_id == subject_id)
    if status:
        if status.upper() in ["APPROVED", "SCRIPT_APPROVED"]:
            query = query.filter(
                (Video.status.in_(["APPROVED", "approved", "SCRIPT_APPROVED", "PUBLISHED", "published"])) |
                (Video.script_status.in_(["SCRIPT_APPROVED", "SCRIPT_REVIEW", "READY_FOR_VIDEO_GENERATION"]))
            )
        else:
            query = query.filter(Video.status.ilike(status))

    videos = query.order_by(Video.topic_id.asc(), Video.sequence_number.asc()).all()
    return [serialize_video_plan(v) for v in videos]


# 4k. GET /admin/video-plans/{id} (Get Video Plan Detail)
@router.get("/video-plans/{id}", response_model=VideoPlanOut)
def get_video_plan(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video plan not found")
    return serialize_video_plan(video)


# 4l. PATCH /admin/video-plans/{id} (Edit Video Plan)
@router.patch("/video-plans/{id}", response_model=VideoPlanOut)
def update_video_plan(
    id: int,
    patch: VideoPlanPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video plan not found")

    if patch.title is not None:
        if not patch.title.strip():
            raise HTTPException(status_code=400, detail="Video title cannot be empty")
        video.title = patch.title.strip()
    if patch.description is not None:
        video.description = patch.description
    if patch.sequence_number is not None:
        if patch.sequence_number <= 0:
            raise HTTPException(status_code=400, detail="Sequence number must be positive")
        video.sequence_number = patch.sequence_number
    if patch.estimated_duration_seconds is not None:
        if patch.estimated_duration_seconds <= 0:
            raise HTTPException(status_code=400, detail="Duration must be positive")
        video.estimated_duration_seconds = patch.estimated_duration_seconds
        video.duration_seconds = patch.estimated_duration_seconds
    elif patch.duration_seconds is not None:
        if patch.duration_seconds <= 0:
            raise HTTPException(status_code=400, detail="Duration must be positive")
        video.duration_seconds = patch.duration_seconds
        video.estimated_duration_seconds = patch.duration_seconds
    if patch.learning_objective is not None:
        video.learning_objective = patch.learning_objective
    if patch.content_outline is not None:
        if not patch.content_outline:
            raise HTTPException(status_code=400, detail="Content outline cannot be empty")
        video.content_outline = patch.content_outline
    if patch.source_start_page is not None:
        video.source_start_page = patch.source_start_page
    if patch.source_end_page is not None:
        if video.source_start_page and patch.source_end_page < video.source_start_page:
            raise HTTPException(status_code=400, detail="Source end page cannot precede start page")
        video.source_end_page = patch.source_end_page

    db.commit()
    db.refresh(video)
    return serialize_video_plan(video)


# 4m. POST /admin/video-plans/{id}/approve (Approve Video Plan)
@router.post("/video-plans/{id}/approve", response_model=VideoPlanOut)
def approve_single_video_plan(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video plan not found")
    video.status = "APPROVED"
    db.commit()
    db.refresh(video)
    return serialize_video_plan(video)


# 4n. POST /admin/topics/{topic_id}/video-plans/approve (Bulk Approve Video Plans for Topic)
@router.post("/topics/{topic_id}/video-plans/approve", response_model=List[VideoPlanOut])
def approve_topic_video_plans(
    topic_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    videos = db.query(Video).filter(Video.topic_id == topic_id).all()
    if not videos:
        raise HTTPException(status_code=404, detail=f"No video plans found for topic {topic_id}")
    for v in videos:
        v.status = "APPROVED"
    db.commit()
    for v in videos:
        db.refresh(v)
    return [serialize_video_plan(v) for v in videos]


# 4o. POST /admin/topics/{topic_id}/video-plans/regenerate (Safe Regeneration Preview)
@router.post("/topics/{topic_id}/video-plans/regenerate", response_model=VideoPlanRegenerationOut)
def preview_regenerate_video_plan(
    topic_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        preview = VideoSegmentationService.regenerate_video_plan_preview(db, topic_id)
        return VideoPlanRegenerationOut(**preview)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# BUILD 05: SCRIPT GENERATION & ADMIN SCRIPT REVIEW ENDPOINTS
# ==============================================================================

def serialize_script(v: Video) -> ScriptOut:
    if v.script_data:
        return ScriptOut(**v.script_data)
    return ScriptOut(
        id=v.id,
        video_id=v.id,
        version_number=1,
        title=f"Educational Script: {v.title}",
        script_status=v.script_status or "SCRIPT_REVIEW",
        generation_engine="deterministic",
        quality_score=100.0,
        word_count=len((v.script or "").split()),
        target_words=int(math.ceil(((v.estimated_duration_seconds or 330) / 60.0) * settings.narration_words_per_minute)),
        estimated_duration_seconds=v.estimated_duration_seconds or 330,
        source_page_start=v.source_start_page,
        source_page_end=v.source_end_page,
        sections=[
            ScriptSection(
                section_id=1,
                type="CONCEPT",
                title=v.title,
                narration=v.script or "",
                source_pages=[v.source_start_page or 1]
            )
        ] if v.script else [],
        narration_text=v.script,
        warnings=[]
    )


# 5a. POST /admin/video-plans/{id}/script/generate
@router.post("/video-plans/{id}/script/generate", response_model=ScriptOut)
def generate_video_script(
    id: int,
    req: Optional[ScriptGenerateRequest] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        res = ScriptService.generate_script_for_video(
            db=db,
            video_id=id,
            force_regenerate=req.force_regenerate if req else False,
            engine_name=req.engine if req else None
        )
        return ScriptOut(**res)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 5b. GET /admin/video-plans/{id}/script
@router.get("/video-plans/{id}/script", response_model=ScriptOut)
def get_video_plan_script(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video plan not found")
    if not video.script_data and not video.script:
        raise HTTPException(status_code=404, detail=f"No script generated yet for Video #{id}")
    return serialize_script(video)


# 5c. GET /admin/scripts (List All Scripts with Filter Hierarchy)
@router.get("/scripts", response_model=List[ScriptOut])
def list_scripts(
    topic_id: Optional[int] = None,
    chapter_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Video).filter(Video.script_data.isnot(None) | Video.script.isnot(None))
    if topic_id:
        query = query.filter(Video.topic_id == topic_id)
    if chapter_id:
        query = query.join(Topic, Video.topic_id == Topic.id).filter(Topic.chapter_id == chapter_id)
    if subject_id:
        query = query.join(Topic, Video.topic_id == Topic.id).join(Chapter, Topic.chapter_id == Chapter.id).filter(Chapter.subject_id == subject_id)
    if status:
        query = query.filter(Video.script_status.ilike(status))

    videos = query.order_by(Video.topic_id.asc(), Video.sequence_number.asc()).all()
    return [serialize_script(v) for v in videos]


# 5d. GET /admin/scripts/{id} (Get Script Details by Video ID)
@router.get("/scripts/{id}", response_model=ScriptOut)
def get_script_detail(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Script / Video not found")
    if not video.script_data and not video.script:
        raise HTTPException(status_code=404, detail=f"No script generated for Video #{id}")
    return serialize_script(video)


# 5e. PATCH /admin/scripts/{id} (Edit Script)
@router.patch("/scripts/{id}", response_model=ScriptOut)
@router.patch("/video-plans/{id}/script", response_model=ScriptOut)
def update_script(
    id: int,
    patch: ScriptPatch,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    patch_dict = patch.model_dump(exclude_unset=True)
    res = ScriptService.patch_script(db, id, patch_dict)
    return ScriptOut(**res)


# 5f. POST /admin/scripts/{id}/regenerate (Safe Regeneration Preview or Confirmed Overwrite)
@router.post("/scripts/{id}/regenerate")
@router.post("/video-plans/{id}/script/regenerate")
def regenerate_script(
    id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        if force:
            res = ScriptService.generate_script_for_video(db, id, force_regenerate=True)
            return ScriptOut(**res)
        preview = ScriptService.preview_regeneration(db, id)
        return ScriptRegenerationPreview(**preview)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 5g. POST /admin/scripts/{id}/approve (Approve Script)
@router.post("/scripts/{id}/approve", response_model=ScriptOut)
@router.post("/video-plans/{id}/script/approve", response_model=ScriptOut)
def approve_script(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    res = ScriptService.approve_script(db, id)
    return ScriptOut(**res)


# ==============================================================================
# BUILD 06: VIDEO GENERATION & ADMIN VIDEO REVIEW ENDPOINTS
# ==============================================================================

def serialize_video_render(v: Video, db: Optional[Session] = None) -> VideoRenderOut:
    topic = v.topic
    chapter = topic.chapter if topic else None
    subject = chapter.subject if chapter else None

    storage = get_storage()
    video_url = storage.get_url(v.video_storage_key) if v.video_storage_key else (v.storage_key or "")
    audio_url = storage.get_url(v.audio_storage_key) if v.audio_storage_key else None
    thumb_url = storage.get_url(v.thumbnail_storage_key) if v.thumbnail_storage_key else None
    captions_url = storage.get_url(v.captions_storage_key) if v.captions_storage_key else None

    scenes_raw = v.scenes_data or []
    scenes = [SceneOut(**s) for s in scenes_raw] if scenes_raw else []

    captions_srt = None
    if v.captions_storage_key and hasattr(storage, "get_local_path"):
        lp = storage.get_local_path(v.captions_storage_key)
        if lp and os.path.exists(lp):
            try:
                with open(lp, "r", encoding="utf-8") as f:
                    captions_srt = f.read()
            except Exception:
                pass

    latest_ver = v.render_versions[0].version_number if v.render_versions else 1
    job_id = None
    if db:
        job = db.query(ProcessingJob).filter(
            ProcessingJob.video_id == v.id,
            ProcessingJob.job_type == "VIDEO_GENERATION"
        ).order_by(ProcessingJob.id.desc()).first()
        if job:
            job_id = job.id

    return VideoRenderOut(
        id=v.id,
        video_id=v.id,
        version_number=latest_ver,
        title=v.title,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        chapter_title=chapter.title if chapter else None,
        topic_title=topic.title if topic else None,
        subtopic_title=v.subtopic.title if v.subtopic else None,
        approved_duration_seconds=v.duration_seconds or 330,
        actual_duration_seconds=v.actual_duration_seconds,
        render_status=v.render_status or "NOT_STARTED",
        status=v.status or "REVIEW",
        script_status=v.script_status,
        tts_engine=v.tts_engine,
        tts_provider="ElevenLabs" if "elevenlabs" in (v.tts_engine or "").lower() else ("Neural TTS" if "neural" in (v.tts_engine or "").lower() else "Local Fallback"),
        voice_quality="NEURAL" if any(k in (v.tts_engine or "").lower() for k in ["elevenlabs", "neural"]) else "FALLBACK",
        audio_quality="PASS" if (v.actual_duration_seconds or 0) > 0 else "PENDING",
        speaking_rate=f"{settings.narration_words_per_minute} WPM",
        render_engine=v.render_engine,
        voice=v.voice,
        video_url=video_url,
        video_storage_key=v.video_storage_key,
        audio_storage_key=v.audio_storage_key,
        thumbnail_url=thumb_url,
        thumbnail_storage_key=v.thumbnail_storage_key,
        captions_storage_key=v.captions_storage_key,
        captions_url=captions_url,
        captions_srt=captions_srt,
        scenes=scenes,
        source_page_start=v.source_start_page,
        source_page_end=v.source_end_page,
        render_error=v.render_error,
        job_id=job_id,
        video_plan_status="APPROVED" if (v.status in ["APPROVED", "PUBLISHED", "approved", "published"] or v.script_status is not None) else (v.status or "REVIEW"),
        rendered_at=v.rendered_at,
        created_at=v.created_at
    )


# 6a. POST /admin/video-plans/{id}/video/generate
@router.post("/video-plans/{id}/video/generate", response_model=VideoRenderOut)
def generate_video(
    id: int,
    req: Optional[VideoGenerateRequest] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    service = VideoGenerationService()
    try:
        updated_video = service.start_video_generation(
            video_id=id,
            db=db,
            force=req.force if req else False,
            tts_engine_name=req.tts_engine if req else None,
            voice=req.voice if req else None
        )
        return serialize_video_render(updated_video, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")


# 6b. GET /admin/videos/{id}/generation-status
@router.get("/videos/{id}/generation-status", response_model=VideoGenerationStatusOut)
def get_video_generation_status(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    job = db.query(ProcessingJob).filter(
        ProcessingJob.video_id == video.id,
        ProcessingJob.job_type == "VIDEO_GENERATION"
    ).order_by(ProcessingJob.id.desc()).first()

    storage = get_storage()
    video_url = storage.get_url(video.video_storage_key) if video.video_storage_key else None
    thumb_url = storage.get_url(video.thumbnail_storage_key) if video.thumbnail_storage_key else None

    return VideoGenerationStatusOut(
        video_id=video.id,
        video_title=video.title,
        job_id=job.id if job else None,
        job_status=job.status if job else "NOT_STARTED",
        current_stage=job.current_stage if job else (video.render_status or "NOT_STARTED"),
        progress=job.progress if job else 0.0,
        render_status=video.render_status or "NOT_STARTED",
        video_status=video.status or "REVIEW",
        actual_duration_seconds=video.actual_duration_seconds,
        video_url=video_url,
        thumbnail_url=thumb_url,
        error_message=job.error_message if job and job.status == "FAILED" else video.render_error
    )


# 6c. GET /admin/videos/{id}/preview
@router.get("/videos/{id}/preview", response_model=VideoRenderOut)
@router.get("/videos/{id}", response_model=VideoRenderOut)
def get_video_preview(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return serialize_video_render(video, db)


# 6d. POST /admin/videos/{id}/regenerate
@router.post("/videos/{id}/regenerate", response_model=VideoRenderOut)
def regenerate_video(
    id: int,
    req: Optional[VideoRegenerateRequest] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    service = VideoGenerationService()
    try:
        updated_video = service.start_video_generation(
            video_id=id,
            db=db,
            force=req.force if req else True,
            tts_engine_name=req.tts_engine if req else None,
            voice=req.voice if req else None
        )
        return serialize_video_render(updated_video, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


# 6e. POST /admin/videos/{id}/approve
@router.post("/videos/{id}/approve", response_model=VideoRenderOut)
def approve_video(
    id: int,
    req: Optional[VideoApproveRequest] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    service = VideoGenerationService()
    try:
        updated = service.approve_video(id, db, notes=req.notes if req else None)
        return serialize_video_render(updated, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 6f. POST /admin/videos/{id}/publish
@router.post("/videos/{id}/publish", response_model=VideoRenderOut)
def publish_video(
    id: int,
    req: Optional[VideoPublishRequest] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    service = VideoGenerationService()
    try:
        updated = service.publish_video(id, db)
        return serialize_video_render(updated, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 6g. GET /admin/videos (List All Rendered/Review Videos with Filter Hierarchy)
@router.get("/videos", response_model=List[VideoRenderOut])
def list_admin_videos(
    topic_id: Optional[int] = None,
    chapter_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    render_status: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Video)
    if topic_id:
        query = query.filter(Video.topic_id == topic_id)
    if chapter_id:
        query = query.join(Topic, Video.topic_id == Topic.id).filter(Topic.chapter_id == chapter_id)
    if subject_id:
        query = query.join(Topic, Video.topic_id == Topic.id).join(Chapter, Topic.chapter_id == Chapter.id).filter(Chapter.subject_id == subject_id)
    if render_status:
        query = query.filter(Video.render_status.ilike(render_status))
    if status:
        query = query.filter(Video.status.ilike(status))

    videos = query.order_by(Video.topic_id.asc(), Video.sequence_number.asc()).all()
    return [serialize_video_render(v, db) for v in videos]


# 5. GET /admin/review/items (List Items Awaiting Review)
@router.get("/review/items", response_model=List[ReviewItemOut])
def list_review_items(
    status: Optional[str] = "pending_review",
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    items = []
    status_filter = status.lower() if status else None
    if status_filter in ["all", "any"]:
        status_filter = None

    # Video units
    videos = db.query(Video).all()
    for v in videos:
        rev_status_str = v.review_status.value if hasattr(v.review_status, "value") else str(v.review_status)
        v_status = (v.status or "REVIEW").lower()

        # Check if matches filter
        include = False
        if not status_filter:
            include = True
        elif status_filter == "pending_review":
            include = rev_status_str == "pending_review" or v.status in ["REVIEW", "PROCESSING"]
        elif status_filter in ["approved", "published", "rejected"]:
            include = rev_status_str == status_filter or v_status == status_filter

        if include:
            topic = v.topic
            chapter = topic.chapter if topic else None
            subject = chapter.subject if chapter else None
            subtopic = v.subtopic

            items.append(ReviewItemOut(
                id=v.id,
                type="video",
                item_id=v.id,
                topic_id=v.topic_id,
                title=v.title,
                topic_title=topic.title if topic else None,
                review_status=rev_status_str,
                status=v_status,
                subject_name=subject.name if subject else None,
                chapter_title=chapter.title if chapter else None,
                subtopic_title=subtopic.title if subtopic else None,
                details={
                    "target_duration_minutes": round((v.duration_seconds or 330) / 60, 1),
                    "duration_seconds": v.duration_seconds,
                    "video_url": v.video_url,
                    "script_text": v.script_text,
                    "render_status": v.render_status,
                    "script_status": v.script_status,
                    "actual_duration_seconds": v.actual_duration_seconds,
                    "scenes_count": len(v.scenes_data) if v.scenes_data else 0
                },
                created_at=v.created_at
            ))

    # Quizzes
    quizzes = db.query(Quiz).all()
    for q in quizzes:
        rev_status_str = q.review_status.value if hasattr(q.review_status, "value") else str(q.review_status)
        q_status = (q.status or "REVIEW").lower()

        include = False
        if not status_filter:
            include = True
        elif status_filter == "pending_review":
            include = rev_status_str == "pending_review" or q.status in ["REVIEW", "PROCESSING"]
        elif status_filter in ["approved", "published", "rejected"]:
            include = rev_status_str == status_filter or q_status == status_filter

        if include:
            topic = q.topic
            chapter = topic.chapter if topic else None
            subject = chapter.subject if chapter else None

            questions_formatted = []
            for qu in q.questions:
                raw_opts = qu.options or []
                formatted_opts = [
                    opt.get("text") if isinstance(opt, dict) else str(opt)
                    for opt in raw_opts
                ]
                c_ans = qu.correct_answer if qu.correct_answer is not None else qu.correct_idx
                correct_letter = "A"
                if str(c_ans).isdigit() and int(c_ans) < len(formatted_opts):
                    correct_letter = chr(65 + int(c_ans))
                elif isinstance(c_ans, str) and len(c_ans) == 1 and c_ans.upper() in "ABCD":
                    correct_letter = c_ans.upper()

                questions_formatted.append({
                    "id": qu.id,
                    "question_text": qu.question_text or qu.stem,
                    "stem": qu.stem or qu.question_text,
                    "options": formatted_opts,
                    "correct_option": correct_letter,
                    "correct_answer": str(c_ans),
                    "explanation": qu.explanation
                })

            items.append(ReviewItemOut(
                id=q.id,
                type="quiz",
                item_id=q.id,
                topic_id=q.topic_id,
                title=q.title,
                topic_title=topic.title if topic else None,
                review_status=rev_status_str,
                status=q_status,
                subject_name=subject.name if subject else None,
                chapter_title=chapter.title if chapter else None,
                details={
                    "questions": questions_formatted,
                    "question_count": len(questions_formatted),
                    "passing_score": q.passing_score
                },
                created_at=q.created_at
            ))

    return items


# 6. GET /admin/review/items/{id} (Inspect Generated Item)
@router.get("/review/items/{id}", response_model=ReviewDetailOut)
def get_review_item(
    id: int,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    target_type = type.lower() if type else None
    if target_type == "video" or (target_type is None and db.get(Video, id)):
        v = db.get(Video, id)
        if not v:
            raise HTTPException(status_code=404, detail="Video unit not found")
        topic = v.topic
        chapter = topic.chapter if topic else None
        subject = chapter.subject if chapter else None
        subtopic = v.subtopic
        rev_str = v.review_status.value if hasattr(v.review_status, "value") else str(v.review_status)

        details_dict = {
            "target_duration_minutes": round((v.duration_seconds or 330) / 60, 1),
            "duration_seconds": v.duration_seconds,
            "video_url": v.video_url,
            "script_text": v.script_text,
            "render_status": v.render_status,
            "script_status": v.script_status,
            "actual_duration_seconds": v.actual_duration_seconds,
            "scenes_count": len(v.scenes_data) if v.scenes_data else 0
        }

        return ReviewDetailOut(
            id=v.id,
            type="video",
            item_id=v.id,
            title=v.title,
            topic_title=topic.title if topic else None,
            review_status=rev_str,
            status=(v.status or "REVIEW").lower(),
            subject_name=subject.name if subject else None,
            chapter_title=chapter.title if chapter else None,
            subtopic_title=subtopic.title if subtopic else None,
            script_text=v.script_text,
            video_url=v.video_url,
            duration_seconds=v.duration_seconds,
            details=details_dict,
            created_at=v.created_at
        )
    elif target_type == "quiz" or (target_type is None and db.get(Quiz, id)):
        q = db.get(Quiz, id)
        if not q:
            raise HTTPException(status_code=404, detail="Quiz not found")
        topic = q.topic
        chapter = topic.chapter if topic else None
        subject = chapter.subject if chapter else None

        questions_data = []
        for qu in q.questions:
            raw_opts = qu.options or []
            formatted_opts = [
                opt.get("text") if isinstance(opt, dict) else str(opt)
                for opt in raw_opts
            ]
            c_ans = qu.correct_answer if qu.correct_answer is not None else qu.correct_idx
            correct_letter = "A"
            if str(c_ans).isdigit() and int(c_ans) < len(formatted_opts):
                correct_letter = chr(65 + int(c_ans))
            elif isinstance(c_ans, str) and len(c_ans) == 1 and c_ans.upper() in "ABCD":
                correct_letter = c_ans.upper()

            questions_data.append({
                "id": qu.id,
                "question_text": qu.question_text or qu.stem,
                "stem": qu.stem or qu.question_text,
                "options": formatted_opts,
                "correct_option": correct_letter,
                "correct_answer": str(c_ans),
                "objective": qu.objective,
                "explanation": qu.explanation
            })

        rev_str = q.review_status.value if hasattr(q.review_status, "value") else str(q.review_status)
        details_dict = {
            "questions": questions_data,
            "question_count": len(questions_data),
            "passing_score": q.passing_score
        }

        return ReviewDetailOut(
            id=q.id,
            type="quiz",
            item_id=q.id,
            title=q.title,
            topic_title=topic.title if topic else None,
            review_status=rev_str,
            status=(q.status or "REVIEW").lower(),
            subject_name=subject.name if subject else None,
            chapter_title=chapter.title if chapter else None,
            questions=questions_data,
            details=details_dict,
            created_at=q.created_at
        )
    else:
        raise HTTPException(status_code=404, detail="Review item not found")


# 7. POST /admin/review/items/{id}/approval (Admin Approval & Publishing Gate)
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

    target_type = type.lower() if type else None

    if target_type == "video" or (target_type is None and db.get(Video, id)):
        v = db.get(Video, id)
        if not v:
            raise HTTPException(status_code=404, detail="Video unit not found")

        if payload.decision == "approve":
            service = VideoGenerationService()
            try:
                service.publish_video(v.id, db)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            v.status = VideoStatus.FAILED.value
            db.commit()

        rev_str = v.review_status.value if hasattr(v.review_status, "value") else str(v.review_status)
        return ApprovalOut(
            id=v.id,
            type="video",
            item_id=v.id,
            status=rev_str,
            approved_at=datetime.now(timezone.utc)
        )
    elif target_type == "quiz" or (target_type is None and db.get(Quiz, id)):
        q = db.get(Quiz, id)
        if not q:
            raise HTTPException(status_code=404, detail="Quiz not found")

        if payload.decision == "approve":
            try:
                QuizService.publish_quiz(db, q.id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            q.status = "REJECTED"
            db.commit()

        rev_str = q.review_status.value if hasattr(q.review_status, "value") else str(q.review_status)
        return ApprovalOut(
            id=q.id,
            type="quiz",
            item_id=q.id,
            status=rev_str,
            approved_at=datetime.now(timezone.utc)
        )
    else:
        raise HTTPException(status_code=404, detail="Review item not found")


# 8. GET /admin/users & POST /admin/users (User Management across all roles)
@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    users = db.query(User).all()
    res = []
    for u in users:
        role_str = u.role.value if hasattr(u.role, "value") else str(u.role)
        student_id = u.student.student_id if u.student else None
        parent_id = u.parent.parent_id if u.parent else None
        teacher_id = u.teacher.teacher_id if u.teacher else None
        email = u.email or (u.student.email if u.student else (u.teacher.email if u.teacher else (u.parent.email if u.parent else None)))
        res.append(UserOut(
            id=u.id,
            username=u.username,
            name=u.display_name,
            email=email or f"{u.username}@platform.local",
            role=role_str.lower(),
            student_id=student_id,
            parent_id=parent_id,
            teacher_id=teacher_id,
            linked_student_id=u.linked_student_id,
            is_active=u.is_active,
            created_at=u.created_at
        ))
    return res


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    # Determine username
    username = user_in.username or user_in.email or user_in.student_id or user_in.parent_id or user_in.teacher_id
    if not username:
        raise HTTPException(status_code=400, detail="Username, email, or role ID is required")

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if user_in.email and db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        user_role = Role(user_in.role.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {[r.value for r in Role]}")

    user = User(
        username=username,
        name=user_in.name or username,
        email=user_in.email,
        password_hash=hash_pw(user_in.password),
        role=user_role,
        is_active=True,
        linked_student_id=user_in.linked_student_id
    )
    db.add(user)
    db.flush()

    # Create role-specific record
    if user_role == Role.STUDENT:
        student_id = user_in.student_id or f"STU-{user.id:04d}"
        student = Student(
            user_id=user.id,
            student_id=student_id,
            name=user_in.name or username,
            email=user_in.email,
            phone=user_in.phone,
            class_=user_in.class_name,
            section=user_in.section,
            roll_number=user_in.roll_number
        )
        db.add(student)

    elif user_role == Role.PARENT:
        parent_id = user_in.parent_id or f"PAR-{user.id:04d}"
        parent = Parent(
            user_id=user.id,
            parent_id=parent_id,
            name=user_in.name or username,
            email=user_in.email,
            phone=user_in.phone
        )
        db.add(parent)
        db.flush()

        # Link student if provided
        if user_in.linked_student_id:
            # Check if linked_student_id is Student.id or User.id
            target_student = db.get(Student, user_in.linked_student_id)
            if not target_student:
                target_student = db.query(Student).filter(Student.user_id == user_in.linked_student_id).first()
            if target_student:
                sp = StudentParent(
                    student_id=target_student.id,
                    parent_id=parent.id,
                    relationship="Guardian"
                )
                db.add(sp)

    elif user_role == Role.TEACHER:
        teacher_id = user_in.teacher_id or f"TCH-{user.id:04d}"
        teacher = Teacher(
            user_id=user.id,
            teacher_id=teacher_id,
            name=user_in.name or username,
            email=user_in.email,
            phone=user_in.phone
        )
        db.add(teacher)

    db.commit()
    db.refresh(user)

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    student_id = user.student.student_id if user.student else None
    parent_id = user.parent.parent_id if user.parent else None
    teacher_id = user.teacher.teacher_id if user.teacher else None

    return UserOut(
        id=user.id,
        username=user.username,
        name=user.display_name,
        email=user.email or f"{user.username}@platform.local",
        role=role_str.lower(),
        student_id=student_id,
        parent_id=parent_id,
        teacher_id=teacher_id,
        linked_student_id=user.linked_student_id,
        is_active=user.is_active,
        created_at=user.created_at
    )


# 9. GET /admin/settings/thresholds & PUT /admin/settings/thresholds
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


# ==================================================
# 10. ADMIN STUDENT MANAGEMENT
# ==================================================
@router.get("/students", response_model=PaginatedResponse[StudentOut])
def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    student_id: Optional[str] = None,
    name: Optional[str] = None,
    class_: Optional[str] = Query(None, alias="class"),
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Student)
    if student_id:
        query = query.filter(Student.student_id.ilike(f"%{student_id.strip()}%"))
    if name:
        query = query.filter(Student.name.ilike(f"%{name.strip()}%"))
    if class_:
        query = query.filter(Student.class_.ilike(f"%{class_.strip()}%"))
    if section:
        query = query.filter(Student.section.ilike(f"%{section.strip()}%"))

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    students = query.order_by(Student.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s in students:
        is_active = s.user.is_active if s.user else True
        assigned_subjs = [sa.subject.name for sa in s.subject_associations if sa.subject]
        assigned_tchs = [ta.teacher.name for ta in s.teacher_associations if ta.teacher]
        items.append(StudentOut(
            id=s.id,
            user_id=s.user_id,
            student_id=s.student_id,
            name=s.name,
            dob=s.dob,
            class_=s.class_,
            section=s.section,
            roll_number=s.roll_number,
            email=s.email,
            phone=s.phone,
            is_active=is_active,
            assigned_subjects=assigned_subjs,
            assigned_teachers=assigned_tchs,
            parents_count=len(s.parent_associations),
            created_at=s.created_at,
            updated_at=s.updated_at
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/students/{id}", response_model=StudentDetailOut)
def get_student(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    parents = [
        ParentLinkOut(
            id=sp.id,
            parent_id=sp.parent.parent_id,
            parent_db_id=sp.parent.id,
            name=sp.parent.name,
            email=sp.parent.email,
            phone=sp.parent.phone,
            relationship=sp.relationship,
            created_at=sp.created_at
        )
        for sp in student.parent_associations if sp.parent
    ]
    teachers = [
        TeacherLinkOut(
            id=ts.id,
            teacher_id=ts.teacher.teacher_id,
            teacher_db_id=ts.teacher.id,
            name=ts.teacher.name,
            email=ts.teacher.email,
            phone=ts.teacher.phone,
            created_at=ts.created_at
        )
        for ts in student.teacher_associations if ts.teacher
    ]
    subjects = [
        SubjectLinkOut(
            id=ss.id,
            subject_id=ss.subject_id,
            name=ss.subject.name,
            class_=ss.subject.class_,
            assigned_at=ss.assigned_at
        )
        for ss in student.subject_associations if ss.subject
    ]

    recent_activity = []
    for vp in student.video_progress[:5]:
        v_title = vp.video.title if vp.video else "Video Lesson"
        recent_activity.append({
            "type": "video",
            "title": v_title,
            "watch_percentage": vp.watch_percentage,
            "completed": vp.completed,
            "timestamp": vp.updated_at.isoformat() if vp.updated_at else None
        })
    for qa in student.quiz_attempts[:5]:
        q_title = qa.quiz.title if qa.quiz else "Quiz Assessment"
        recent_activity.append({
            "type": "quiz",
            "title": q_title,
            "score": qa.score,
            "percentage": qa.percentage,
            "passed": qa.passed,
            "timestamp": qa.submitted_at.isoformat() if qa.submitted_at else None
        })

    is_active = student.user.is_active if student.user else True
    return StudentDetailOut(
        id=student.id,
        user_id=student.user_id,
        student_id=student.student_id,
        name=student.name,
        dob=student.dob,
        class_=student.class_,
        section=student.section,
        roll_number=student.roll_number,
        email=student.email,
        phone=student.phone,
        is_active=is_active,
        assigned_subjects=[s.name for s in subjects],
        assigned_teachers=[t.name for t in teachers],
        parents_count=len(parents),
        created_at=student.created_at,
        updated_at=student.updated_at,
        parents=parents,
        teachers=teachers,
        subjects=subjects,
        recent_activity=recent_activity
    )


@router.post("/students", response_model=StudentOut, status_code=201)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    if db.query(Student).filter(Student.student_id == student_in.student_id).first():
        raise HTTPException(status_code=400, detail=f"Student ID '{student_in.student_id}' is already registered")
    if db.query(User).filter(User.username == student_in.student_id).first():
        raise HTTPException(status_code=400, detail=f"Username '{student_in.student_id}' is already taken")
    if student_in.email and db.query(User).filter(User.email == student_in.email).first():
        raise HTTPException(status_code=400, detail=f"Email '{student_in.email}' is already in use")

    user = User(
        username=student_in.student_id,
        password_hash=hash_pw(student_in.password),
        role=Role.STUDENT,
        name=student_in.name,
        email=student_in.email,
        is_active=True
    )
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        student_id=student_in.student_id,
        name=student_in.name,
        dob=student_in.dob,
        class_=student_in.class_,
        section=student_in.section,
        roll_number=student_in.roll_number,
        email=student_in.email,
        phone=student_in.phone
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return StudentOut(
        id=student.id,
        user_id=user.id,
        student_id=student.student_id,
        name=student.name,
        dob=student.dob,
        class_=student.class_,
        section=student.section,
        roll_number=student.roll_number,
        email=student.email,
        phone=student.phone,
        is_active=user.is_active,
        assigned_subjects=[],
        assigned_teachers=[],
        parents_count=0,
        created_at=student.created_at,
        updated_at=student.updated_at
    )


@router.put("/students/{id}", response_model=StudentOut)
def update_student(
    id: int,
    student_in: StudentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student_in.name is not None:
        student.name = student_in.name
    if student_in.dob is not None:
        student.dob = student_in.dob
    if student_in.class_ is not None:
        student.class_ = student_in.class_
    if student_in.section is not None:
        student.section = student_in.section
    if student_in.roll_number is not None:
        student.roll_number = student_in.roll_number
    if student_in.email is not None:
        if student_in.email:
            existing = db.query(User).filter(User.email == student_in.email, User.id != student.user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Email '{student_in.email}' is already in use")
        student.email = student_in.email
    if student_in.phone is not None:
        student.phone = student_in.phone

    if student.user:
        if student_in.name is not None:
            student.user.name = student_in.name
        if student_in.email is not None:
            student.user.email = student_in.email
        if student_in.is_active is not None:
            student.user.is_active = student_in.is_active
        if student_in.password:
            student.user.password_hash = hash_pw(student_in.password)

    db.commit()
    db.refresh(student)

    is_active = student.user.is_active if student.user else True
    assigned_subjs = [sa.subject.name for sa in student.subject_associations if sa.subject]
    assigned_tchs = [ta.teacher.name for ta in student.teacher_associations if ta.teacher]
    return StudentOut(
        id=student.id,
        user_id=student.user_id,
        student_id=student.student_id,
        name=student.name,
        dob=student.dob,
        class_=student.class_,
        section=student.section,
        roll_number=student.roll_number,
        email=student.email,
        phone=student.phone,
        is_active=is_active,
        assigned_subjects=assigned_subjs,
        assigned_teachers=assigned_tchs,
        parents_count=len(student.parent_associations),
        created_at=student.created_at,
        updated_at=student.updated_at
    )


@router.delete("/students/{id}")
def delete_student(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.user:
        student.user.is_active = False
    db.commit()
    return {"message": "Student deactivated successfully", "id": student.id, "is_active": False}


# ==================================================
# 11. ADMIN PARENT MANAGEMENT
# ==================================================
@router.get("/parents", response_model=PaginatedResponse[ParentOut])
def list_parents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    parent_id: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Parent)
    if parent_id:
        query = query.filter(Parent.parent_id.ilike(f"%{parent_id.strip()}%"))
    if name:
        query = query.filter(Parent.name.ilike(f"%{name.strip()}%"))

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    parents = query.order_by(Parent.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for p in parents:
        is_active = p.user.is_active if p.user else True
        summary = [f"{sp.student.name} ({sp.relationship})" for sp in p.student_associations if sp.student]
        items.append(ParentOut(
            id=p.id,
            user_id=p.user_id,
            parent_id=p.parent_id,
            name=p.name,
            email=p.email,
            phone=p.phone,
            is_active=is_active,
            linked_students_count=len(p.student_associations),
            linked_students_summary=summary,
            created_at=p.created_at,
            updated_at=p.updated_at
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/parents/{id}", response_model=ParentDetailOut)
def get_parent(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    parent = db.get(Parent, id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    linked_students = [
        StudentLinkOut(
            id=sp.id,
            student_id=sp.student.student_id,
            student_db_id=sp.student.id,
            name=sp.student.name,
            class_=sp.student.class_,
            section=sp.student.section,
            relationship=sp.relationship,
            created_at=sp.created_at
        )
        for sp in parent.student_associations if sp.student
    ]
    is_active = parent.user.is_active if parent.user else True
    summary = [f"{s.name} ({s.relationship})" for s in linked_students]

    return ParentDetailOut(
        id=parent.id,
        user_id=parent.user_id,
        parent_id=parent.parent_id,
        name=parent.name,
        email=parent.email,
        phone=parent.phone,
        is_active=is_active,
        linked_students_count=len(linked_students),
        linked_students_summary=summary,
        created_at=parent.created_at,
        updated_at=parent.updated_at,
        linked_students=linked_students
    )


@router.post("/parents", response_model=ParentOut, status_code=201)
def create_parent(
    parent_in: ParentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    if db.query(Parent).filter(Parent.parent_id == parent_in.parent_id).first():
        raise HTTPException(status_code=400, detail=f"Parent ID '{parent_in.parent_id}' is already registered")
    if db.query(User).filter(User.username == parent_in.parent_id).first():
        raise HTTPException(status_code=400, detail=f"Username '{parent_in.parent_id}' is already taken")
    if parent_in.email and db.query(User).filter(User.email == parent_in.email).first():
        raise HTTPException(status_code=400, detail=f"Email '{parent_in.email}' is already in use")

    user = User(
        username=parent_in.parent_id,
        password_hash=hash_pw(parent_in.password),
        role=Role.PARENT,
        name=parent_in.name,
        email=parent_in.email,
        is_active=True
    )
    db.add(user)
    db.flush()

    parent = Parent(
        user_id=user.id,
        parent_id=parent_in.parent_id,
        name=parent_in.name,
        email=parent_in.email,
        phone=parent_in.phone
    )
    db.add(parent)
    db.commit()
    db.refresh(parent)

    return ParentOut(
        id=parent.id,
        user_id=user.id,
        parent_id=parent.parent_id,
        name=parent.name,
        email=parent.email,
        phone=parent.phone,
        is_active=user.is_active,
        linked_students_count=0,
        linked_students_summary=[],
        created_at=parent.created_at,
        updated_at=parent.updated_at
    )


@router.put("/parents/{id}", response_model=ParentOut)
def update_parent(
    id: int,
    parent_in: ParentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    parent = db.get(Parent, id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    if parent_in.name is not None:
        parent.name = parent_in.name
    if parent_in.email is not None:
        if parent_in.email:
            existing = db.query(User).filter(User.email == parent_in.email, User.id != parent.user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Email '{parent_in.email}' is already in use")
        parent.email = parent_in.email
    if parent_in.phone is not None:
        parent.phone = parent_in.phone

    if parent.user:
        if parent_in.name is not None:
            parent.user.name = parent_in.name
        if parent_in.email is not None:
            parent.user.email = parent_in.email
        if parent_in.is_active is not None:
            parent.user.is_active = parent_in.is_active
        if parent_in.password:
            parent.user.password_hash = hash_pw(parent_in.password)

    db.commit()
    db.refresh(parent)

    is_active = parent.user.is_active if parent.user else True
    summary = [f"{sp.student.name} ({sp.relationship})" for sp in parent.student_associations if sp.student]
    return ParentOut(
        id=parent.id,
        user_id=parent.user_id,
        parent_id=parent.parent_id,
        name=parent.name,
        email=parent.email,
        phone=parent.phone,
        is_active=is_active,
        linked_students_count=len(parent.student_associations),
        linked_students_summary=summary,
        created_at=parent.created_at,
        updated_at=parent.updated_at
    )


@router.delete("/parents/{id}")
def delete_parent(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    parent = db.get(Parent, id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    if parent.user:
        parent.user.is_active = False
    db.commit()
    return {"message": "Parent deactivated successfully", "id": parent.id, "is_active": False}


# ==================================================
# 12. STUDENT-PARENT LINKING
# ==================================================
@router.get("/students/{id}/parents", response_model=List[ParentLinkOut])
def get_student_parents(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return [
        ParentLinkOut(
            id=sp.id,
            parent_id=sp.parent.parent_id,
            parent_db_id=sp.parent.id,
            name=sp.parent.name,
            email=sp.parent.email,
            phone=sp.parent.phone,
            relationship=sp.relationship,
            created_at=sp.created_at
        )
        for sp in student.parent_associations if sp.parent
    ]


@router.post("/students/{id}/parents", response_model=ParentLinkOut, status_code=201)
def link_student_parent(
    id: int,
    link_in: StudentParentLinkIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Resolve parent by integer DB id or string parent_id
    parent = None
    if isinstance(link_in.parent_id, int) or (isinstance(link_in.parent_id, str) and link_in.parent_id.isdigit()):
        parent = db.get(Parent, int(link_in.parent_id))
    if not parent and isinstance(link_in.parent_id, str):
        parent = db.query(Parent).filter(Parent.parent_id == link_in.parent_id).first()

    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    # Prevent duplicate student-parent linking
    existing = db.query(StudentParent).filter(
        StudentParent.student_id == student.id,
        StudentParent.parent_id == parent.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student is already linked to this parent")

    link = StudentParent(
        student_id=student.id,
        parent_id=parent.id,
        relationship=link_in.relationship.strip()
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return ParentLinkOut(
        id=link.id,
        parent_id=parent.parent_id,
        parent_db_id=parent.id,
        name=parent.name,
        email=parent.email,
        phone=parent.phone,
        relationship=link.relationship,
        created_at=link.created_at
    )


@router.delete("/students/{id}/parents/{parent_id}")
def unlink_student_parent(
    id: int,
    parent_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    par_db_id = int(parent_id) if parent_id.isdigit() else None
    query = db.query(StudentParent).filter(StudentParent.student_id == student.id)
    if par_db_id:
        link = query.filter((StudentParent.parent_id == par_db_id) | (StudentParent.id == par_db_id)).first()
    else:
        parent = db.query(Parent).filter(Parent.parent_id == parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent link not found")
        link = query.filter(StudentParent.parent_id == parent.id).first()

    if not link:
        raise HTTPException(status_code=404, detail="Parent link not found")

    db.delete(link)
    db.commit()
    return {"message": "Parent unlinked successfully"}


# ==================================================
# 13. ADMIN TEACHER MANAGEMENT
# ==================================================
@router.get("/teachers", response_model=PaginatedResponse[TeacherOut])
def list_teachers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    teacher_id: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Teacher)
    if teacher_id:
        query = query.filter(Teacher.teacher_id.ilike(f"%{teacher_id.strip()}%"))
    if name:
        query = query.filter(Teacher.name.ilike(f"%{name.strip()}%"))

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    teachers = query.order_by(Teacher.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        TeacherOut(
            id=t.id,
            user_id=t.user_id,
            teacher_id=t.teacher_id,
            name=t.name,
            email=t.email,
            phone=t.phone,
            is_active=t.user.is_active if t.user else True,
            assigned_students_count=len(t.student_associations),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in teachers
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/teachers/{id}", response_model=TeacherDetailOut)
def get_teacher(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    teacher = db.get(Teacher, id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    assigned_students = [
        StudentLinkOut(
            id=ts.id,
            student_id=ts.student.student_id,
            student_db_id=ts.student.id,
            name=ts.student.name,
            class_=ts.student.class_,
            section=ts.student.section,
            created_at=ts.created_at
        )
        for ts in teacher.student_associations if ts.student
    ]
    is_active = teacher.user.is_active if teacher.user else True

    return TeacherDetailOut(
        id=teacher.id,
        user_id=teacher.user_id,
        teacher_id=teacher.teacher_id,
        name=teacher.name,
        email=teacher.email,
        phone=teacher.phone,
        is_active=is_active,
        assigned_students_count=len(assigned_students),
        created_at=teacher.created_at,
        updated_at=teacher.updated_at,
        assigned_students=assigned_students
    )


@router.post("/teachers", response_model=TeacherOut, status_code=201)
def create_teacher(
    teacher_in: TeacherCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    if db.query(Teacher).filter(Teacher.teacher_id == teacher_in.teacher_id).first():
        raise HTTPException(status_code=400, detail=f"Teacher ID '{teacher_in.teacher_id}' is already registered")
    if db.query(User).filter(User.username == teacher_in.teacher_id).first():
        raise HTTPException(status_code=400, detail=f"Username '{teacher_in.teacher_id}' is already taken")
    if teacher_in.email and db.query(User).filter(User.email == teacher_in.email).first():
        raise HTTPException(status_code=400, detail=f"Email '{teacher_in.email}' is already in use")

    user = User(
        username=teacher_in.teacher_id,
        password_hash=hash_pw(teacher_in.password),
        role=Role.TEACHER,
        name=teacher_in.name,
        email=teacher_in.email,
        is_active=True
    )
    db.add(user)
    db.flush()

    teacher = Teacher(
        user_id=user.id,
        teacher_id=teacher_in.teacher_id,
        name=teacher_in.name,
        email=teacher_in.email,
        phone=teacher_in.phone
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    return TeacherOut(
        id=teacher.id,
        user_id=user.id,
        teacher_id=teacher.teacher_id,
        name=teacher.name,
        email=teacher.email,
        phone=teacher.phone,
        is_active=user.is_active,
        assigned_students_count=0,
        created_at=teacher.created_at,
        updated_at=teacher.updated_at
    )


@router.put("/teachers/{id}", response_model=TeacherOut)
def update_teacher(
    id: int,
    teacher_in: TeacherUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    teacher = db.get(Teacher, id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if teacher_in.name is not None:
        teacher.name = teacher_in.name
    if teacher_in.email is not None:
        if teacher_in.email:
            existing = db.query(User).filter(User.email == teacher_in.email, User.id != teacher.user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Email '{teacher_in.email}' is already in use")
        teacher.email = teacher_in.email
    if teacher_in.phone is not None:
        teacher.phone = teacher_in.phone

    if teacher.user:
        if teacher_in.name is not None:
            teacher.user.name = teacher_in.name
        if teacher_in.email is not None:
            teacher.user.email = teacher_in.email
        if teacher_in.is_active is not None:
            teacher.user.is_active = teacher_in.is_active
        if teacher_in.password:
            teacher.user.password_hash = hash_pw(teacher_in.password)

    db.commit()
    db.refresh(teacher)

    is_active = teacher.user.is_active if teacher.user else True
    return TeacherOut(
        id=teacher.id,
        user_id=teacher.user_id,
        teacher_id=teacher.teacher_id,
        name=teacher.name,
        email=teacher.email,
        phone=teacher.phone,
        is_active=is_active,
        assigned_students_count=len(teacher.student_associations),
        created_at=teacher.created_at,
        updated_at=teacher.updated_at
    )


@router.delete("/teachers/{id}")
def delete_teacher(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    teacher = db.get(Teacher, id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if teacher.user:
        teacher.user.is_active = False
    db.commit()
    return {"message": "Teacher deactivated successfully", "id": teacher.id, "is_active": False}


# ==================================================
# 14. TEACHER-STUDENT ASSIGNMENT
# ==================================================
@router.get("/teachers/{id}/students", response_model=List[StudentLinkOut])
def get_teacher_students(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    teacher = db.get(Teacher, id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    return [
        StudentLinkOut(
            id=ts.id,
            student_id=ts.student.student_id,
            student_db_id=ts.student.id,
            name=ts.student.name,
            class_=ts.student.class_,
            section=ts.student.section,
            created_at=ts.created_at
        )
        for ts in teacher.student_associations if ts.student
    ]


@router.post("/teachers/{id}/students", response_model=StudentLinkOut, status_code=201)
def assign_teacher_student(
    id: int,
    assign_in: TeacherStudentLinkIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    teacher = db.get(Teacher, id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    student = None
    if isinstance(assign_in.student_id, int) or (isinstance(assign_in.student_id, str) and assign_in.student_id.isdigit()):
        student = db.get(Student, int(assign_in.student_id))
    if not student and isinstance(assign_in.student_id, str):
        student = db.query(Student).filter(Student.student_id == assign_in.student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(TeacherStudent).filter(
        TeacherStudent.teacher_id == teacher.id,
        TeacherStudent.student_id == student.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student is already assigned to this teacher")

    link = TeacherStudent(
        teacher_id=teacher.id,
        student_id=student.id
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return StudentLinkOut(
        id=link.id,
        student_id=student.student_id,
        student_db_id=student.id,
        name=student.name,
        class_=student.class_,
        section=student.section,
        created_at=link.created_at
    )


@router.delete("/teachers/{id}/students/{student_id}")
def unassign_teacher_student(
    id: int,
    student_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    teacher = db.get(Teacher, id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    stu_db_id = int(student_id) if student_id.isdigit() else None
    query = db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher.id)
    if stu_db_id:
        link = query.filter((TeacherStudent.student_id == stu_db_id) | (TeacherStudent.id == stu_db_id)).first()
    else:
        student = db.query(Student).filter(Student.student_id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student assignment not found")
        link = query.filter(TeacherStudent.student_id == student.id).first()

    if not link:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    db.delete(link)
    db.commit()
    return {"message": "Student unassigned from teacher successfully"}


# ==================================================
# 15. SUBJECT MANAGEMENT
# ==================================================
@router.get("/subjects", response_model=Union[PaginatedResponse[SubjectOut], List[SubjectOut]])
def list_subjects(
    page: Optional[int] = None,
    page_size: int = Query(20, ge=1, le=100),
    name: Optional[str] = None,
    class_: Optional[str] = Query(None, alias="class"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Subject)
    if name:
        query = query.filter(Subject.name.ilike(f"%{name.strip()}%"))
    if class_:
        query = query.filter(Subject.class_.ilike(f"%{class_.strip()}%"))

    if page is not None:
        total = query.count()
        total_pages = max(1, (total + page_size - 1) // page_size)
        subjects = query.order_by(Subject.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
        items = [
            SubjectOut(
                id=s.id,
                name=s.name,
                description=s.description,
                class_=s.class_,
                created_by=s.created_by,
                chapters_count=len(s.chapters),
                students_count=len(s.student_associations),
                created_at=s.created_at,
                updated_at=s.updated_at
            )
            for s in subjects
        ]
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    else:
        subjects = query.order_by(Subject.id.desc()).all()
        return [
            SubjectOut(
                id=s.id,
                name=s.name,
                description=s.description,
                class_=s.class_,
                created_by=s.created_by,
                chapters_count=len(s.chapters),
                students_count=len(s.student_associations),
                created_at=s.created_at,
                updated_at=s.updated_at
            )
            for s in subjects
        ]


@router.get("/subjects/{id}", response_model=SubjectDetailOut)
def get_subject(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subject = db.get(Subject, id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    chapters = [
        ChapterOut(
            id=ch.id,
            subject_id=ch.subject_id,
            chapter_number=ch.chapter_number,
            title=ch.title,
            description=ch.description,
            topics_count=len(ch.topics),
            created_at=ch.created_at,
            updated_at=ch.updated_at
        )
        for ch in sorted(subject.chapters, key=lambda c: c.chapter_number)
    ]

    return SubjectDetailOut(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        class_=subject.class_,
        created_by=subject.created_by,
        chapters_count=len(chapters),
        students_count=len(subject.student_associations),
        created_at=subject.created_at,
        updated_at=subject.updated_at,
        chapters=chapters
    )


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(
    subj_in: SubjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subject = Subject(
        name=subj_in.name,
        description=subj_in.description,
        class_=subj_in.class_,
        created_by=admin.id
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return SubjectOut(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        class_=subject.class_,
        created_by=subject.created_by,
        chapters_count=0,
        students_count=0,
        created_at=subject.created_at,
        updated_at=subject.updated_at
    )


@router.put("/subjects/{id}", response_model=SubjectOut)
def update_subject(
    id: int,
    subj_in: SubjectUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subject = db.get(Subject, id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if subj_in.name is not None:
        subject.name = subj_in.name
    if subj_in.description is not None:
        subject.description = subj_in.description
    if subj_in.class_ is not None:
        subject.class_ = subj_in.class_

    db.commit()
    db.refresh(subject)
    return SubjectOut(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        class_=subject.class_,
        created_by=subject.created_by,
        chapters_count=len(subject.chapters),
        students_count=len(subject.student_associations),
        created_at=subject.created_at,
        updated_at=subject.updated_at
    )


@router.delete("/subjects/{id}")
def delete_subject(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subject = db.get(Subject, id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully", "id": id}


# ==================================================
# 16. STUDENT-SUBJECT ASSIGNMENT
# ==================================================
@router.get("/students/{id}/subjects", response_model=List[SubjectLinkOut])
def get_student_subjects(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return [
        SubjectLinkOut(
            id=ss.id,
            subject_id=ss.subject_id,
            name=ss.subject.name,
            class_=ss.subject.class_,
            assigned_at=ss.assigned_at
        )
        for ss in student.subject_associations if ss.subject
    ]


@router.post("/students/{id}/subjects", response_model=SubjectLinkOut, status_code=201)
def assign_student_subject(
    id: int,
    assign_in: StudentSubjectLinkIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subject = db.get(Subject, assign_in.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    existing = db.query(StudentSubject).filter(
        StudentSubject.student_id == student.id,
        StudentSubject.subject_id == subject.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student is already assigned to this subject")

    link = StudentSubject(
        student_id=student.id,
        subject_id=subject.id
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return SubjectLinkOut(
        id=link.id,
        subject_id=subject.id,
        name=subject.name,
        class_=subject.class_,
        assigned_at=link.assigned_at
    )


@router.delete("/students/{id}/subjects/{subject_id}")
def unassign_student_subject(
    id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    student = db.get(Student, id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    link = db.query(StudentSubject).filter(
        StudentSubject.student_id == student.id,
        (StudentSubject.subject_id == subject_id) | (StudentSubject.id == subject_id)
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Subject assignment not found")

    db.delete(link)
    db.commit()
    return {"message": "Subject unassigned from student successfully"}


# ==================================================
# 17. CHAPTER MANAGEMENT
# ==================================================
@router.get("/subjects/{subject_id}/chapters", response_model=List[ChapterOut])
def list_subject_chapters(
    subject_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    chapters = db.query(Chapter).filter(Chapter.subject_id == subject_id).order_by(Chapter.chapter_number.asc()).all()
    return [
        ChapterOut(
            id=ch.id,
            subject_id=ch.subject_id,
            chapter_number=ch.chapter_number,
            title=ch.title,
            description=ch.description,
            topics_count=len(ch.topics),
            created_at=ch.created_at,
            updated_at=ch.updated_at
        )
        for ch in chapters
    ]


@router.post("/subjects/{subject_id}/chapters", response_model=ChapterOut, status_code=201)
def create_chapter(
    subject_id: int,
    ch_in: ChapterCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=ch_in.chapter_number,
        title=ch_in.title,
        description=ch_in.description,
        order_idx=ch_in.chapter_number
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)

    return ChapterOut(
        id=chapter.id,
        subject_id=chapter.subject_id,
        chapter_number=chapter.chapter_number,
        title=chapter.title,
        description=chapter.description,
        topics_count=0,
        created_at=chapter.created_at,
        updated_at=chapter.updated_at
    )


@router.get("/chapters/{id}", response_model=ChapterDetailOut)
def get_chapter(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    chapter = db.get(Chapter, id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    topics = [
        TopicOut(
            id=t.id,
            chapter_id=t.chapter_id,
            sequence_number=t.sequence_number,
            title=t.title,
            description=t.description,
            subtopics_count=len(t.subtopics),
            videos_count=len(t.videos),
            quizzes_count=len(t.quizzes),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in sorted(chapter.topics, key=lambda x: x.sequence_number)
    ]

    return ChapterDetailOut(
        id=chapter.id,
        subject_id=chapter.subject_id,
        chapter_number=chapter.chapter_number,
        title=chapter.title,
        description=chapter.description,
        topics_count=len(topics),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
        topics=topics
    )


@router.put("/chapters/{id}", response_model=ChapterOut)
def update_chapter(
    id: int,
    ch_in: ChapterUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    chapter = db.get(Chapter, id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if ch_in.chapter_number is not None:
        chapter.chapter_number = ch_in.chapter_number
        chapter.order_idx = ch_in.chapter_number
    if ch_in.title is not None:
        chapter.title = ch_in.title
    if ch_in.description is not None:
        chapter.description = ch_in.description

    db.commit()
    db.refresh(chapter)
    return ChapterOut(
        id=chapter.id,
        subject_id=chapter.subject_id,
        chapter_number=chapter.chapter_number,
        title=chapter.title,
        description=chapter.description,
        topics_count=len(chapter.topics),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at
    )


@router.delete("/chapters/{id}")
def delete_chapter(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    chapter = db.get(Chapter, id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    db.delete(chapter)
    db.commit()
    return {"message": "Chapter deleted successfully", "id": id}


# ==================================================
# 18. TOPIC MANAGEMENT
# ==================================================
@router.get("/chapters/{chapter_id}/topics", response_model=List[TopicOut])
def list_chapter_topics(
    chapter_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    chapter = db.get(Chapter, id)
    if not chapter:
        chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    topics = db.query(Topic).filter(Topic.chapter_id == chapter.id).order_by(Topic.sequence_number.asc()).all()
    return [
        TopicOut(
            id=t.id,
            chapter_id=t.chapter_id,
            sequence_number=t.sequence_number,
            title=t.title,
            description=t.description,
            subtopics_count=len(t.subtopics),
            videos_count=len(t.videos),
            quizzes_count=len(t.quizzes),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in topics
    ]


@router.post("/chapters/{chapter_id}/topics", response_model=TopicOut, status_code=201)
def create_topic(
    chapter_id: int,
    top_in: TopicCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    topic = Topic(
        chapter_id=chapter.id,
        sequence_number=top_in.sequence_number,
        title=top_in.title,
        description=top_in.description,
        order_idx=top_in.sequence_number
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)

    return TopicOut(
        id=topic.id,
        chapter_id=topic.chapter_id,
        sequence_number=topic.sequence_number,
        title=topic.title,
        description=topic.description,
        subtopics_count=0,
        videos_count=0,
        quizzes_count=0,
        created_at=topic.created_at,
        updated_at=topic.updated_at
    )


@router.get("/topics/{id}", response_model=TopicDetailOut)
def get_topic(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    topic = db.get(Topic, id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subtopics = [
        SubtopicOut(
            id=st.id,
            topic_id=st.topic_id,
            sequence_number=st.sequence_number,
            title=st.title,
            description=st.description,
            order_idx=st.sequence_number,
            created_at=st.created_at,
            updated_at=st.updated_at
        )
        for st in sorted(topic.subtopics, key=lambda x: x.sequence_number)
    ]

    videos = [
        {
            "id": v.id,
            "title": v.title,
            "duration_seconds": v.duration_seconds,
            "status": v.status,
            "sequence_number": v.sequence_number
        }
        for v in topic.videos
    ]

    quizzes = [
        {
            "id": q.id,
            "title": q.title,
            "attempt_number": q.attempt_number,
            "parent_quiz_id": q.parent_quiz_id,
            "status": q.status,
            "questions_count": len(q.questions)
        }
        for q in topic.quizzes
    ]

    return TopicDetailOut(
        id=topic.id,
        chapter_id=topic.chapter_id,
        sequence_number=topic.sequence_number,
        title=topic.title,
        description=topic.description,
        subtopics_count=len(subtopics),
        videos_count=len(videos),
        quizzes_count=len(quizzes),
        created_at=topic.created_at,
        updated_at=topic.updated_at,
        subtopics=subtopics,
        videos=videos,
        quizzes=quizzes
    )


@router.put("/topics/{id}", response_model=TopicOut)
def update_topic(
    id: int,
    top_in: TopicUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    topic = db.get(Topic, id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if top_in.sequence_number is not None:
        topic.sequence_number = top_in.sequence_number
        topic.order_idx = top_in.sequence_number
    if top_in.title is not None:
        topic.title = top_in.title
    if top_in.description is not None:
        topic.description = top_in.description

    db.commit()
    db.refresh(topic)
    return TopicOut(
        id=topic.id,
        chapter_id=topic.chapter_id,
        sequence_number=topic.sequence_number,
        title=topic.title,
        description=topic.description,
        subtopics_count=len(topic.subtopics),
        videos_count=len(topic.videos),
        quizzes_count=len(topic.quizzes),
        created_at=topic.created_at,
        updated_at=topic.updated_at
    )


@router.delete("/topics/{id}")
def delete_topic(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    topic = db.get(Topic, id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted successfully", "id": id}


# ==================================================
# 19. SUBTOPIC MANAGEMENT
# ==================================================
@router.get("/topics/{topic_id}/subtopics", response_model=List[SubtopicOut])
def list_topic_subtopics(
    topic_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic.id).order_by(Subtopic.sequence_number.asc()).all()
    return [
        SubtopicOut(
            id=st.id,
            topic_id=st.topic_id,
            sequence_number=st.sequence_number,
            title=st.title,
            description=st.description,
            order_idx=st.sequence_number,
            created_at=st.created_at,
            updated_at=st.updated_at
        )
        for st in subtopics
    ]


@router.post("/topics/{topic_id}/subtopics", response_model=SubtopicOut, status_code=201)
def create_subtopic(
    topic_id: int,
    st_in: SubtopicCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subtopic = Subtopic(
        topic_id=topic.id,
        sequence_number=st_in.sequence_number,
        title=st_in.title,
        description=st_in.description,
        order_idx=st_in.sequence_number
    )
    db.add(subtopic)
    db.commit()
    db.refresh(subtopic)

    return SubtopicOut(
        id=subtopic.id,
        topic_id=subtopic.topic_id,
        sequence_number=subtopic.sequence_number,
        title=subtopic.title,
        description=subtopic.description,
        order_idx=subtopic.sequence_number,
        created_at=subtopic.created_at,
        updated_at=subtopic.updated_at
    )


@router.get("/subtopics/{id}", response_model=SubtopicOut)
def get_subtopic(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subtopic = db.get(Subtopic, id)
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")

    return SubtopicOut(
        id=subtopic.id,
        topic_id=subtopic.topic_id,
        sequence_number=subtopic.sequence_number,
        title=subtopic.title,
        description=subtopic.description,
        order_idx=subtopic.sequence_number,
        created_at=subtopic.created_at,
        updated_at=subtopic.updated_at
    )


@router.put("/subtopics/{id}", response_model=SubtopicOut)
def update_subtopic(
    id: int,
    st_in: SubtopicUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subtopic = db.get(Subtopic, id)
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")

    if st_in.sequence_number is not None:
        subtopic.sequence_number = st_in.sequence_number
        subtopic.order_idx = st_in.sequence_number
    if st_in.title is not None:
        subtopic.title = st_in.title
    if st_in.description is not None:
        subtopic.description = st_in.description

    db.commit()
    db.refresh(subtopic)
    return SubtopicOut(
        id=subtopic.id,
        topic_id=subtopic.topic_id,
        sequence_number=subtopic.sequence_number,
        title=subtopic.title,
        description=subtopic.description,
        order_idx=subtopic.sequence_number,
        created_at=subtopic.created_at,
        updated_at=subtopic.updated_at
    )


@router.delete("/subtopics/{id}")
def delete_subtopic(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    subtopic = db.get(Subtopic, id)
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")

    db.delete(subtopic)
    db.commit()
    return {"message": "Subtopic deleted successfully", "id": id}


# ==============================================================================
# BUILD 07: ADMIN QUIZ & ASSESSMENT MANAGEMENT
# ==============================================================================

def serialize_admin_quiz(q: Quiz) -> AdminQuizOut:
    topic = q.topic
    chapter = topic.chapter if topic else None
    subject = chapter.subject if chapter else None

    rev_status = q.review_status.value if hasattr(q.review_status, "value") else str(q.review_status)

    questions_out = [
        AdminQuestionOut(
            id=qn.id,
            quiz_id=qn.quiz_id,
            question_text=qn.question_text,
            stem=qn.stem,
            options=qn.options or [],
            correct_answer=qn.correct_answer,
            explanation=qn.explanation,
            difficulty=qn.difficulty or "MEDIUM",
            bloom_level=qn.bloom_level or "UNDERSTAND",
            objective=qn.objective,
            adaptive=qn.adaptive or False,
            weak_concept=qn.weak_concept,
            source_reference=qn.source_reference,
            source_pages=qn.source_pages or [],
            order_index=qn.order_index or 0,
            created_at=qn.created_at
        )
        for qn in q.questions
    ]

    return AdminQuizOut(
        id=q.id,
        topic_id=q.topic_id,
        topic_title=topic.title if topic else None,
        chapter_id=chapter.id if chapter else None,
        chapter_title=chapter.title if chapter else None,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        subtopic_id=q.subtopic_id,
        title=q.title,
        description=q.description,
        quiz_type=q.quiz_type or "TOPIC",
        passing_score=q.passing_score or 80.0,
        attempt_number=q.attempt_number or 1,
        parent_quiz_id=q.parent_quiz_id,
        is_adaptive=q.is_adaptive or False,
        status=q.status or "REVIEW",
        review_status=rev_status,
        generation_engine=q.generation_engine or "deterministic",
        question_count=len(questions_out),
        questions=questions_out,
        created_at=q.created_at,
        updated_at=q.updated_at
    )


# 7a. POST /admin/topics/{topic_id}/quizzes/generate
@router.post("/topics/{topic_id}/quizzes/generate", response_model=AdminQuizOut)
def generate_topic_quiz(
    topic_id: int,
    req: Optional[QuizGenerateRequest] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        count = req.question_count if req else 10
        pass_score = req.passing_score if req else 80.0
        eng = req.engine if req else "deterministic"
        sub_id = req.subtopic_id if req else None

        quiz, job = QuizService.generate_quiz_for_topic(
            db=db,
            topic_id=topic_id,
            subtopic_id=sub_id,
            question_count=count,
            passing_score=pass_score,
            engine_name=eng,
            user_id=admin.id
        )
        return serialize_admin_quiz(quiz)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


# 7b. GET /admin/quizzes (List Quizzes with filtering)
@router.get("/quizzes", response_model=List[AdminQuizOut])
def list_admin_quizzes(
    topic_id: Optional[int] = None,
    chapter_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    is_adaptive: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    query = db.query(Quiz)
    if topic_id:
        query = query.filter(Quiz.topic_id == topic_id)
    if chapter_id:
        query = query.join(Topic, Quiz.topic_id == Topic.id).filter(Topic.chapter_id == chapter_id)
    if subject_id:
        query = query.join(Topic, Quiz.topic_id == Topic.id).join(Chapter, Topic.chapter_id == Chapter.id).filter(Chapter.subject_id == subject_id)
    if status:
        query = query.filter(Quiz.status.ilike(status))
    if is_adaptive is not None:
        query = query.filter(Quiz.is_adaptive == is_adaptive)

    quizzes = query.order_by(Quiz.id.desc()).all()
    return [serialize_admin_quiz(q) for q in quizzes]


# 7c. GET /admin/quizzes/{id} (Inspect Quiz & Questions)
@router.get("/quizzes/{id}", response_model=AdminQuizOut)
def get_admin_quiz(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return serialize_admin_quiz(quiz)


# 7d. PATCH /admin/quizzes/{id} (Update Quiz Meta)
@router.patch("/quizzes/{id}", response_model=AdminQuizOut)
def patch_admin_quiz(
    id: int,
    req: QuizPatchRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if req.title is not None:
        quiz.title = req.title
    if req.description is not None:
        quiz.description = req.description
    if req.passing_score is not None:
        quiz.passing_score = req.passing_score
    if req.status is not None:
        quiz.status = req.status.upper()

    quiz.updated_at = utcnow()
    db.commit()
    db.refresh(quiz)
    return serialize_admin_quiz(quiz)


# 7e. POST /admin/quizzes/{id}/regenerate (Safe Question Regeneration)
@router.post("/quizzes/{id}/regenerate", response_model=AdminQuizOut)
def regenerate_admin_quiz(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        updated = QuizService.regenerate_quiz(db=db, quiz_id=id)
        return serialize_admin_quiz(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {str(e)}")


# 7f. POST /admin/quizzes/{id}/approve
@router.post("/quizzes/{id}/approve", response_model=AdminQuizOut)
def approve_admin_quiz(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        quiz = QuizService.approve_quiz(db, id)
        return serialize_admin_quiz(quiz)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 7g. POST /admin/quizzes/{id}/publish
@router.post("/quizzes/{id}/publish", response_model=AdminQuizOut)
def publish_admin_quiz(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        quiz = QuizService.publish_quiz(db, id)
        return serialize_admin_quiz(quiz)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 7h. POST /admin/quizzes/{id}/archive
@router.post("/quizzes/{id}/archive", response_model=AdminQuizOut)
def archive_admin_quiz(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        quiz = QuizService.archive_quiz(db, id)
        return serialize_admin_quiz(quiz)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 7i. PATCH /admin/questions/{id} (Edit Question)
@router.patch("/questions/{id}", response_model=AdminQuestionOut)
def patch_admin_question(
    id: int,
    req: QuestionPatchRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    q = db.get(Question, id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if req.question_text is not None:
        q.question_text = req.question_text
    if req.options is not None:
        q.options = req.options
    if req.correct_answer is not None:
        q.correct_answer = req.correct_answer
    if req.explanation is not None:
        q.explanation = req.explanation
    if req.difficulty is not None:
        q.difficulty = req.difficulty.upper()
    if req.bloom_level is not None:
        q.bloom_level = req.bloom_level.upper()
    if req.weak_concept is not None:
        q.weak_concept = req.weak_concept

    q.updated_at = utcnow()
    db.commit()
    db.refresh(q)

    return AdminQuestionOut(
        id=q.id,
        quiz_id=q.quiz_id,
        question_text=q.question_text,
        stem=q.stem,
        options=q.options or [],
        correct_answer=q.correct_answer,
        explanation=q.explanation,
        difficulty=q.difficulty or "MEDIUM",
        bloom_level=q.bloom_level or "UNDERSTAND",
        objective=q.objective,
        adaptive=q.adaptive or False,
        weak_concept=q.weak_concept,
        source_reference=q.source_reference,
        source_pages=q.source_pages or [],
        order_index=q.order_index or 0,
        created_at=q.created_at
    )


# 7j. POST /admin/questions/{id}/regenerate (Regenerate Single Question)
@router.post("/questions/{id}/regenerate", response_model=AdminQuestionOut)
def regenerate_admin_question(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    try:
        q = QuizService.regenerate_single_question(db, id)
        return AdminQuestionOut(
            id=q.id,
            quiz_id=q.quiz_id,
            question_text=q.question_text,
            stem=q.stem,
            options=q.options or [],
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            difficulty=q.difficulty or "MEDIUM",
            bloom_level=q.bloom_level or "UNDERSTAND",
            objective=q.objective,
            adaptive=q.adaptive or False,
            weak_concept=q.weak_concept,
            source_reference=q.source_reference,
            source_pages=q.source_pages or [],
            order_index=q.order_index or 0,
            created_at=q.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 7k. DELETE /admin/questions/{id}
@router.delete("/questions/{id}")
def delete_admin_question(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    q = db.get(Question, id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    quiz = q.quiz
    db.delete(q)
    if quiz:
        quiz.question_count = max(0, (quiz.question_count or 1) - 1)
    db.commit()
    return {"message": "Question deleted successfully", "id": id}


# 7l. POST /admin/quizzes/{id}/questions (Add Manual Question)
@router.post("/quizzes/{id}/questions", response_model=AdminQuestionOut, status_code=201)
def add_admin_question(
    id: int,
    req: QuestionCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin"))
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    q = Question(
        quiz_id=quiz.id,
        question_text=req.question_text,
        question_type="MCQ",
        difficulty=req.difficulty.upper(),
        bloom_level=req.bloom_level.upper(),
        correct_answer=req.correct_answer,
        explanation=req.explanation,
        options=req.options,
        weak_concept=req.weak_concept,
        source_reference=req.source_reference,
        order_index=len(quiz.questions) + 1
    )
    db.add(q)
    quiz.question_count = (quiz.question_count or 0) + 1
    db.commit()
    db.refresh(q)

    return AdminQuestionOut(
        id=q.id,
        quiz_id=q.quiz_id,
        question_text=q.question_text,
        stem=q.stem,
        options=q.options or [],
        correct_answer=q.correct_answer,
        explanation=q.explanation,
        difficulty=q.difficulty,
        bloom_level=q.bloom_level,
        objective=q.objective,
        adaptive=q.adaptive or False,
        weak_concept=q.weak_concept,
        source_reference=q.source_reference,
        source_pages=q.source_pages or [],
        order_index=q.order_index,
        created_at=q.created_at
    )


