"""
Phase 3B — Video progress correctness, server-side completion validation,
and access-control isolation tests.

Covers:
- Monotonic watch percentage (progress never decreases)
- Server-side completion rule (explicit completed=True below threshold -> 400)
- Auto-completion at/above the watch threshold
- Seeking-to-end is not proof of watching (threshold enforcement)
- No duplicate progress records for the same (student, video)
- Admin video-progress writes are rejected (no misattribution)
- Student video access requires a subject assignment (zero-assignment students denied)
- Admin adaptive-quiz endpoint leaks no other students' weak concepts
"""
import pytest
from tests.conftest import make_auth_header
from app.models.models import (
    Video, Subject, Chapter, Topic, Student, StudentSubject,
    StudentVideoProgress, User, Role, Quiz, Question, QuizAttempt
)
from app.core.security import hash_pw


@pytest.fixture
def isolation_fixture(db_session):
    """
    Published, rendered video under an APPROVED chapter + subject, plus a
    brand-new student with ZERO subject assignments and its own user.
    """
    user = db_session.query(User).filter(User.username == "qa3b_nosubj").first()
    if not user:
        user = User(
            username="qa3b_nosubj",
            name="QA3B No-Subject Student",
            email="qa3b_nosubj@test.local",
            password_hash=hash_pw("StudentPass123!"),
            role=Role.STUDENT,
            is_active=True
        )
        db_session.add(user)
        db_session.flush()
    student = db_session.query(Student).filter(Student.user_id == user.id).first()
    if not student:
        student = Student(user_id=user.id, student_id="QA3B-NOSUBJ", name="QA3B No-Subject Student")
        db_session.add(student)
        db_session.flush()

    subj = db_session.query(Subject).filter(Subject.name == "QA3B Subject").first()
    if not subj:
        subj = Subject(name="QA3B Subject", created_by=1)
        db_session.add(subj)
        db_session.flush()
    ch = db_session.query(Chapter).filter(Chapter.title == "QA3B Chapter").first()
    if not ch:
        ch = Chapter(subject_id=subj.id, chapter_number=1, title="QA3B Chapter", status="APPROVED")
        db_session.add(ch)
        db_session.flush()
    top = db_session.query(Topic).filter(Topic.title == "QA3B Topic").first()
    if not top:
        top = Topic(chapter_id=ch.id, sequence_number=1, title="QA3B Topic", status="APPROVED")
        db_session.add(top)
        db_session.flush()

    video = Video(
        topic_id=top.id,
        sequence_number=1,
        title="QA3B Published Lesson",
        status="PUBLISHED",
        render_status="RENDERED",
        actual_duration_seconds=300.0,
        duration_seconds=300
    )
    db_session.add(video)
    db_session.commit()

    # Link the DEFAULT student (Alice, user_id=2 -> student 1) to the subject so
    # the positive path can be exercised.
    link = db_session.query(StudentSubject).filter(
        StudentSubject.student_id == 1, StudentSubject.subject_id == subj.id
    ).first()
    if not link:
        db_session.add(StudentSubject(student_id=1, subject_id=subj.id))
        db_session.commit()

    return {"video_id": video.id, "no_subject_user_id": user.id, "subject_id": subj.id}


def test_progress_is_monotonic(client, isolation_fixture, db_session):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")  # Alice

    r1 = client.post(f"/learn/videos/{vid}/progress", headers=h, json={"progress_pct": 60.0, "last_position_seconds": 180})
    assert r1.status_code == 200
    assert r1.json()["progress_pct"] == 60.0

    # Seek backward / report lower percentage -> recorded progress must not regress
    r2 = client.post(f"/learn/videos/{vid}/progress", headers=h, json={"progress_pct": 30.0, "last_position_seconds": 90})
    assert r2.status_code == 200
    body = r2.json()
    assert body["progress_pct"] == 60.0
    assert body["last_position_seconds"] == 90  # position tracks actual playhead

    vp = db_session.query(StudentVideoProgress).filter(
        StudentVideoProgress.video_id == vid, StudentVideoProgress.student_id == 1
    ).first()
    assert vp.watch_percentage == 60.0


def test_completed_true_below_threshold_rejected(client, isolation_fixture, db_session):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")

    res = client.post(f"/learn/videos/{vid}/progress", headers=h, json={"progress_pct": 50.0, "completed": True})
    assert res.status_code == 400
    assert "cannot be marked completed" in res.json()["detail"].lower()

    vp = db_session.query(StudentVideoProgress).filter(
        StudentVideoProgress.video_id == vid, StudentVideoProgress.student_id == 1
    ).first()
    assert vp is None or vp.completed is False


