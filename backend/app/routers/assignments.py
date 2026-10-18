import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from ..core.database import get_db
from ..core.storage import get_storage
from ..core.security import (
    require_roles, get_current_user,
    resolve_student_for_user, resolve_teacher_for_user, resolve_parent_for_user
)
from ..models.models import (
    Assignment, StudentAssignment, Teacher, Student, Parent,
    TeacherStudent, StudentParent, Subject, Chapter, Topic, User, Role
)
from ..schemas.schemas import (
    AssignmentCreateIn, AssignmentUpdateIn, AssignmentGradeIn,
    AssignmentOut, StudentSubmissionOut, StudentAssignmentSubmitIn,
    StudentAssignmentDetailOut, StudentAssignmentListItemOut,
    TeacherAssignmentSummaryOut, StudentAssignmentSummaryOut,
    ParentAssignmentSummaryOut, ParentAssignmentDetailOut,
    TeacherAssignedStudentOut
)

router = APIRouter(tags=["Assignment Engine"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def compute_student_assignment_status(sa: StudentAssignment, due_date: Optional[datetime] = None) -> str:
    """
    Computes single source-of-truth status:
    - PENDING: not submitted, not started, not past due
    - IN_PROGRESS: opened/started by student, not submitted, not past due
    - SUBMITTED: submitted on or before due date
    - LATE: submitted after due date
    - GRADED: evaluated and graded by teacher
    """
    raw_status = (sa.status or "").upper()
    if raw_status == "GRADED":
        return "GRADED"

    if sa.submitted_at:
        aware_submitted = ensure_aware(sa.submitted_at)
        aware_due = ensure_aware(due_date)
        if aware_due and aware_submitted and aware_submitted > aware_due:
            return "LATE"
        return "SUBMITTED"

    # Not submitted yet
    aware_due = ensure_aware(due_date)
    if aware_due and utcnow() > aware_due:
        return "OVERDUE"

    if raw_status == "IN_PROGRESS":
        return "IN_PROGRESS"

    return "PENDING"


def serialize_assignment(a: Assignment, db: Session) -> AssignmentOut:
    submissions = db.query(StudentAssignment).filter(StudentAssignment.assignment_id == a.id).all()
    assigned_count = len(submissions)
    submitted_count = sum(1 for s in submissions if s.submitted_at is not None or s.status in ["SUBMITTED", "LATE", "GRADED"])
    graded_count = sum(1 for s in submissions if s.status == "GRADED")

    return AssignmentOut(
        id=a.id,
        teacher_id=a.teacher_id,
        teacher_name=a.teacher.name if a.teacher else None,
        subject_id=a.subject_id,
        subject_name=a.subject.name if a.subject else None,
        chapter_id=a.chapter_id,
        chapter_title=a.chapter.title if a.chapter else None,
        topic_id=a.topic_id,
        topic_title=a.topic.title if a.topic else None,
        title=a.title,
        description=a.description,
        due_date=a.due_date,
        total_points=a.total_points or 100.0,
        attachment_url=a.attachment_url,
        status=a.status or "PUBLISHED",
        created_at=a.created_at,
        updated_at=a.updated_at,
        assigned_count=assigned_count,
        submitted_count=submitted_count,
        graded_count=graded_count
    )


# ==============================================================================
# TEACHER ENDPOINTS
# ==============================================================================

@router.get("/api/teacher/students", response_model=List[TeacherAssignedStudentOut])
@router.get("/learn/teacher/students", response_model=List[TeacherAssignedStudentOut])
def get_teacher_assigned_students(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    teacher_students = db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher.id).all()
    student_ids = [ts.student_id for ts in teacher_students]
    students = db.query(Student).filter(Student.id.in_(student_ids)).all()

    return [
        TeacherAssignedStudentOut(
            id=s.id,
            student_id=s.student_id,
            name=s.name,
            class_name=s.class_,
            section=s.section,
            roll_number=s.roll_number,
            email=s.email
        )
        for s in students
    ]


@router.get("/api/teacher/assignments-summary", response_model=TeacherAssignmentSummaryOut)
@router.get("/learn/teacher/assignments-summary", response_model=TeacherAssignmentSummaryOut)
def get_teacher_assignments_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    teacher_assignments = db.query(Assignment).filter(Assignment.teacher_id == teacher.id).all()
    assignment_ids = [a.id for a in teacher_assignments]

    if not assignment_ids:
        return TeacherAssignmentSummaryOut()

    student_assignments = db.query(StudentAssignment).filter(StudentAssignment.assignment_id.in_(assignment_ids)).all()
    assignments_by_id = {a.id: a for a in teacher_assignments}

    pending_count = 0
    submitted_count = 0
    to_be_graded_count = 0
    graded_count = 0

    for sa in student_assignments:
        assign = assignments_by_id.get(sa.assignment_id)
        due_date = assign.due_date if assign else None
        eff_status = compute_student_assignment_status(sa, due_date)

        if eff_status == "GRADED":
            graded_count += 1
        elif eff_status in ["SUBMITTED", "LATE"]:
            submitted_count += 1
            to_be_graded_count += 1
        else:
            pending_count += 1

    return TeacherAssignmentSummaryOut(
        total_assignments=len(teacher_assignments),
        pending_submissions=pending_count,
        submitted=submitted_count,
        to_be_graded=to_be_graded_count,
        graded=graded_count
    )


@router.get("/api/teacher/assignments", response_model=List[AssignmentOut])
@router.get("/learn/teacher/assignments", response_model=List[AssignmentOut])
def list_teacher_assignments(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    assignments = db.query(Assignment).filter(
        Assignment.teacher_id == teacher.id
    ).order_by(Assignment.created_at.desc()).all()

    return [serialize_assignment(a, db) for a in assignments]


@router.post("/api/teacher/assignments", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
@router.post("/learn/teacher/assignments", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def create_teacher_assignment(
    payload: AssignmentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    # 1. Validate Subject exists
    subject = db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # 2. Validate Chapter exists and belongs to Subject
    chapter = db.get(Chapter, payload.chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if chapter.subject_id != subject.id:
        raise HTTPException(
            status_code=400,
            detail=f"Chapter '{chapter.title}' (ID {chapter.id}) does not belong to Subject '{subject.name}' (ID {subject.id})"
        )

    # 3. Validate Topic if provided
    topic = None
    if payload.topic_id:
        topic = db.get(Topic, payload.topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        if topic.chapter_id != chapter.id:
            raise HTTPException(
                status_code=400,
                detail=f"Topic '{topic.title}' (ID {topic.id}) does not belong to Chapter '{chapter.title}' (ID {chapter.id})"
            )

    # 4. Validate Student IDs belong to logged-in teacher
    teacher_students = db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher.id).all()
    allowed_student_ids = {ts.student_id for ts in teacher_students}

    for sid in payload.student_ids:
        if sid not in allowed_student_ids:
            st = db.get(Student, sid)
            st_name = st.name if st else f"ID {sid}"
            raise HTTPException(
                status_code=403,
                detail=f"Unauthorized: Student '{st_name}' is not assigned to your teacher roster"
            )

    # 5. Create Assignment record
    new_assignment = Assignment(
        teacher_id=teacher.id,
        subject_id=subject.id,
        chapter_id=chapter.id,
        topic_id=topic.id if topic else None,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        due_date=payload.due_date,
        total_points=payload.total_points,
        attachment_url=payload.attachment_url,
        status="PUBLISHED",
        created_at=utcnow(),
        updated_at=utcnow()
    )
    db.add(new_assignment)
    db.flush()

    # 6. Create StudentAssignment entries
    for sid in payload.student_ids:
        db.add(StudentAssignment(
            assignment_id=new_assignment.id,
            student_id=sid,
            status="PENDING",
            created_at=utcnow(),
            updated_at=utcnow()
        ))

    db.commit()
    db.refresh(new_assignment)

    return serialize_assignment(new_assignment, db)


@router.get("/api/teacher/assignments/{assignment_id}", response_model=AssignmentOut)
@router.get("/learn/teacher/assignments/{assignment_id}", response_model=AssignmentOut)
def get_teacher_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.teacher_id != teacher.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view another teacher's assignment")

    return serialize_assignment(assignment, db)


@router.put("/api/teacher/assignments/{assignment_id}", response_model=AssignmentOut)
@router.put("/learn/teacher/assignments/{assignment_id}", response_model=AssignmentOut)
def update_teacher_assignment(
    assignment_id: int,
    payload: AssignmentUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.teacher_id != teacher.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to modify another teacher's assignment")

    if payload.title is not None:
        assignment.title = payload.title.strip()
    if payload.description is not None:
        assignment.description = payload.description.strip()
    if payload.due_date is not None:
        assignment.due_date = payload.due_date
    if payload.total_points is not None:
        assignment.total_points = payload.total_points
    if payload.attachment_url is not None:
        assignment.attachment_url = payload.attachment_url

    if payload.student_ids is not None:
        teacher_students = db.query(TeacherStudent).filter(TeacherStudent.teacher_id == teacher.id).all()
        allowed_student_ids = {ts.student_id for ts in teacher_students}
        for sid in payload.student_ids:
            if sid not in allowed_student_ids:
                raise HTTPException(status_code=403, detail=f"Unauthorized: Student {sid} is not assigned to this teacher")

        existing_entries = db.query(StudentAssignment).filter(StudentAssignment.assignment_id == assignment.id).all()
        existing_sids = {e.student_id: e for e in existing_entries}

        # Add new students
        for sid in payload.student_ids:
            if sid not in existing_sids:
                db.add(StudentAssignment(
                    assignment_id=assignment.id,
                    student_id=sid,
                    status="PENDING",
                    created_at=utcnow(),
                    updated_at=utcnow()
                ))

        # Remove unselected students only if they haven't submitted yet
        for sid, entry in existing_sids.items():
            if sid not in payload.student_ids:
                if entry.status in ["SUBMITTED", "LATE", "GRADED"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot remove student {sid} because their submission has already been received or graded"
                    )
                db.delete(entry)

    assignment.updated_at = utcnow()
    db.commit()
    db.refresh(assignment)

    return serialize_assignment(assignment, db)


@router.delete("/api/teacher/assignments/{assignment_id}")
@router.delete("/learn/teacher/assignments/{assignment_id}")
def delete_teacher_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.teacher_id != teacher.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to delete another teacher's assignment")

    db.delete(assignment)
    db.commit()
    return {"status": "ok", "message": f"Assignment {assignment_id} deleted successfully"}


@router.get("/api/teacher/assignments/{assignment_id}/submissions", response_model=List[StudentSubmissionOut])
@router.get("/learn/teacher/assignments/{assignment_id}/submissions", response_model=List[StudentSubmissionOut])
def get_assignment_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.teacher_id != teacher.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to inspect submissions for another teacher's assignment")

    student_assignments = db.query(StudentAssignment).filter(
        StudentAssignment.assignment_id == assignment.id
    ).all()

    results = []
    for sa in student_assignments:
        st = sa.student
        st_name = st.name if st else "Student"
        st_code = st.student_id if st else f"ST-{sa.student_id}"

        eff_status = compute_student_assignment_status(sa, assignment.due_date)
        is_late = eff_status == "LATE"

        results.append(StudentSubmissionOut(
            id=sa.id,
            assignment_id=sa.assignment_id,
            student_id=sa.student_id,
            student_name=st_name,
            student_code=st_code,
            status=eff_status,
            submission_text=sa.submission_text,
            submission_url=sa.submission_url,
            submitted_at=sa.submitted_at,
            score=sa.score,
            max_score=assignment.total_points or 100.0,
            feedback=sa.feedback,
            graded_at=sa.graded_at,
            is_late=is_late
        ))

    return results


@router.post("/api/teacher/assignments/{assignment_id}/grade", response_model=StudentSubmissionOut)
@router.post("/learn/teacher/assignments/{assignment_id}/grade", response_model=StudentSubmissionOut)
@router.post("/api/teacher/assignments/{assignment_id}/submissions/{student_id}/grade", response_model=StudentSubmissionOut)
def grade_student_submission(
    assignment_id: int,
    payload: AssignmentGradeIn,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("teacher", "admin"))
):
    teacher = resolve_teacher_for_user(user, db)
    if not teacher:
        raise HTTPException(status_code=403, detail="Active teacher profile not found")

    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.teacher_id != teacher.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to grade another teacher's assignment")

    target_student_id = student_id or payload.student_id

    sa = db.query(StudentAssignment).filter(
        StudentAssignment.assignment_id == assignment.id,
        StudentAssignment.student_id == target_student_id
    ).first()

    if not sa:
        raise HTTPException(status_code=404, detail=f"Submission not found for student ID {target_student_id}")

    # Validate score range
    max_score = assignment.total_points or 100.0
    if payload.score < 0 or payload.score > max_score:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid score {payload.score}. Score must be between 0.0 and {max_score}"
        )

    sa.score = payload.score
    sa.feedback = payload.feedback.strip() if payload.feedback else None
    sa.graded_at = utcnow()
    sa.status = "GRADED"
    sa.updated_at = utcnow()
    db.commit()
    db.refresh(sa)

    st = sa.student
    return StudentSubmissionOut(
        id=sa.id,
        assignment_id=sa.assignment_id,
        student_id=sa.student_id,
        student_name=st.name if st else "Student",
        student_code=st.student_id if st else f"ST-{sa.student_id}",
        status="GRADED",
        submission_text=sa.submission_text,
        submission_url=sa.submission_url,
        submitted_at=sa.submitted_at,
        score=sa.score,
        max_score=max_score,
        feedback=sa.feedback,
        graded_at=sa.graded_at,
        is_late=sa.submitted_at is not None and ensure_aware(assignment.due_date) is not None and ensure_aware(sa.submitted_at) > ensure_aware(assignment.due_date)
    )


# ==============================================================================
# STUDENT ENDPOINTS
# ==============================================================================

@router.get("/api/student/assignments-summary", response_model=StudentAssignmentSummaryOut)
@router.get("/learn/student/assignments-summary", response_model=StudentAssignmentSummaryOut)
def get_student_assignments_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = resolve_student_for_user(user, db)
    if not student:
        raise HTTPException(status_code=403, detail="Active student profile not found")

    student_assignments = db.query(StudentAssignment).filter(
        StudentAssignment.student_id == student.id
    ).all()

    pending_count = 0
    in_progress_count = 0
    submitted_count = 0
    overdue_count = 0
    graded_count = 0

    for sa in student_assignments:
        assign = sa.assignment
        due_date = assign.due_date if assign else None
        eff_status = compute_student_assignment_status(sa, due_date)

        if eff_status == "GRADED":
            graded_count += 1
        elif eff_status in ["SUBMITTED", "LATE"]:
            submitted_count += 1
        elif eff_status == "IN_PROGRESS":
            in_progress_count += 1
        elif eff_status == "OVERDUE":
            overdue_count += 1
        else:
            pending_count += 1

    return StudentAssignmentSummaryOut(
        pending_assignments=pending_count,
        in_progress=in_progress_count,
        submitted=submitted_count,
        overdue=overdue_count,
        graded=graded_count
    )


@router.get("/api/student/assignments", response_model=List[StudentAssignmentListItemOut])
@router.get("/learn/student/assignments", response_model=List[StudentAssignmentListItemOut])
def list_student_assignments(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = resolve_student_for_user(user, db)
    if not student:
        raise HTTPException(status_code=403, detail="Active student profile not found")

    student_assignments = db.query(StudentAssignment).filter(
        StudentAssignment.student_id == student.id
    ).order_by(StudentAssignment.created_at.desc()).all()

    results = []
    for sa in student_assignments:
        assign = sa.assignment
        if not assign:
            continue

        eff_status = compute_student_assignment_status(sa, assign.due_date)
        is_overdue = eff_status == "OVERDUE"

        results.append(StudentAssignmentListItemOut(
            id=sa.id,
            assignment_id=assign.id,
            title=assign.title,
            description=assign.description,
            subject_id=assign.subject_id,
            subject_name=assign.subject.name if assign.subject else "Subject",
            chapter_id=assign.chapter_id,
            chapter_title=assign.chapter.title if assign.chapter else None,
            topic_id=assign.topic_id,
            topic_title=assign.topic.title if assign.topic else None,
            teacher_name=assign.teacher.name if assign.teacher else "Instructor",
            due_date=assign.due_date,
            total_points=assign.total_points or 100.0,
            attachment_url=assign.attachment_url,
            status=eff_status,
            score=sa.score,
            submitted_at=sa.submitted_at,
            is_overdue=is_overdue
        ))

    return results


@router.get("/api/student/assignments/{assignment_id}", response_model=StudentAssignmentDetailOut)
@router.get("/learn/student/assignments/{assignment_id}", response_model=StudentAssignmentDetailOut)
def get_student_assignment_detail(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = resolve_student_for_user(user, db)
    if not student:
        raise HTTPException(status_code=403, detail="Active student profile not found")

    sa = db.query(StudentAssignment).filter(
        StudentAssignment.assignment_id == assignment_id,
        StudentAssignment.student_id == student.id
    ).first()

    if not sa:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found or not assigned to your student profile"
        )

    assign = sa.assignment
    if not assign:
        raise HTTPException(status_code=404, detail="Parent assignment record missing")

    # Mark as IN_PROGRESS if first time opening and not yet submitted
    if sa.status == "PENDING":
        sa.status = "IN_PROGRESS"
        sa.updated_at = utcnow()
        db.commit()
        db.refresh(sa)

    eff_status = compute_student_assignment_status(sa, assign.due_date)

    return StudentAssignmentDetailOut(
        id=sa.id,
        assignment_id=assign.id,
        title=assign.title,
        description=assign.description,
        subject_id=assign.subject_id,
        subject_name=assign.subject.name if assign.subject else "Subject",
        chapter_id=assign.chapter_id,
        chapter_title=assign.chapter.title if assign.chapter else None,
        topic_id=assign.topic_id,
        topic_title=assign.topic.title if assign.topic else None,
        teacher_name=assign.teacher.name if assign.teacher else "Instructor",
        due_date=assign.due_date,
        total_points=assign.total_points or 100.0,
        attachment_url=assign.attachment_url,
        status=eff_status,
        submission_text=sa.submission_text,
        submission_url=sa.submission_url,
        submitted_at=sa.submitted_at,
        score=sa.score,
        feedback=sa.feedback,
        graded_at=sa.graded_at,
        is_overdue=eff_status == "OVERDUE"
    )


@router.post("/api/student/assignments/{assignment_id}/submit", response_model=StudentAssignmentDetailOut)
@router.post("/learn/student/assignments/{assignment_id}/submit", response_model=StudentAssignmentDetailOut)
def submit_student_assignment(
    assignment_id: int,
    payload: StudentAssignmentSubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student", "admin"))
):
    student = resolve_student_for_user(user, db)
    if not student:
        raise HTTPException(status_code=403, detail="Active student profile not found")

    sa = db.query(StudentAssignment).filter(
        StudentAssignment.assignment_id == assignment_id,
        StudentAssignment.student_id == student.id
    ).first()

    if not sa:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found or not assigned to your student profile"
        )

    # Prevent accidental resubmission if already graded
    if sa.status == "GRADED":
        raise HTTPException(
            status_code=400,
            detail="This assignment has already been graded and cannot be resubmitted"
        )

    submission_content = (payload.submission_text or "").strip()
    submission_url = (payload.submission_url or "").strip()

    if not submission_content and not submission_url:
        raise HTTPException(
            status_code=400,
            detail="Submission must include written response text or an uploaded file/URL"
        )

    assign = sa.assignment
    submit_time = utcnow()
    sa.submitted_at = submit_time
    sa.submission_text = submission_content or None
    sa.submission_url = submission_url or None

    aware_due = ensure_aware(assign.due_date) if assign else None
    if aware_due and submit_time > aware_due:
        sa.status = "LATE"
    else:
        sa.status = "SUBMITTED"

    sa.updated_at = submit_time
    db.commit()
    db.refresh(sa)

    eff_status = compute_student_assignment_status(sa, assign.due_date if assign else None)

    return StudentAssignmentDetailOut(
        id=sa.id,
        assignment_id=assign.id if assign else assignment_id,
        title=assign.title if assign else "Assignment",
        description=assign.description if assign else None,
        subject_id=assign.subject_id if assign else 0,
        subject_name=assign.subject.name if assign and assign.subject else "Subject",
        chapter_id=assign.chapter_id if assign else None,
        chapter_title=assign.chapter.title if assign and assign.chapter else None,
        topic_id=assign.topic_id if assign else None,
        topic_title=assign.topic.title if assign and assign.topic else None,
        teacher_name=assign.teacher.name if assign and assign.teacher else "Instructor",
        due_date=assign.due_date if assign else None,
        total_points=assign.total_points if assign else 100.0,
        attachment_url=assign.attachment_url if assign else None,
        status=eff_status,
        submission_text=sa.submission_text,
        submission_url=sa.submission_url,
        submitted_at=sa.submitted_at,
        score=sa.score,
        feedback=sa.feedback,
        graded_at=sa.graded_at,
        is_overdue=False
    )


# ==============================================================================
# PARENT ENDPOINTS
# ==============================================================================

@router.get("/api/parent/children/{student_id}/assignments", response_model=List[ParentAssignmentDetailOut])
@router.get("/learn/parent/children/{student_id}/assignments", response_model=List[ParentAssignmentDetailOut])
def get_parent_child_assignments(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("parent", "admin"))
):
    parent = resolve_parent_for_user(user, db)
    if not parent and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Active parent profile not found")

    # Strict parent-child linkage authorization
    if user.role != Role.ADMIN:
        link = db.query(StudentParent).filter(
            StudentParent.parent_id == parent.id,
            StudentParent.student_id == student_id
        ).first()
        if not link:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Student ID {student_id} is not linked to your parent account"
            )

    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_assignments = db.query(StudentAssignment).filter(
        StudentAssignment.student_id == student.id
    ).order_by(StudentAssignment.created_at.desc()).all()

    results = []
    for sa in student_assignments:
        assign = sa.assignment
        if not assign:
            continue

        eff_status = compute_student_assignment_status(sa, assign.due_date)

        results.append(ParentAssignmentDetailOut(
            id=sa.id,
            assignment_id=assign.id,
            child_id=student.id,
            child_name=student.name,
            title=assign.title,
            description=assign.description,
            subject_name=assign.subject.name if assign.subject else "Subject",
            chapter_title=assign.chapter.title if assign.chapter else None,
            topic_title=assign.topic.title if assign.topic else None,
            teacher_name=assign.teacher.name if assign.teacher else "Instructor",
            due_date=assign.due_date,
            status=eff_status,
            score=sa.score,
            total_points=assign.total_points or 100.0,
            feedback=sa.feedback,
            submitted_at=sa.submitted_at,
            graded_at=sa.graded_at,
            is_overdue=eff_status == "OVERDUE"
        ))

    return results


@router.get("/api/parent/assignments", response_model=List[ParentAssignmentDetailOut])
@router.get("/learn/parent/assignments", response_model=List[ParentAssignmentDetailOut])
def get_all_parent_assignments(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("parent", "admin"))
):
    parent = resolve_parent_for_user(user, db)
    if not parent and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Active parent profile not found")

    if user.role == Role.ADMIN:
        children_ids = [s.id for s in db.query(Student).all()]
    else:
        links = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
        children_ids = [l.student_id for l in links]

    if not children_ids:
        return []

    student_assignments = db.query(StudentAssignment).filter(
        StudentAssignment.student_id.in_(children_ids)
    ).order_by(StudentAssignment.created_at.desc()).all()

    results = []
    for sa in student_assignments:
        assign = sa.assignment
        if not assign:
            continue
        st = sa.student
        eff_status = compute_student_assignment_status(sa, assign.due_date)

        results.append(ParentAssignmentDetailOut(
            id=sa.id,
            assignment_id=assign.id,
            child_id=st.id if st else sa.student_id,
            child_name=st.name if st else "Child",
            title=assign.title,
            description=assign.description,
            subject_name=assign.subject.name if assign.subject else "Subject",
            chapter_title=assign.chapter.title if assign.chapter else None,
            topic_title=assign.topic.title if assign.topic else None,
            teacher_name=assign.teacher.name if assign.teacher else "Instructor",
            due_date=assign.due_date,
            status=eff_status,
            score=sa.score,
            total_points=assign.total_points or 100.0,
            feedback=sa.feedback,
            submitted_at=sa.submitted_at,
            graded_at=sa.graded_at,
            is_overdue=eff_status == "OVERDUE"
        ))

    return results


@router.get("/api/parent/assignments-summary", response_model=ParentAssignmentSummaryOut)
@router.get("/learn/parent/assignments-summary", response_model=ParentAssignmentSummaryOut)
def get_parent_assignments_summary(
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("parent", "admin"))
):
    parent = resolve_parent_for_user(user, db)
    if not parent and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Active parent profile not found")

    if user.role == Role.ADMIN:
        children_ids = [student_id] if student_id else [s.id for s in db.query(Student).all()]
    else:
        links = db.query(StudentParent).filter(StudentParent.parent_id == parent.id).all()
        allowed_ids = {l.student_id for l in links}
        if student_id:
            if student_id not in allowed_ids:
                raise HTTPException(status_code=403, detail="Forbidden: Student is not linked to your parent account")
            children_ids = [student_id]
        else:
            children_ids = list(allowed_ids)

    if not children_ids:
        return ParentAssignmentSummaryOut()

    student_assignments = db.query(StudentAssignment).filter(
        StudentAssignment.student_id.in_(children_ids)
    ).all()

    pending_count = 0
    submitted_count = 0
    overdue_count = 0
    graded_count = 0

    for sa in student_assignments:
        assign = sa.assignment
        due_date = assign.due_date if assign else None
        eff_status = compute_student_assignment_status(sa, due_date)

        if eff_status == "GRADED":
            graded_count += 1
        elif eff_status in ["SUBMITTED", "LATE"]:
            submitted_count += 1
        elif eff_status == "OVERDUE":
            overdue_count += 1
        else:
            pending_count += 1

    return ParentAssignmentSummaryOut(
        pending=pending_count,
        submitted=submitted_count,
        overdue=overdue_count,
        graded=graded_count
    )


# ==============================================================================
# FILE UPLOAD (FOR ASSIGNMENTS & SUBMISSIONS)
# ==============================================================================

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".zip"}


@router.post("/api/assignments/upload")
@router.post("/learn/assignments/upload")
async def upload_assignment_asset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, DOC/DOCX, Images, TXT, ZIP."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    storage = get_storage()
    folder = "assignments/submissions" if user.role == Role.STUDENT else "assignments/resources"
    storage_key = storage.save_file(content, file.filename or f"upload{ext}", folder=folder)
    file_url = storage.get_url(storage_key)

    return {
        "storage_key": storage_key,
        "file_url": file_url,
        "filename": file.filename,
        "size_bytes": len(content)
    }
