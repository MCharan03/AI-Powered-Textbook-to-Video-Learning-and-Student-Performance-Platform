from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Union
import uuid
from datetime import datetime, timezone

from ..core.database import get_db
from ..core.storage import get_storage
from ..core.security import (
    require_roles, get_current_user,
    resolve_student_for_user, resolve_teacher_for_user, resolve_parent_for_user
)
from ..models.models import (
    Video, Quiz, Question, QuizAttempt, StudentVideoProgress,
    StudentTopicPerformance, User, Student, Parent, Teacher,
    StudentParent, TeacherStudent, StudentSubject, Subject,
    Topic, Chapter, SystemSettings, ReviewStatus, Role,
    MasteryLevel, VideoStatus, Assignment, StudentAssignment
)
from ..schemas.schemas import (
    VideoOut, ProgressIn, ProgressOut,
    QuizOut, QuestionOut, AttemptIn, AttemptOut,
    AdaptiveQuizOut, StudentProgressSummary, SubjectOut,
    ChapterHierarchyOut, TopicHierarchyOut, SubtopicOut,
    VideoPlanOut, StudentQuizResultOut, QuestionResultOut,
    StudentTopicPerformanceOut, ObserverDashboardSummary,
    ObserverStudentAnalytics, DashboardTopicMastery, DashboardTrendPoint,
    ParentChildInfo, ParentSubjectProgress, ParentVideoItem,
    ParentQuizItem, ParentTopicMasteryItem, ParentAssignmentItem,
    ParentActivityItem, ParentChildProgressResponse,
    StudentResumeLearning, StudentModuleCard
)
from ..services.pipeline_service import run_stage_6_adaptive_regeneration
from ..services.quiz_service import QuizService

router = APIRouter(prefix="/learn", tags=["Student Learning Portal"])


# 1. GET /learn/subjects (Retrieve Subjects Assigned to Student - RBAC Scope)
@router.get("/subjects", response_model=List[SubjectOut])
def get_student_subjects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    role_str = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    if role_str == "admin":
        return db.query(Subject).all()
    elif role_str == "student":
        student = resolve_student_for_user(user, db)
        if not student:
            return []
        # Return only subjects assigned to this student
        assigned = db.query(StudentSubject).filter(StudentSubject.student_id == student.id).all()
        subj_ids = [a.subject_id for a in assigned]
        return db.query(Subject).filter(Subject.id.in_(subj_ids)).all()
    elif role_str == "teacher":
        return db.query(Subject).all()
    elif role_str == "parent":
        parent = resolve_parent_for_user(user, db)
        if not parent:
            return []
        child_links = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
        child_ids = [c.student_id for c in child_links]
        assigned = db.query(StudentSubject).filter(StudentSubject.student_id.in_(child_ids)).all()
        subj_ids = [a.subject_id for a in assigned]
        return db.query(Subject).filter(Subject.id.in_(subj_ids)).all()
    return []