def test_seeking_to_end_is_not_completion(client, isolation_fixture, db_session):
    """A client that jumps straight to the end without real watch coverage
    cannot flip the video to completed: completion is derived from accumulated
    watched seconds, which seeks do not increase."""
    vid = isolation_fixture["video_id"]  # 300s video
    h = make_auth_header(2, "student")

    # Watch ~20% of real time (60s), then seek to the end and claim completion
    client.post(
        f"/learn/videos/{vid}/progress",
        headers=h,
        json={"watched_seconds": 60.0, "last_position_seconds": 60}
    )
    res = client.post(
        f"/learn/videos/{vid}/progress",
        headers=h,
        json={"watched_seconds": 60.0, "last_position_seconds": 300, "completed": True}
    )
    assert res.status_code == 400

    vp = db_session.query(StudentVideoProgress).filter(
        StudentVideoProgress.video_id == vid, StudentVideoProgress.student_id == 1
    ).first()
    assert vp.watched_seconds == 60.0       # seeks add no watch time
    # The rejected write is discarded entirely (mutation never committed):
    # playhead remains at the last successful sync, nothing was persisted.
    assert vp.last_position_seconds == 60
    assert vp.watch_percentage == 20.0      # derived from real coverage
    assert vp.completed is False


def test_completion_from_real_watch_time(client, isolation_fixture, db_session):
    """Real playback accumulating >= threshold of the duration auto-completes."""
    vid = isolation_fixture["video_id"]  # 300s video, threshold 95%
    h = make_auth_header(2, "student")

    res = client.post(
        f"/learn/videos/{vid}/progress",
        headers=h,
        json={"watched_seconds": 240.0, "last_position_seconds": 240}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["progress_pct"] == 80.0
    assert body["completed"] is False

    # Keep watching past the threshold in later syncs (monotonic accumulation)
    res2 = client.post(
        f"/learn/videos/{vid}/progress",
        headers=h,
        json={"watched_seconds": 288.0, "last_position_seconds": 292, "completed": True}
    )
    assert res2.status_code == 200
    assert res2.json()["progress_pct"] == 96.0
    assert res2.json()["completed"] is True

    vp = db_session.query(StudentVideoProgress).filter(
        StudentVideoProgress.video_id == vid, StudentVideoProgress.student_id == 1
    ).first()
    assert vp.watched_seconds == 288.0
    assert vp.completed_at is not None


def test_auto_completion_at_threshold(client, isolation_fixture, db_session):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")

    res = client.post(f"/learn/videos/{vid}/progress", headers=h, json={"progress_pct": 96.0})
    assert res.status_code == 200
    assert res.json()["completed"] is True


def test_explicit_completion_at_threshold_accepted(client, isolation_fixture):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")
    res = client.post(f"/learn/videos/{vid}/progress", headers=h, json={"progress_pct": 100.0, "completed": True})
    assert res.status_code == 200
    assert res.json()["completed"] is True


def test_no_duplicate_progress_records(client, isolation_fixture, db_session):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")
    for _ in range(4):
        r = client.post(f"/learn/videos/{vid}/progress", headers=h, json={"progress_pct": 10.0})
        assert r.status_code == 200
    count = db_session.query(StudentVideoProgress).filter(
        StudentVideoProgress.video_id == vid, StudentVideoProgress.student_id == 1
    ).count()
    assert count == 1


def test_admin_cannot_record_video_progress(client, isolation_fixture, db_session):
    """Admin progress writes must not be misattributed to an arbitrary student."""
    vid = isolation_fixture["video_id"]
    res = client.post(f"/learn/videos/{vid}/progress", headers=make_auth_header(1, "admin"), json={"progress_pct": 100.0, "completed": True})
    assert res.status_code == 403
    # No progress row may exist for any student on this video
    assert db_session.query(StudentVideoProgress).filter(StudentVideoProgress.video_id == vid).count() == 0


def test_student_with_no_subject_assignments_cannot_open_videos(client, isolation_fixture):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(isolation_fixture["no_subject_user_id"], "student")
    res = client.get(f"/learn/videos/{vid}", headers=h)
    assert res.status_code == 403
    assert "not assigned" in res.json()["detail"].lower()


def test_assigned_student_can_open_published_video(client, isolation_fixture):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")  # Alice, linked to QA3B Subject
    res = client.get(f"/learn/videos/{vid}", headers=h)
    assert res.status_code == 200
    assert res.json()["review_status"] == "published"


def test_captions_vtt_conversion_and_authz(client, isolation_fixture, db_session):
    """SRT captions are served as WebVTT to authorized students; unauthenticated
    requests are rejected."""
    import os as _os
    vid = isolation_fixture["video_id"]

    video = db_session.get(Video, vid)
    srt_rel = f"videos/{vid}/captions_test.srt"
    uploads_dir = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "uploads")
    srt_abs_dir = _os.path.join(uploads_dir, "videos", str(vid))
    _os.makedirs(srt_abs_dir, exist_ok=True)
    srt_abs = _os.path.join(srt_abs_dir, "captions_test.srt")
    with open(srt_abs, "w", encoding="utf-8") as f:
        f.write(
            "1\n00:00:01,000 --> 00:00:04,500\nWelcome to the lesson.\n\n"
            "2\n00:00:04,500 --> 00:00:08,750\nWork equals force times displacement.\n"
        )
    video.captions_storage_key = srt_rel
    db_session.commit()

    try:
        h = make_auth_header(2, "student")  # Alice, assigned to QA3B Subject
        res = client.get(f"/learn/videos/{vid}/captions.vtt", headers=h)
        assert res.status_code == 200
        assert "text/vtt" in res.headers.get("content-type", "")
        body = res.text
        assert body.startswith("WEBVTT")
        assert "00:00:01.000 --> 00:00:04.500" in body  # comma -> dot conversion
        assert "Welcome to the lesson." in body

        # Unauthenticated access rejected
        assert client.get(f"/learn/videos/{vid}/captions.vtt").status_code == 401

        # Zero-assignment student rejected
        h2 = make_auth_header(isolation_fixture["no_subject_user_id"], "student")
        res2 = client.get(f"/learn/videos/{vid}/captions.vtt", headers=h2)
        assert res2.status_code == 403
    finally:
        if _os.path.exists(srt_abs):
            _os.remove(srt_abs)


