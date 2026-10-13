from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from ..core.database import get_db
from ..core.security import require_roles, get_current_user
from ..models.models import (
    VideoUnit, Quiz, Question, QuizAttempt, VideoProgress,
    User, SystemSettings, ReviewStatus, Topic, Chapter, Role
)
from ..schemas.schemas import (
    VideoOut, ProgressIn, ProgressOut,
    QuizOut, QuestionOut, AttemptIn, AttemptOut,
    AdaptiveQuizOut, StudentProgressSummary
)
from ..services.pipeline_service import run_stage_6_adaptive_regeneration

router = APIRouter(prefix="/learn", tags=["Student Learning Portal"])

# 1. GET /learn/videos/{id} (Play Published Video Unit - FR-010, NFR-002, CON-002)
# Strictly pre-rendered: zero live video rendering during student playback
@router.get("/videos/{id}", response_model=VideoOut)
def get_video(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    video = db.get(VideoUnit, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video lesson not found")

    # Access control: Must be published to be visible to students (CON-002, ARCH-V-004)
    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if video.review_status != ReviewStatus.published and user_role != "admin":
        raise HTTPException(status_code=404, detail="Video lesson not yet approved or published")

    return VideoOut(
        id=video.id,
        title=video.title,
        topic_id=video.topic_id,
        topic_title=video.topic.title if video.topic else None,
        video_url=video.video_url,
        duration_seconds=video.duration_seconds,
        script_text=video.script_text,
        review_status=video.review_status.value
    )

# 2. POST /learn/videos/{id}/progress (Record Video Playback Progress - FR-010, CDR-007)
@router.post("/videos/{id}/progress", response_model=ProgressOut)
def record_video_progress(
    id: int,
    progress_in: ProgressIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    video = db.get(VideoUnit, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video lesson not found")

    vp = db.query(VideoProgress).filter(
        VideoProgress.video_id == id,
        VideoProgress.user_id == user.id
    ).first()

    if not vp:
        vp = VideoProgress(video_id=id, user_id=user.id)
        db.add(vp)

    vp.progress_pct = max(0.0, min(100.0, progress_in.progress_pct))
    if progress_in.completed is not None:
        vp.completed = progress_in.completed
    elif vp.progress_pct >= 95.0:
        vp.completed = True

    db.commit()
    db.refresh(vp)
    return ProgressOut(
        video_id=vp.video_id,
        user_id=vp.user_id,
        progress_pct=vp.progress_pct,
        completed=vp.completed
    )

# 3. GET /learn/topics/{topicId}/quiz (Retrieve Published Topic Quiz - FR-006, CON-002)
@router.get("/topics/{topicId}/quiz", response_model=QuizOut)
def get_topic_quiz(
    topicId: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    topic = db.get(Topic, topicId)
    if not topic or not topic.quiz:
        raise HTTPException(status_code=404, detail="Quiz for topic not found")

    quiz = topic.quiz
    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if quiz.review_status != ReviewStatus.published and user_role != "admin":
        raise HTTPException(status_code=404, detail="Quiz not yet approved or published")

    questions_out = [
        QuestionOut(
            id=q.id,
            stem=q.stem,
            options=q.options,
            objective=q.objective,
            adaptive=q.adaptive,
            weak_concept=q.weak_concept
        )
        for q in quiz.questions if not q.adaptive
    ]

    return QuizOut(
        id=quiz.id,
        title=quiz.title,
        topic_id=quiz.topic_id,
        topic_title=topic.title,
        review_status=quiz.review_status.value,
        questions=questions_out
    )

# 4. POST /learn/quizzes/{id}/attempts (Submit Quiz Attempt & Score - FR-006, FR-010, CDR-007)
@router.post("/quizzes/{id}/attempts", response_model=AttemptOut)
def submit_quiz_attempt(
    id: int,
    attempt_in: AttemptIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Score calculation
    questions = db.query(Question).filter(Question.quiz_id == id).all()
    if not questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    correct_count = 0
    total_count = len(questions)
    weak_concepts = []

    for q in questions:
        chosen_idx = attempt_in.answers.get(str(q.id))
        if chosen_idx is not None and chosen_idx == q.correct_idx:
            correct_count += 1
        else:
            if q.objective and q.objective not in weak_concepts:
                weak_concepts.append(q.objective)

    score_pct = (correct_count / total_count) * 100.0

    settings = db.query(SystemSettings).first()
    mastery_threshold = settings.mastery_threshold if settings else 80.0
    passed = score_pct >= mastery_threshold

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        answers=attempt_in.answers,
        score=score_pct,
        weak_concepts=weak_concepts
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Post-publication: Trigger Stage 6 Adaptive Quiz Regeneration if weak concepts exist
    if weak_concepts:
        run_stage_6_adaptive_regeneration(db, user.id, attempt.id)

    return AttemptOut(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        user_id=attempt.user_id,
        score=attempt.score,
        passed=passed,
        weak_concepts=attempt.weak_concepts,
        created_at=attempt.created_at
    )

# 5. GET /learn/quizzes/adaptive (Retrieve Basic Adaptive Quiz Questions - FR-011, Stage 6)
@router.get("/quizzes/adaptive", response_model=AdaptiveQuizOut)
def get_adaptive_quiz(
    topic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    # Find recent attempts for this user with weak concepts
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == user.id).order_by(QuizAttempt.created_at.desc()).all()
    all_weak_concepts = []
    for a in attempts:
        for wc in (a.weak_concepts or []):
            if wc not in all_weak_concepts:
                all_weak_concepts.append(wc)

    # Fetch adaptive questions generated for these weak concepts
    adaptive_query = db.query(Question).filter(Question.adaptive == True)
    if all_weak_concepts:
        adaptive_query = adaptive_query.filter(Question.weak_concept.in_(all_weak_concepts))
    
    questions = adaptive_query.limit(10).all()

    # If none yet generated, generate sample adaptive questions targeting foundational topics
    if not questions and all_weak_concepts:
        # Fallback question set
        questions = [
            Question(
                id=9991,
                stem=f"[Adaptive Question] Review fundamental concept for: {all_weak_concepts[0]}",
                options=["Verified standard method", "Incorrect alternative", "Unrelated option", "None"],
                objective=all_weak_concepts[0],
                adaptive=True,
                weak_concept=all_weak_concepts[0]
            )
        ]

    questions_out = [
        QuestionOut(
            id=q.id,
            stem=q.stem,
            options=q.options,
            objective=q.objective,
            adaptive=True,
            weak_concept=q.weak_concept
        )
        for q in questions
    ]

    return AdaptiveQuizOut(
        session_id=f"adapt-{uuid.uuid4().hex[:8]}",
        topic_id=topic_id,
        identified_weak_concepts=all_weak_concepts,
        questions=questions_out
    )

# 6. GET /learn/dashboards/progress (Read-Only Dashboards for Parent, Teacher, Student - FR-010, FR-012, SEC-AUTHZ-004)
@router.get("/dashboards/progress", response_model=StudentProgressSummary)
def get_progress_dashboard(
    student_id: Optional[int] = Query(None, description="Target student ID for parents/teachers [NEEDS CONFIRMATION]"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_uid = current_user.id
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    # Authorization logic per SEC-AUTHZ-003, SEC-AUTHZ-004:
    if user_role in ["parent", "teacher"]:
        # Parent / Teacher accessing student progress
        if student_id:
            target_uid = student_id
        elif current_user.linked_student_id:
            target_uid = current_user.linked_student_id
        else:
            # Pick first available student or raise informative 404
            first_student = db.query(User).filter(User.role == Role.STUDENT).first()
            if first_student:
                target_uid = first_student.id
            else:
                raise HTTPException(status_code=404, detail="No student associated with this account")
    elif user_role == "student":
        # Students may only access their own progress
        target_uid = current_user.id
    elif user_role == "admin":
        if student_id:
            target_uid = student_id

    target_student = db.get(User, target_uid)
    if not target_student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Aggregate summaries only (strictly no raw attempts or raw video files per ARCH-V-006)
    completed_videos = db.query(VideoProgress).filter(
        VideoProgress.user_id == target_uid,
        VideoProgress.completed == True
    ).count()

    total_published_videos = db.query(VideoUnit).filter(
        VideoUnit.review_status == ReviewStatus.published
    ).count()

    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == target_uid).all()
    quizzes_taken = len(attempts)
    avg_score = (sum(a.score for a in attempts) / quizzes_taken) if quizzes_taken > 0 else 0.0

    weak_concepts = []
    mastery_scores = {}
    for a in attempts:
        quiz = db.get(Quiz, a.quiz_id)
        topic_name = quiz.topic.title if (quiz and quiz.topic) else f"Quiz {a.quiz_id}"
        mastery_scores[topic_name] = round(a.score, 1)
        for wc in (a.weak_concepts or []):
            if wc not in weak_concepts:
                weak_concepts.append(wc)

    return StudentProgressSummary(
        student_id=target_student.id,
        student_name=target_student.name,
        completed_videos_count=completed_videos,
        total_videos_count=total_published_videos,
        quizzes_taken_count=quizzes_taken,
        average_quiz_score=round(avg_score, 1),
        mastery_scores=mastery_scores,
        weak_concepts=weak_concepts
    )