# 1b. GET /learn/subjects/{subject_id}/curriculum (Approved Curriculum Only - Student Visibility Isolation)
@router.get("/subjects/{subject_id}/curriculum", response_model=List[ChapterHierarchyOut])
@router.get("/subjects/{subject_id}/chapters", response_model=List[ChapterHierarchyOut])
def get_subject_curriculum(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    role_str = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    
    # 1. Access verification
    if role_str == "student":
        student = resolve_student_for_user(user, db)
        if not student:
            raise HTTPException(status_code=403, detail="Student record not found")
        assigned = db.query(StudentSubject).filter(
            StudentSubject.student_id == student.id,
            StudentSubject.subject_id == subject_id
        ).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="Student is not assigned to this subject")
    elif role_str == "parent":
        parent = resolve_parent_for_user(user, db)
        if not parent:
            raise HTTPException(status_code=403, detail="Parent record not found")
        child_links = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
        child_ids = [c.student_id for c in child_links]
        assigned = db.query(StudentSubject).filter(
            StudentSubject.student_id.in_(child_ids),
            StudentSubject.subject_id == subject_id
        ).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="None of your children are assigned to this subject")
    
    # 2. Query only APPROVED chapters
    chapters = db.query(Chapter).filter(
        Chapter.subject_id == subject_id,
        Chapter.status == "APPROVED"
    ).order_by(Chapter.chapter_number.asc(), Chapter.order_idx.asc()).all()

    output = []
    for ch in chapters:
        # Only APPROVED topics
        approved_topics = [t for t in ch.topics if (getattr(t, "status", None) == "APPROVED" or getattr(t, "status", None) is None)]
        topics_out = []
        for top in approved_topics:
            approved_subs = [s for s in top.subtopics if (getattr(s, "status", None) == "APPROVED" or getattr(s, "status", None) is None)]
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
                subtopics=[SubtopicOut.model_validate(s) for s in approved_subs]
            ))
        output.append(ChapterHierarchyOut(
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

    return output


# 2. GET /learn/videos/{id} (Play Published Video Unit)
@router.get("/videos/{id}", response_model=VideoOut)
def get_video(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video lesson not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()

    # Access control: Must be published or approved to be visible to students/parents
    is_published = (video.status.upper() in ["PUBLISHED", "APPROVED"] or video.status.lower() == "published")
    if not is_published and user_role not in ["admin", "teacher"]:
        raise HTTPException(status_code=404, detail="Video lesson not yet approved or published")

    # Access control: Student can only access video from assigned subjects
    if user_role == "student":
        student = resolve_student_for_user(user, db)
        if student and video.topic and video.topic.chapter:
            subj_id = video.topic.chapter.subject_id
            assigned_count = db.query(StudentSubject).filter(StudentSubject.student_id == student.id).count()
            if assigned_count > 0:
                is_assigned = db.query(StudentSubject).filter(
                    StudentSubject.student_id == student.id,
                    StudentSubject.subject_id == subj_id
                ).first()
                if not is_assigned:
                    raise HTTPException(status_code=403, detail="Student is not assigned to this subject")

    if user_role not in ["admin", "teacher"]:
        # Student users must never receive a placeholder video or an unrendered published video
        is_placeholder = any(p in (video.video_storage_key or video.storage_key or "").lower() for p in ["seed_", "sample.mp4", "placeholder"])
        if is_placeholder or (video.status.upper() == "PUBLISHED" and (video.render_status != "RENDERED" or (video.actual_duration_seconds or 0) <= 0)):
            raise HTTPException(status_code=404, detail="Video lesson not yet rendered or published")

    topic = video.topic
    chapter = topic.chapter if topic else None
    subject = chapter.subject if chapter else None

    storage = get_storage()
    effective_key = video.video_storage_key or video.storage_key or video.video_url
    playable_url = storage.get_url(effective_key) if effective_key else (video.video_url or "")

    rev_str = video.review_status.value if hasattr(video.review_status, "value") else str(video.review_status)
    return VideoOut(
        id=video.id,
        title=video.title,
        topic_id=video.topic_id,
        topic_title=topic.title if topic else None,
        subtopic_id=video.subtopic_id,
        video_url=playable_url,
        storage_key=video.storage_key,
        duration_seconds=int(video.actual_duration_seconds or video.duration_seconds or 330),
        script_text=video.script_text if user_role in ["admin", "teacher"] else "",
        status=video.status,
        review_status=rev_str,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        chapter_id=chapter.id if chapter else None,
        chapter_title=chapter.title if chapter else None,
        description=video.description,
        learning_objective=video.learning_objective,
        content_outline=video.content_outline or [],
        actual_duration_seconds=video.actual_duration_seconds
    )


# 2b. GET /learn/topics/{topic_id}/videos (Get Approved Videos/Plans for Topic)
@router.get("/topics/{topic_id}/videos", response_model=List[VideoPlanOut])
@router.get("/topics/{topic_id}/video-plans", response_model=List[VideoPlanOut])
def get_topic_videos(
    topic_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()

    if user_role == "student":
        student = resolve_student_for_user(user, db)
        if not student:
            raise HTTPException(status_code=403, detail="Student record not found")
        if topic.chapter:
            subj_id = topic.chapter.subject_id
            assigned = db.query(StudentSubject).filter(
                StudentSubject.student_id == student.id,
                StudentSubject.subject_id == subj_id
            ).first()
            if not assigned:
                raise HTTPException(status_code=403, detail="Student is not assigned to this subject")

    # Only return APPROVED or PUBLISHED videos for students/parents
    videos = db.query(Video).filter(Video.topic_id == topic_id)
    if user_role not in ["admin", "teacher"]:
        videos = videos.filter(Video.status.in_(["APPROVED", "PUBLISHED", "approved", "published"]))
        videos = videos.filter(
            Video.render_status == "RENDERED",
            (Video.actual_duration_seconds > 0) | (Video.duration_seconds > 0)
        )

    res = videos.order_by(Video.sequence_number.asc()).all()
    if user_role not in ["admin", "teacher"]:
        res = [
            v for v in res
            if not any(p in (v.video_storage_key or v.storage_key or "").lower() for p in ["seed_", "sample.mp4", "placeholder"])
        ]
    chapter = topic.chapter
    subject = chapter.subject if chapter else None

    return [
        VideoPlanOut(
            id=v.id,
            title=v.title,
            description=v.description,
            topic_id=v.topic_id,
            topic_title=topic.title,
            chapter_id=chapter.id if chapter else None,
            chapter_title=chapter.title if chapter else None,
            subject_id=subject.id if subject else None,
            subject_name=subject.name if subject else None,
            subtopic_id=v.subtopic_id,
            subtopic_title=v.subtopic.title if v.subtopic else None,
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
        for v in res
    ]


# 3. POST /learn/videos/{id}/progress (Record Video Playback Progress)
@router.post("/videos/{id}/progress", response_model=ProgressOut)
def record_video_progress(
    id: int,
    progress_in: ProgressIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    video = db.get(Video, id)
    if not video:
        raise HTTPException(status_code=404, detail="Video lesson not found")

    # Resolve student
    student = resolve_student_for_user(user, db)
    if not student:
        # If admin without student record, find or create dummy student profile for test execution
        first_stu = db.query(Student).first()
        if first_stu:
            student = first_stu
        else:
            student = Student(user_id=user.id, student_id=f"ADM-STU-{user.id}", name=user.display_name)
            db.add(student)
            db.commit()
            db.refresh(student)

    vp = db.query(StudentVideoProgress).filter(
        StudentVideoProgress.video_id == id,
        StudentVideoProgress.student_id == student.id
    ).first()

    pct = progress_in.watch_percentage if progress_in.watch_percentage is not None else progress_in.progress_pct
    if pct is None:
        pct = 0.0

    pos_sec = progress_in.last_position_seconds if progress_in.last_position_seconds is not None else 0.0

    if not vp:
        vp = StudentVideoProgress(
            video_id=id,
            student_id=student.id,
            watch_percentage=max(0.0, min(100.0, pct)),
            last_position_seconds=max(0.0, pos_sec),
            started_at=datetime.now(timezone.utc)
        )
        db.add(vp)
    else:
        vp.watch_percentage = max(0.0, min(100.0, pct))
        vp.last_position_seconds = max(0.0, pos_sec)

    if progress_in.completed is not None:
        vp.completed = progress_in.completed
    elif vp.watch_percentage >= 95.0:
        vp.completed = True

    if vp.completed and not vp.completed_at:
        vp.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(vp)
    return ProgressOut(
        video_id=vp.video_id,
        user_id=student.user_id,
        progress_pct=vp.watch_percentage,
        last_position_seconds=vp.last_position_seconds,
        completed=vp.completed
    )


# ==============================================================================
# BUILD 07: STUDENT QUIZ, MASTERY, & ADAPTIVE REMEDIATION ENDPOINTS
# ==============================================================================

def serialize_student_quiz(quiz: Quiz) -> QuizOut:
    topic_title = quiz.topic.title if quiz.topic else None
    rev_str = quiz.review_status.value if hasattr(quiz.review_status, "value") else str(quiz.review_status)
    questions_out = [
        QuestionOut(
            id=q.id,
            stem=q.stem,
            question_text=q.question_text,
            options=q.options or [],
            objective=q.objective,
            adaptive=q.adaptive or False,
            weak_concept=q.weak_concept,
            question_type=q.question_type or "MCQ",
            difficulty=q.difficulty or "MEDIUM",
            bloom_level=q.bloom_level or "UNDERSTAND",
            source_reference=q.source_reference,
            source_pages=q.source_pages or [],
            order_index=q.order_index or 0
        )
        for q in quiz.questions
    ]
    return QuizOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        topic_id=quiz.topic_id,
        topic_title=topic_title,
        quiz_type=quiz.quiz_type or "TOPIC",
        passing_score=quiz.passing_score or 80.0,
        attempt_number=quiz.attempt_number or 1,
        parent_quiz_id=quiz.parent_quiz_id,
        is_adaptive=quiz.is_adaptive or False,
        status=quiz.status,
        review_status=rev_str,
        questions=questions_out
    )


def _get_student_context(user: User, db: Session) -> Student:
    student = resolve_student_for_user(user, db)
    if not student:
        student = db.query(Student).filter(Student.user_id == user.id).first()
    if not student:
        student = Student(
            user_id=user.id,
            student_id=f"STU-{user.id:04d}",
            name=user.display_name or user.name or user.username,
            class_="Grade 11"
        )
        db.add(student)
        db.commit()
        db.refresh(student)
    return student


# 4a. GET /learn/topics/{topicId}/quizzes (List Published Quizzes for Topic)
@router.get("/topics/{topicId}/quizzes", response_model=List[QuizOut])
def list_topic_quizzes(
    topicId: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    topic = db.get(Topic, topicId)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    student = resolve_student_for_user(user, db) if user_role == "student" else None

    # Retrieve published quizzes
    query = db.query(Quiz).filter(Quiz.topic_id == topicId)
    if user_role not in ["admin", "teacher"]:
        query = query.filter(Quiz.status.ilike("PUBLISHED"))

    quizzes = query.order_by(Quiz.is_adaptive.asc(), Quiz.attempt_number.asc()).all()
    return [serialize_student_quiz(q) for q in quizzes]


# 4b. GET /learn/topics/{topicId}/quiz (Retrieve Primary Published Topic Quiz)
@router.get("/topics/{topicId}/quiz", response_model=QuizOut)
def get_topic_quiz(
    topicId: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    topic = db.get(Topic, topicId)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()

    # Find the primary non-adaptive published quiz
    quiz = db.query(Quiz).filter(
        Quiz.topic_id == topicId,
        Quiz.is_adaptive == False
    ).order_by(Quiz.id.asc()).first()

    if not quiz:
        # Check any quiz for topic
        quiz = topic.quizzes[0] if topic.quizzes else None

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz for topic not found")

    is_published = (quiz.status.upper() == "PUBLISHED" or quiz.review_status == ReviewStatus.published)
    if not is_published and user_role not in ["admin", "teacher"]:
        raise HTTPException(status_code=404, detail="Quiz not yet approved or published")

    # Subject enrollment access check
    if user_role == "student":
        student = resolve_student_for_user(user, db)
        if student and topic.chapter:
            subj_id = topic.chapter.subject_id
            assigned_count = db.query(StudentSubject).filter(StudentSubject.student_id == student.id).count()
            if assigned_count > 0:
                is_assigned = db.query(StudentSubject).filter(
                    StudentSubject.student_id == student.id,
                    StudentSubject.subject_id == subj_id
                ).first()
                if not is_assigned:
                    raise HTTPException(status_code=403, detail="Student is not assigned to this subject")

    return serialize_student_quiz(quiz)


# 4b2. GET /learn/quizzes/adaptive (Retrieve Adaptive Quiz Questions - Legacy & Quick Remediation)
@router.get("/quizzes/adaptive", response_model=AdaptiveQuizOut)
def get_adaptive_quiz(
    topic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = resolve_student_for_user(user, db)
    stu_id = student.id if student else None

    # Find recent attempts for this student with weak concepts
    attempts_query = db.query(QuizAttempt)
    if stu_id:
        attempts_query = attempts_query.filter(QuizAttempt.student_id == stu_id)
    attempts = attempts_query.order_by(QuizAttempt.submitted_at.desc()).all()

    all_weak_concepts = []
    for a in attempts:
        for wc in (a.weak_concepts or []):
            if wc not in all_weak_concepts:
                all_weak_concepts.append(wc)

    adaptive_query = db.query(Question).filter(Question.adaptive == True)
    if all_weak_concepts:
        adaptive_query = adaptive_query.filter(Question.weak_concept.in_(all_weak_concepts))

    questions = adaptive_query.limit(10).all()

    if not questions and all_weak_concepts:
        questions = [
            Question(
                id=9991,
                quiz_id=1,
                question_text=f"[Adaptive Question] Review fundamental concept for: {all_weak_concepts[0]}",
                options=["Verified standard method", "Incorrect alternative", "Unrelated option", "None"],
                correct_answer="0",
                objective=all_weak_concepts[0],
                adaptive=True,
                weak_concept=all_weak_concepts[0]
            )
        ]

    questions_out = [
        QuestionOut(
            id=q.id,
            quiz_id=q.quiz_id,
            stem=q.stem or q.question_text or "",
            question_text=q.question_text or q.stem or "",
            options=q.options or [],
            objective=q.objective,
            adaptive=True,
            weak_concept=q.weak_concept,
            question_type=q.question_type or "MCQ",
            difficulty=q.difficulty or "MEDIUM"
        )
        for q in questions
    ]

    return AdaptiveQuizOut(
        session_id=f"adapt-{uuid.uuid4().hex[:8]}",
        topic_id=topic_id,
        identified_weak_concepts=all_weak_concepts,
        questions=questions_out
    )


# 4c. GET /learn/quizzes/{id} (Retrieve Published Quiz by ID - Without Answers)
@router.get("/quizzes/{id}", response_model=QuizOut)
def get_quiz_by_id(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    is_published = (quiz.status.upper() == "PUBLISHED" or quiz.review_status == ReviewStatus.published)
    if not is_published and user_role not in ["admin", "teacher"]:
        raise HTTPException(status_code=404, detail="Quiz not yet approved or published")

    return serialize_student_quiz(quiz)


# 4d. POST /learn/quizzes/{id}/start (Start Quiz Attempt Session)
@router.post("/quizzes/{id}/start", response_model=QuizOut)
def start_quiz_session(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    if quiz.status.upper() != "PUBLISHED" and user_role not in ["admin", "teacher"]:
        raise HTTPException(status_code=404, detail="Quiz is not published")

    return serialize_student_quiz(quiz)


# 5. POST /learn/quizzes/{id}/attempts & POST /learn/quizzes/{id}/submit (Submit Quiz Attempt & Auto-Grade)
@router.post("/quizzes/{id}/attempts", response_model=StudentQuizResultOut)
@router.post("/quizzes/{id}/submit", response_model=StudentQuizResultOut)
def submit_quiz_attempt(
    id: int,
    attempt_in: AttemptIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    quiz = db.get(Quiz, id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    if quiz.status.upper() != "PUBLISHED" and user_role not in ["admin", "teacher"]:
        raise HTTPException(status_code=404, detail="Quiz is not published")

    student = _get_student_context(user, db)

    try:
        eval_res = QuizService.evaluate_attempt(
            db=db,
            quiz_id=id,
            student_id=student.id,
            answers=attempt_in.answers
        )

        return StudentQuizResultOut(
            id=eval_res["attempt_id"],
            attempt_id=eval_res["attempt_id"],
            quiz_id=eval_res["quiz_id"],
            student_id=eval_res["student_id"],
            user_id=student.user_id,
            score=eval_res["score"],
            total_questions=eval_res["total_questions"],
            percentage=eval_res["percentage"],
            passed=eval_res["passed"],
            passing_score=eval_res["passing_score"],
            mastery_level=eval_res["mastery_level"],
            weak_concepts=eval_res["weak_concepts"],
            recommendation=eval_res["recommendation"],
            adaptive_recommended=eval_res["adaptive_recommended"],
            question_results=[QuestionResultOut(**qr) for qr in eval_res["question_results"]],
            submitted_at=eval_res["submitted_at"],
            created_at=eval_res["submitted_at"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")


# 5b. GET /learn/quizzes/{id}/attempts (List Student's Own Quiz Attempts)
@router.get("/quizzes/{id}/attempts", response_model=List[StudentQuizResultOut])
def get_quiz_attempts(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = _get_student_context(user, db)

    # Privacy constraint: student can ONLY retrieve their own attempts
    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == id,
        QuizAttempt.student_id == student.id
    ).order_by(QuizAttempt.submitted_at.desc()).all()

    out = []
    for att in attempts:
        q_results = [QuestionResultOut(**qr) for qr in (att.question_results or [])]
        out.append(StudentQuizResultOut(
            id=att.id,
            attempt_id=att.id,
            quiz_id=att.quiz_id,
            student_id=att.student_id,
            user_id=student.user_id,
            score=att.score,
            total_questions=att.total_questions,
            percentage=att.percentage,
            passed=att.passed,
            passing_score=att.quiz.passing_score if att.quiz else 80.0,
            weak_concepts=att.weak_concepts or [],
            recommendation="Review completed attempt.",
            adaptive_recommended=not att.passed,
            question_results=q_results,
            submitted_at=att.submitted_at,
            created_at=att.submitted_at
        ))
    return out


# 5c. GET /learn/topics/{topicId}/performance (Retrieve Student's Topic Mastery Performance)
@router.get("/topics/{topicId}/performance", response_model=StudentTopicPerformanceOut)
def get_topic_performance(
    topicId: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = _get_student_context(user, db)
    topic = db.get(Topic, topicId)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    perf = db.query(StudentTopicPerformance).filter(
        StudentTopicPerformance.student_id == student.id,
        StudentTopicPerformance.topic_id == topicId
    ).first()

    if not perf:
        return StudentTopicPerformanceOut(
            student_id=student.id,
            topic_id=topicId,
            topic_title=topic.title,
            attempts=0,
            best_score=0.0,
            latest_score=0.0,
            mastery_level=MasteryLevel.NOT_STARTED.value,
            last_attempted_at=None
        )

    return StudentTopicPerformanceOut(
        student_id=student.id,
        topic_id=topicId,
        topic_title=topic.title,
        attempts=perf.attempts,
        best_score=perf.best_score,
        latest_score=perf.latest_score,
        mastery_level=perf.mastery_level,
        last_attempted_at=perf.last_attempted_at
    )


# 5d. POST /learn/topics/{topicId}/adaptive-quiz (Generate Adaptive Remediation Quiz for Student)
@router.post("/topics/{topicId}/adaptive-quiz", response_model=QuizOut)
def create_adaptive_quiz_for_student(
    topicId: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = _get_student_context(user, db)
    try:
        adaptive_quiz = QuizService.generate_adaptive_quiz(
            db=db,
            topic_id=topicId,
            student_id=student.id
        )
        return serialize_student_quiz(adaptive_quiz)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adaptive quiz generation failed: {str(e)}")



# 7. GET /learn/dashboards/progress (Read-Only Dashboards with Granular RBAC)
def _get_observer_students(user: User, db: Session) -> List[Student]:
    role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    if role == "parent":
        parent = resolve_parent_for_user(user, db)
        linked_ids = set()
        if parent:
            linked_ids.update(
                row.student_id
                for row in db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
            )
        if user.linked_student_id:
            legacy_student = db.query(Student).filter(Student.user_id == user.linked_student_id).first()
            if not legacy_student:
                legacy_student = db.get(Student, user.linked_student_id)
            if legacy_student:
                linked_ids.add(legacy_student.id)
        if not linked_ids:
            return []
        return db.query(Student).filter(Student.id.in_(linked_ids)).order_by(Student.name.asc()).all()

    if role == "teacher":
        teacher = resolve_teacher_for_user(user, db)
        if not teacher:
            return []
        assigned_ids = [
            row.student_id
            for row in db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher.id).all()
        ]
        if not assigned_ids:
            return []
        return db.query(Student).filter(Student.id.in_(assigned_ids)).order_by(Student.name.asc()).all()

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Observer dashboard access is limited to parents and teachers")


def _student_observer_analytics(student: Student, db: Session) -> ObserverStudentAnalytics:
    subject_ids = [
        row.subject_id
        for row in db.query(StudentSubject).filter(StudentSubject.student_id == student.id).all()
    ]
    topics = db.query(Topic).join(Chapter, Topic.chapter_id == Chapter.id)
    if subject_ids:
        topics = topics.filter(Chapter.subject_id.in_(subject_ids))
        topics = topics.all()
    else:
        topics = []
    total_topics = len(topics)

    performances = (
        db.query(StudentTopicPerformance, Topic)
        .join(Topic, StudentTopicPerformance.topic_id == Topic.id)
        .filter(StudentTopicPerformance.student_id == student.id)
        .all()
    )
    topic_mastery = [
        DashboardTopicMastery(
            topic=topic.title,
            score=round(float(performance.latest_score or 0), 1),
            mastery_level=str(performance.mastery_level or "NOT_STARTED").upper(),
        )
        for performance, topic in performances
        if not subject_ids or topic.chapter.subject_id in subject_ids
    ]
    mastery_threshold = 80.0
    settings = db.query(SystemSettings).first()
    if settings:
        mastery_threshold = float(settings.mastery_threshold)
    topics_completed = sum(
        1 for item in topic_mastery
        if item.mastery_level == MasteryLevel.MASTERED.value or item.score >= mastery_threshold
    )

    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student.id)
        .order_by(QuizAttempt.submitted_at.asc())
        .all()
    )
    if subject_ids:
        attempts = [
            attempt for attempt in attempts
            if attempt.quiz and attempt.quiz.topic and attempt.quiz.topic.chapter.subject_id in subject_ids
        ]
    attempt_scores = [
        float(attempt.percentage if attempt.percentage is not None else (
            (attempt.score / attempt.total_questions * 100) if attempt.total_questions else 0
        ))
        for attempt in attempts
    ]
    average_quiz_score = round(sum(attempt_scores) / len(attempt_scores), 1) if attempt_scores else 0.0
    mastery_scores = [item.score for item in topic_mastery]
    mastery_percentage = round(sum(mastery_scores) / len(mastery_scores), 1) if mastery_scores else average_quiz_score

    month_scores: dict[str, list[float]] = {}
    cutoff = datetime.now(timezone.utc).replace(day=1)
    cutoff_index = cutoff.year * 12 + cutoff.month - 1 - 5
    for attempt, score in zip(attempts, attempt_scores):
        submitted_at = attempt.submitted_at
        if not submitted_at:
            continue
        month = submitted_at.strftime("%Y-%m")
        month_index = submitted_at.year * 12 + submitted_at.month - 1
        if month_index >= cutoff_index:
            month_scores.setdefault(month, []).append(score)
    score_trend = [
        DashboardTrendPoint(month=month, average_score=round(sum(scores) / len(scores), 1), assessments_count=len(scores))
        for month, scores in sorted(month_scores.items())
    ]

    video_query = db.query(Video).filter(Video.status.in_([VideoStatus.PUBLISHED.value, "published"]))
    if subject_ids:
        video_query = video_query.join(Topic, Video.topic_id == Topic.id).join(Chapter, Topic.chapter_id == Chapter.id).filter(Chapter.subject_id.in_(subject_ids))
        total_videos = video_query.count()
        completed_videos = (
            db.query(StudentVideoProgress)
            .join(Video, StudentVideoProgress.video_id == Video.id)
            .join(Topic, Video.topic_id == Topic.id)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .filter(
                StudentVideoProgress.student_id == student.id,
                StudentVideoProgress.completed.is_(True),
                Video.status.in_([VideoStatus.PUBLISHED.value, "published"]),
                Chapter.subject_id.in_(subject_ids),
            )
            .count()
        )
    else:
        total_videos = 0
        completed_videos = 0

    weak_concepts = list(dict.fromkeys(
        concept
        for attempt in attempts
        for concept in (attempt.weak_concepts or [])
    ))
    return ObserverStudentAnalytics(
        student_id=student.user_id,
        student_name=student.name,
        student_code=student.student_id,
        class_name=student.class_,
        section=student.section,
        mastery_percentage=mastery_percentage,
        average_quiz_score=average_quiz_score,
        topics_completed=topics_completed,
        total_topics=total_topics,
        videos_completed=completed_videos,
        total_videos=total_videos,
        quizzes_taken=len(attempts),
        weak_concepts=weak_concepts,
        topic_mastery=topic_mastery,
        score_trend=score_trend,
    )


@router.get("/dashboards/observer", response_model=ObserverDashboardSummary)
def get_observer_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role).lower()
    if role not in {"parent", "teacher"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Observer dashboard access is limited to parents and teachers")

    students = _get_observer_students(current_user, db)
    analytics = [_student_observer_analytics(student, db) for student in students]
    mastery_values = [item.mastery_percentage for item in analytics]
    quiz_values = [item.average_quiz_score for item in analytics]
    total_videos = sum(item.total_videos for item in analytics)
    completed_videos = sum(item.videos_completed for item in analytics)

    cohort_months: dict[str, list[float]] = {}
    for student in analytics:
        for point in student.score_trend:
            cohort_months.setdefault(point.month, []).extend([point.average_score] * point.assessments_count)
    score_trend = [
        DashboardTrendPoint(month=month, average_score=round(sum(scores) / len(scores), 1), assessments_count=len(scores))
        for month, scores in sorted(cohort_months.items())
    ]
    attention_threshold = float(db.query(SystemSettings).first().mastery_threshold) if db.query(SystemSettings).first() else 80.0

    return ObserverDashboardSummary(
        role=role,
        students_count=len(analytics),
        average_mastery_percentage=round(sum(mastery_values) / len(mastery_values), 1) if mastery_values else 0.0,
        average_quiz_score=round(sum(quiz_values) / len(quiz_values), 1) if quiz_values else 0.0,
        video_completion_percentage=round(completed_videos / total_videos * 100, 1) if total_videos else 0.0,
        students_needing_attention=sum(
            1 for item in analytics
            if item.mastery_percentage < attention_threshold or bool(item.weak_concepts)
        ),
        score_trend=score_trend,
        students=analytics,
    )


@router.get("/dashboards/progress", response_model=StudentProgressSummary)
def get_progress_dashboard(
    student_id: Optional[int] = Query(None, description="Target student ID (students.id or users.id)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role).lower()
    target_student: Optional[Student] = None

    # ==========================================
    # RBAC DATA ISOLATION LOGIC
    # ==========================================
    if user_role == "student":
        # Students may ONLY access their own progress; ignore spoofed query parameter (SEC-PRIV-001)
        student = resolve_student_for_user(current_user, db)
        if not student:
            raise HTTPException(status_code=404, detail="Student profile not found")
        target_student = student

    elif user_role == "parent":
        # Parents can ONLY access linked children via student_parents
        parent = resolve_parent_for_user(current_user, db)
        # All linked students for this parent
        linked_records = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all() if parent else []
        linked_student_ids = [lr.student_id for lr in linked_records]

        # Also support legacy linked_student_id on User (points to users.id)
        if current_user.linked_student_id:
            legacy_stu = db.query(Student).filter(Student.user_id == current_user.linked_student_id).first()
            if not legacy_stu:
                legacy_stu = db.get(Student, current_user.linked_student_id)
            if legacy_stu and legacy_stu.id not in linked_student_ids:
                linked_student_ids.append(legacy_stu.id)

        if student_id is not None:
            cand = db.query(Student).filter(Student.user_id == student_id).first()
            if not cand:
                cand = db.get(Student, student_id)
            if not cand or cand.id not in linked_student_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: Parent is not linked to this student")
            target_student = cand
        else:
            if not linked_student_ids:
                raise HTTPException(status_code=404, detail="No linked student associated with this parent account")
            target_student = db.get(Student, linked_student_ids[0])

    elif user_role == "teacher":
        # Teachers can ONLY access assigned students via teacher_students
        teacher = resolve_teacher_for_user(current_user, db)
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher profile not found")

        assigned_records = db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher.id).all()
        assigned_student_ids = [ar.student_id for ar in assigned_records]

        if student_id is not None:
            cand = db.query(Student).filter(Student.user_id == student_id).first()
            if not cand:
                cand = db.get(Student, student_id)
            if not cand or cand.id not in assigned_student_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: Teacher is not assigned to this student")
            target_student = cand
        else:
            if assigned_student_ids:
                target_student = db.get(Student, assigned_student_ids[0])
            else:
                raise HTTPException(status_code=404, detail="No assigned student is associated with this teacher account")

    elif user_role == "admin":
        if student_id is not None:
            target_student = db.get(Student, student_id)
            if not target_student:
                target_student = db.query(Student).filter(Student.user_id == student_id).first()
        if not target_student:
            target_student = db.query(Student).first()
            if not target_student:
                raise HTTPException(status_code=404, detail="No students found")

    if not target_student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 1. Resolve student's assigned subjects
    assigned_records = db.query(StudentSubject).filter(StudentSubject.student_id == target_student.id).all()
    assigned_subject_ids = [r.subject_id for r in assigned_records]
    
    if assigned_subject_ids:
        assigned_subj_objs = db.query(Subject).filter(Subject.id.in_(assigned_subject_ids)).order_by(Subject.name.asc()).all()
        assigned_subject_names = [s.name for s in assigned_subj_objs]
    else:
        assigned_subject_names = []

    # 2. Query only valid published and rendered videos for assigned subjects
    valid_videos: List[Video] = []
    if assigned_subject_ids:
        raw_videos = (
            db.query(Video)
            .join(Topic, Video.topic_id == Topic.id)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .filter(
                Chapter.subject_id.in_(assigned_subject_ids),
                Chapter.status == "APPROVED",
                Video.status.in_([VideoStatus.PUBLISHED.value, "published", "PUBLISHED"]),
                Video.render_status == "RENDERED"
            )
            .order_by(Chapter.order_idx.asc(), Topic.order_idx.asc(), Video.sequence_number.asc())
            .all()
        )
        for v in raw_videos:
            storage_key_val = (v.video_storage_key or v.storage_key or "").lower()
            is_placeholder = any(p in storage_key_val for p in ["seed_", "sample.mp4", "placeholder"])
            duration = (v.actual_duration_seconds or 0) or (v.duration_seconds or 0)
            if not is_placeholder and duration > 0:
                valid_videos.append(v)

    total_published_videos = len(valid_videos)

    # 3. Resume Learning Selection
    progress_records = db.query(StudentVideoProgress).filter(
        StudentVideoProgress.student_id == target_student.id
    ).all()
    progress_by_vid = {p.video_id: p for p in progress_records}

    completed_videos = sum(1 for v in valid_videos if progress_by_vid.get(v.id) and progress_by_vid[v.id].completed)

    chosen_video: Optional[Video] = None
    # In-progress video first
    for v in valid_videos:
        p = progress_by_vid.get(v.id)
        if p and not p.completed and (getattr(p, 'watch_percentage', 0.0) or 0) > 0:
            chosen_video = v
            break

    # First uncompleted video second
    if not chosen_video:
        for v in valid_videos:
            p = progress_by_vid.get(v.id)
            if not p or not p.completed:
                chosen_video = v
                break

    # Fallback to first available valid video
    if not chosen_video and valid_videos:
        chosen_video = valid_videos[0]

    resume_learning: Optional[StudentResumeLearning] = None
    if chosen_video:
        prog = progress_by_vid.get(chosen_video.id)
        dur = int(chosen_video.actual_duration_seconds or chosen_video.duration_seconds or 330)
        dur_str = f"{dur // 60} min {dur % 60:02d} sec"
        top = chosen_video.topic
        chap = top.chapter if top else None
        subj = chap.subject if chap else None

        resume_learning = StudentResumeLearning(
            video_id=chosen_video.id,
            video_title=chosen_video.title,
            subject_id=subj.id if subj else None,
            subject_name=subj.name if subj else None,
            chapter_id=chap.id if chap else None,
            chapter_title=chap.title if chap else None,
            topic_id=top.id if top else None,
            topic_title=top.title if top else None,
            duration_seconds=dur,
            duration_minutes_formatted=dur_str,
            progress_percentage=float(prog.watch_percentage) if prog and prog.watch_percentage else 0.0,
            completed=bool(prog.completed) if prog else False,
            video_url=get_storage().get_url(chosen_video.video_storage_key or chosen_video.storage_key) if (chosen_video.video_storage_key or chosen_video.storage_key) else (chosen_video.video_url or ""),
            description=chosen_video.description or f"Pre-rendered lesson covering {chosen_video.title}.",
            learning_objective=chosen_video.learning_objective
        )

    # 4. Learning Modules (Videos)
    modules_out: List[StudentModuleCard] = []
    for v in valid_videos:
        top = v.topic
        chap = top.chapter if top else None
        subj = chap.subject if chap else None
        dur = int(v.actual_duration_seconds or v.duration_seconds or 330)
        p = progress_by_vid.get(v.id)
        status_label = "Completed" if (p and p.completed) else ("In Progress" if (p and (getattr(p, 'watch_percentage', 0.0) or 0) > 0) else "Ready to Watch")
        modules_out.append(StudentModuleCard(
            id=v.id,
            title=v.title,
            type="video",
            subject_name=subj.name if subj else "General",
            chapter_title=chap.title if chap else "",
            topic_title=top.title if top else "",
            topic_id=top.id if top else 0,
            item_id=v.id,
            duration_seconds=dur,
            status=status_label,
            action_label="Open Player →",
            action_route="student-video"
        ))

    # 5. Learning Quizzes
    quizzes_out: List[StudentModuleCard] = []
    if assigned_subject_ids:
        raw_quizzes = (
            db.query(Quiz)
            .join(Topic, Quiz.topic_id == Topic.id)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .filter(
                Chapter.subject_id.in_(assigned_subject_ids),
                Chapter.status == "APPROVED",
                Quiz.status.in_(["PUBLISHED", "published"])
            )
            .order_by(Quiz.id.asc())
            .all()
        )
        for q in raw_quizzes:
            top = q.topic
            chap = top.chapter if top else None
            subj = chap.subject if chap else None
            quizzes_out.append(StudentModuleCard(
                id=q.id,
                title=q.title,
                type="quiz",
                subject_name=subj.name if subj else "General",
                chapter_title=chap.title if chap else "",
                topic_title=top.title if top else "",
                topic_id=top.id if top else 0,
                item_id=q.id,
                question_count=len(q.questions),
                status=f"{len(q.questions)} Questions",
                action_label="Start Quiz →",
                action_route="student-quiz"
            ))

    attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == target_student.id).all()
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
        student_id=target_student.user_id,
        student_name=target_student.name,
        completed_videos_count=completed_videos,
        total_videos_count=total_published_videos,
        quizzes_taken_count=quizzes_taken,
        average_quiz_score=round(avg_score, 1),
        mastery_scores=mastery_scores,
        weak_concepts=weak_concepts,
        assigned_subjects=assigned_subject_names,
        resume_learning=resume_learning,
        modules=modules_out,
        quizzes=quizzes_out
    )


# ==================================================
# BUILD 8.1 — STRICT PARENT CHILD-PROGRESS IMPLEMENTATION
# ==================================================

def _build_parent_child_progress(student: Student, db: Session) -> ParentChildProgressResponse:
    # 1. Child Info
    child_info = ParentChildInfo(
        id=student.id,
        user_id=student.user_id,
        student_id=student.student_id,
        name=student.name,
        class_name=student.class_,
        section=student.section,
        roll_number=student.roll_number,
        email=student.user.email if student.user else None
    )

    # 2. Subjects assigned to this student
    assigned_records = db.query(StudentSubject).filter(StudentSubject.student_id == student.id).all()
    subject_ids = [r.subject_id for r in assigned_records]
    if subject_ids:
        subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).order_by(Subject.name.asc()).all()
    else:
        subjects = db.query(Subject).order_by(Subject.name.asc()).all()
        subject_ids = [s.id for s in subjects]

    # 3. Topic Mastery & Performances for this student
    performances = (
        db.query(StudentTopicPerformance, Topic)
        .join(Topic, StudentTopicPerformance.topic_id == Topic.id)
        .filter(StudentTopicPerformance.student_id == student.id)
        .all()
    )
    topic_mastery_map: dict[int, float] = {}
    topic_mastery_items: list[ParentTopicMasteryItem] = []
    for perf, topic in performances:
        if subject_ids and topic.chapter and topic.chapter.subject_id not in subject_ids:
            continue
        score = round(float(perf.latest_score or 0.0), 1)
        topic_mastery_map[topic.id] = score
        m_level = str(perf.mastery_level or "NOT_STARTED").upper()
        subj_name = topic.chapter.subject.name if (topic.chapter and topic.chapter.subject) else "General"
        topic_mastery_items.append(ParentTopicMasteryItem(
            topic_id=topic.id,
            topic_title=topic.title,
            subject_name=subj_name,
            score=score,
            mastery_level=m_level
        ))

    # Calculate subject progress
    subject_progress_items: list[ParentSubjectProgress] = []
    for subj in subjects:
        subj_topics = (
            db.query(Topic)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .filter(Chapter.subject_id == subj.id)
            .all()
        )
        if subj_topics:
            scores = [topic_mastery_map.get(t.id, 0.0) for t in subj_topics]
            subj_pct = round(sum(scores) / len(scores), 1)
        else:
            subj_pct = 0.0
        subject_progress_items.append(ParentSubjectProgress(
            subject_id=subj.id,
            subject_name=subj.name,
            progress_percentage=subj_pct
        ))

    # 4. Videos for student
    video_query = db.query(Video).filter(Video.status.in_([VideoStatus.PUBLISHED.value, "published"]))
    if subject_ids:
        video_query = (
            video_query
            .join(Topic, Video.topic_id == Topic.id)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .filter(Chapter.subject_id.in_(subject_ids))
        )
    published_videos = video_query.all()
    v_progress_map = {
        p.video_id: p
        for p in db.query(StudentVideoProgress).filter(StudentVideoProgress.student_id == student.id).all()
    }

    video_items: list[ParentVideoItem] = []
    for v in published_videos:
        rec = v_progress_map.get(v.id)
        if rec and rec.completed:
            v_status = "COMPLETED"
        elif rec and (rec.progress_percentage > 0 or (rec.watch_time_seconds and rec.watch_time_seconds > 0)):
            v_status = "IN_PROGRESS"
        else:
            v_status = "NOT_STARTED"
        video_items.append(ParentVideoItem(
            video_id=v.id,
            title=v.title,
            topic_title=v.topic.title if v.topic else "General",
            subject_name=v.topic.chapter.subject.name if (v.topic and v.topic.chapter and v.topic.chapter.subject) else "General",
            status=v_status
        ))

    videos_completed = sum(1 for v in video_items if v.status == "COMPLETED")
    total_videos = len(video_items)

    # 5. Quizzes for student
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.student_id == student.id)
        .order_by(QuizAttempt.submitted_at.asc())
        .all()
    )
    quiz_attempts_map: dict[int, list[QuizAttempt]] = {}
    for att in attempts:
        quiz_attempts_map.setdefault(att.quiz_id, []).append(att)

    quiz_items: list[ParentQuizItem] = []
    attempt_percentages: list[float] = []
    weak_concepts_collected: list[str] = []

    for quiz_id, q_attempts in quiz_attempts_map.items():
        quiz = db.get(Quiz, quiz_id)
        if not quiz:
            continue
        scores = [
            float(a.percentage if a.percentage is not None else (
                (a.score / a.total_questions * 100) if a.total_questions else 0.0
            ))
            for a in q_attempts
        ]
        attempt_percentages.extend(scores)
        latest_score = scores[-1] if scores else 0.0
        best_score = max(scores) if scores else 0.0
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        passed = any(bool(a.passed) for a in q_attempts)

        for a in q_attempts:
            for wc in (a.weak_concepts or []):
                if wc and wc not in weak_concepts_collected:
                    weak_concepts_collected.append(wc)

        topic_title = quiz.topic.title if quiz.topic else f"Quiz {quiz.id}"
        subj_name = (
            quiz.topic.chapter.subject.name
            if (quiz.topic and quiz.topic.chapter and quiz.topic.chapter.subject)
            else "General"
        )
        if best_score >= 80.0:
            q_mastery = "MASTERED"
        elif best_score >= 60.0:
            q_mastery = "IN_PROGRESS"
        else:
            q_mastery = "NEEDS_PRACTICE"

        quiz_items.append(ParentQuizItem(
            quiz_id=quiz.id,
            topic_title=topic_title,
            subject_name=subj_name,
            latest_score=round(latest_score, 1),
            best_score=round(best_score, 1),
            average_score=avg_score,
            passed=passed,
            mastery_level=q_mastery
        ))

    average_quiz_score = round(sum(attempt_percentages) / len(attempt_percentages), 1) if attempt_percentages else 0.0

    weak_topics: list[str] = []
    for item in topic_mastery_items:
        if item.mastery_level in ["NEEDS_PRACTICE", "BEGINNER"] or item.score < 75.0:
            if item.topic_title not in weak_topics:
                weak_topics.append(item.topic_title)
    for wc in weak_concepts_collected:
        if wc not in weak_topics:
            weak_topics.append(wc)

    # 6. Assignments for student
    st_assignments = (
        db.query(StudentAssignment)
        .filter(StudentAssignment.student_id == student.id)
        .order_by(StudentAssignment.created_at.desc())
        .all()
    )
    assignment_items: list[ParentAssignmentItem] = []
    from .assignments import compute_student_assignment_status
    for sa in st_assignments:
        assign = sa.assignment
        eff_status = compute_student_assignment_status(sa, assign.due_date if assign else None)
        assignment_items.append(ParentAssignmentItem(
            assignment_id=sa.assignment_id,
            title=assign.title if assign else f"Assignment {sa.assignment_id}",
            subject_name=assign.subject.name if (assign and assign.subject) else "General",
            chapter_title=assign.chapter.title if (assign and assign.chapter) else None,
            topic_title=assign.topic.title if (assign and assign.topic) else None,
            teacher_name=assign.teacher.name if (assign and assign.teacher) else "Instructor",
            due_date=assign.due_date if assign else None,
            status=eff_status,
            score=sa.score,
            total_points=assign.total_points if assign else 100.0,
            feedback=sa.feedback,
            submitted_at=sa.submitted_at
        ))

    assignments_completed = sum(1 for sa in assignment_items if sa.status.upper() in ["SUBMITTED", "LATE", "GRADED"])
    total_assignments = len(assignment_items)

    if topic_mastery_items:
        topic_mastery_percentage = round(sum(tm.score for tm in topic_mastery_items) / len(topic_mastery_items), 1)
    else:
        topic_mastery_percentage = 0.0

    metrics_list = []
    if total_videos > 0:
        metrics_list.append((videos_completed / total_videos) * 100)
    if attempt_percentages:
        metrics_list.append(average_quiz_score)
    if topic_mastery_items:
        metrics_list.append(topic_mastery_percentage)
    if total_assignments > 0:
        metrics_list.append((assignments_completed / total_assignments) * 100)
    overall_progress = round(sum(metrics_list) / len(metrics_list), 1) if metrics_list else 0.0

    # 7. Recent activity timeline
    recent_activity: list[ParentActivityItem] = []
    for p in v_progress_map.values():
        if not p.video:
            continue
        ts = p.updated_at or p.last_watched_at or p.created_at or datetime.now(timezone.utc)
        if p.completed:
            recent_activity.append(ParentActivityItem(
                id=f"video-{p.id}",
                type="video",
                description=f'Completed "{p.video.title}"',
                timestamp=ts,
                status="COMPLETED"
            ))
        elif p.progress_percentage > 0 or (p.watch_time_seconds and p.watch_time_seconds > 0):
            recent_activity.append(ParentActivityItem(
                id=f"video-{p.id}",
                type="video",
                description=f'Watching "{p.video.title}"',
                timestamp=ts,
                status="IN_PROGRESS"
            ))

    for att in attempts:
        ts = att.submitted_at or att.created_at or datetime.now(timezone.utc)
        q_name = att.quiz.topic.title if (att.quiz and att.quiz.topic) else "Quiz"
        pct = round(att.percentage if att.percentage is not None else (
            (att.score / att.total_questions * 100) if att.total_questions else 0.0
        ), 0)
        recent_activity.append(ParentActivityItem(
            id=f"quiz-{att.id}",
            type="quiz",
            description=f'Scored {int(pct)}% in {q_name} Quiz',
            timestamp=ts,
            score=pct,
            status="PASSED" if att.passed else "COMPLETED"
        ))

    for sa in st_assignments:
        if sa.status in ["SUBMITTED", "GRADED"]:
            ts = sa.submitted_at or sa.updated_at or sa.created_at or datetime.now(timezone.utc)
            a_title = sa.assignment.title if sa.assignment else "Assignment"
            if sa.status == "GRADED" and sa.score is not None:
                desc = f'Graded: {int(sa.score)}% in {a_title}'
            else:
                desc = f'Submitted {a_title}'
            recent_activity.append(ParentActivityItem(
                id=f"assignment-{sa.id}",
                type="assignment",
                description=desc,
                timestamp=ts,
                score=sa.score,
                status=sa.status
            ))

    recent_activity.sort(key=lambda x: x.timestamp, reverse=True)
    recent_activity = recent_activity[:15]

    return ParentChildProgressResponse(
        child=child_info,
        overall_progress=overall_progress,
        videos_completed=videos_completed,
        total_videos=total_videos,
        average_quiz_score=average_quiz_score,
        topic_mastery_percentage=topic_mastery_percentage,
        assignments_completed=assignments_completed,
        total_assignments=total_assignments,
        subjects=subject_progress_items,
        videos=video_items,
        quizzes=quiz_items,
        topic_mastery=topic_mastery_items,
        weak_topics=weak_topics,
        assignments=assignment_items,
        recent_activity=recent_activity
    )


def _resolve_and_authorize_parent_child(
    current_user: User,
    student_id: Optional[Union[int, str]],
    db: Session
) -> Student:
    user_role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role).lower()
    if user_role not in ["parent", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Access is restricted to parents"
        )

    if user_role == "admin":
        if student_id is not None:
            cand = None
            if isinstance(student_id, int) or (isinstance(student_id, str) and str(student_id).isdigit()):
                int_id = int(student_id)
                cand = db.get(Student, int_id) or db.query(Student).filter(Student.user_id == int_id).first()
            if not cand and isinstance(student_id, str):
                cand = db.query(Student).filter(Student.student_id == student_id).first()
            if not cand:
                raise HTTPException(status_code=404, detail="Student not found")
            return cand
        target = db.query(Student).first()
        if not target:
            raise HTTPException(status_code=404, detail="No students found")
        return target

    parent = resolve_parent_for_user(current_user, db)
    if not parent:
        if student_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Parent is not linked to this student"
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent profile not found")

    links = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
    authorized_ids = {l.student_id for l in links}

    if current_user.linked_student_id:
        leg_stu = db.query(Student).filter(Student.user_id == current_user.linked_student_id).first()
        if not leg_stu:
            leg_stu = db.get(Student, current_user.linked_student_id)
        if leg_stu:
            authorized_ids.add(leg_stu.id)

    if student_id is not None:
        cand = None
        if isinstance(student_id, int) or (isinstance(student_id, str) and str(student_id).isdigit()):
            int_id = int(student_id)
            cand = db.get(Student, int_id) or db.query(Student).filter(Student.user_id == int_id).first()
        if not cand and isinstance(student_id, str):
            cand = db.query(Student).filter(Student.student_id == student_id).first()
        if not cand or cand.id not in authorized_ids:
            # STRICT REQUIREMENT: If parent requests a student who is not linked to them -> HTTP 403 Forbidden
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Parent is not linked to this student"
            )
        return cand

    if not authorized_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No children linked to this parent account")

    # Default to first authorized child
    first_id = sorted(list(authorized_ids))[0]
    first_child = db.get(Student, first_id)
    if not first_child:
        raise HTTPException(status_code=404, detail="Linked student not found")
    return first_child


@router.get("/parent/children", response_model=List[ParentChildInfo])
def get_parent_children(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role).lower()
    if user_role not in ["parent", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Access is restricted to parents"
        )

    if user_role == "admin":
        all_students = db.query(Student).order_by(Student.name.asc()).all()
        return [
            ParentChildInfo(
                id=s.id,
                user_id=s.user_id,
                student_id=s.student_id,
                name=s.name,
                class_name=s.class_,
                section=s.section,
                roll_number=s.roll_number,
                email=s.user.email if s.user else None
            )
            for s in all_students
        ]

    parent = resolve_parent_for_user(current_user, db)
    if not parent:
        return []

    links = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
    child_ids = [l.student_id for l in links]

    if current_user.linked_student_id:
        leg_stu = db.query(Student).filter(Student.user_id == current_user.linked_student_id).first()
        if not leg_stu:
            leg_stu = db.get(Student, current_user.linked_student_id)
        if leg_stu and leg_stu.id not in child_ids:
            child_ids.append(leg_stu.id)

    if not child_ids:
        return []

    children = db.query(Student).filter(Student.id.in_(child_ids)).order_by(Student.name.asc()).all()
    return [
        ParentChildInfo(
            id=s.id,
            user_id=s.user_id,
            student_id=s.student_id,
            name=s.name,
            class_name=s.class_,
            section=s.section,
            roll_number=s.roll_number,
            email=s.user.email if s.user else None
        )
        for s in children
    ]


@router.get("/parent/progress", response_model=ParentChildProgressResponse)
def get_parent_child_progress_default(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = _resolve_and_authorize_parent_child(current_user, None, db)
    return _build_parent_child_progress(student, db)


@router.get("/parent/progress/{student_id}", response_model=ParentChildProgressResponse)
def get_parent_child_progress(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = _resolve_and_authorize_parent_child(current_user, student_id, db)
    return _build_parent_child_progress(student, db)


@router.get("/teacher/class-performance", response_model=ObserverDashboardSummary)
def get_teacher_class_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_role = current_user.role.value.lower() if hasattr(current_user.role, "value") else str(current_user.role).lower()
    if user_role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Teacher analytics access is restricted to teachers"
        )
    return get_observer_dashboard(db=db, current_user=current_user)