def test_video_detail_reports_captions_and_resume_state(client, isolation_fixture, db_session):
    vid = isolation_fixture["video_id"]
    h = make_auth_header(2, "student")

    # Record some progress first
    client.post(f"/learn/videos/{vid}/progress", headers=h, json={"watched_seconds": 90.0, "last_position_seconds": 90})

    video = db_session.get(Video, vid)
    video.captions_storage_key = f"videos/{vid}/captions_test.srt"
    db_session.commit()

    res = client.get(f"/learn/videos/{vid}", headers=h)
    assert res.status_code == 200
    body = res.json()
    assert body["captions_url"] == f"/learn/videos/{vid}/captions.vtt"
    assert body["resume_position_seconds"] == 90.0
    assert body["watch_percentage"] == 30.0  # 90s of a 300s video


def test_question_serialization_includes_real_explanation(db_session):
    """PHASE 3B: quiz question payloads expose the pedagogical `explanation`
    field (the frontend previously had to misuse `objective` for this)."""
    from app.routers.learning import serialize_student_quiz

    quiz = Quiz(
        topic_id=db_session.query(Quiz).first().topic_id if db_session.query(Quiz).first() else None,
        title="QA3B Explanation Quiz",
        quiz_type="TOPIC",
        status="PUBLISHED",
    )
    db_session.add(quiz)
    db_session.flush()
    q = Question(
        quiz_id=quiz.id,
        question_text="What does the work-energy theorem state?",
        question_type="MCQ",
        correct_answer="A",
        explanation="Work equals the change in kinetic energy.",
        options=["Work equals the change in kinetic energy", "Force equals mass times acceleration"],
        objective="Work-energy theorem",
        order_index=1,
    )
    db_session.add(q)
    db_session.commit()

    out = serialize_student_quiz(quiz)
    assert out.questions[0].explanation == "Work equals the change in kinetic energy."
    assert out.questions[0].objective == "Work-energy theorem"


def test_admin_adaptive_quiz_leaks_no_other_students_weak_concepts(client, db_session):
    """Admin caller (no student record) must not aggregate other users' attempts."""
    # Create an attempt with weak concepts for student 1
    quiz = db_session.query(Quiz).first()
    if not quiz:
        pytest.skip("No quiz available in shared test DB")
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_id=1,
        score=1,
        total_questions=5,
        percentage=20.0,
        passed=False,
        answers=[],
        weak_concepts=["kinetic energy", "work-energy theorem"],
    )
    db_session.add(attempt)
    db_session.commit()

    res = client.get("/learn/quizzes/adaptive", headers=make_auth_header(1, "admin"))
    assert res.status_code == 200
    assert res.json()["identified_weak_concepts"] == []

    # Student still sees their own weak concepts
    res_stu = client.get("/learn/quizzes/adaptive", headers=make_auth_header(2, "student"))
    assert res_stu.status_code == 200
    assert "kinetic energy" in res_stu.json()["identified_weak_concepts"]
