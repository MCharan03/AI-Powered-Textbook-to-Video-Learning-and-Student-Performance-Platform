import pytest
from app.models.models import (
    User, Student, Subject, Chapter, Topic, Video, Quiz, Question,
    StudentSubject, StudentVideoProgress, Role
)
from tests.conftest import make_auth_header
from app.core.security import hash_pw


@pytest.fixture
def auth_headers(db_session):
    # Ensure unassigned student user exists in test DB
    unassigned_user = db_session.query(User).filter(User.username == "unassigned_student").first()
    if not unassigned_user:
        unassigned_user = User(
            username="unassigned_student",
            name="Unassigned Student",
            email="unassigned@example.com",
            password_hash=hash_pw("Pass123!"),
            role=Role.STUDENT,
            is_active=True
        )
        db_session.add(unassigned_user)
        db_session.flush()

        unassigned_student = Student(
            user_id=unassigned_user.id,
            student_id="CMRIT_UNASSIGNED",
            name="Unassigned Student",
            email="unassigned@example.com"
        )
        db_session.add(unassigned_student)
        db_session.commit()
    else:
        unassigned_student = db_session.query(Student).filter(Student.user_id == unassigned_user.id).first()

    return {
        "admin": make_auth_header(1, "admin"),
        "student_assigned": make_auth_header(2, "student"),  # Alice (Student ID 1)
        "student_unassigned": make_auth_header(unassigned_user.id, "student"),
    }


@pytest.fixture
def curriculum_fixture(db_session):
    """Sets up Computer Science & Engineering curriculum and an unassigned Chemical Science curriculum."""
    # 1. Computer Science & Engineering (Assigned to Student 1)
    cs_subject = Subject(name="Computer Science & Engineering", created_by=1)
    db_session.add(cs_subject)
    db_session.flush()

    # Assign student 1 to CS
    link = StudentSubject(student_id=1, subject_id=cs_subject.id)
    db_session.add(link)

    cs_chapter = Chapter(
        subject_id=cs_subject.id,
        chapter_number=1,
        title="Data Structures & Algorithms",
        status="APPROVED"
    )
    db_session.add(cs_chapter)
    db_session.flush()

    cs_topic = Topic(
        chapter_id=cs_chapter.id,
        sequence_number=1,
        title="Arrays and Dynamic Sizing",
        status="APPROVED"
    )
    db_session.add(cs_topic)
    db_session.flush()

    # Published + rendered video
    v1_published = Video(
        topic_id=cs_topic.id,
        title="Array Foundations - Module 1",
        description="Core principles of array data structures",
        status="PUBLISHED",
        render_status="RENDERED",
        duration_seconds=321,
        actual_duration_seconds=321.0,
        storage_key="/static/videos/array_1.mp4",
        video_storage_key="videos/1/real_rendered.mp4"
    )
    # Review video (not published)
    v2_review = Video(
        topic_id=cs_topic.id,
        title="Array Foundations - Module 2",
        description="Dynamic sizing mechanics",
        status="REVIEW",
        render_status="NOT_STARTED",
        duration_seconds=330
    )
    db_session.add_all([v1_published, v2_review])
    db_session.flush()

    # Quiz for Arrays
    cs_quiz = Quiz(
        topic_id=cs_topic.id,
        title="Arrays Diagnostic Assessment",
        quiz_type="TOPIC",
        passing_score=80.0,
        status="PUBLISHED"
    )
    db_session.add(cs_quiz)
    db_session.flush()

    q1 = Question(
        quiz_id=cs_quiz.id,
        question_text="What is the random access time complexity in an array?",
        options=["O(1)", "O(n)", "O(log n)", "O(n^2)"],
        correct_answer="0"
    )
    db_session.add(q1)

    # 2. Chemical Science (UNASSIGNED to Student 1)
    chem_subject = Subject(name="Chemical Science", created_by=1)
    db_session.add(chem_subject)
    db_session.flush()

    chem_chapter = Chapter(
        subject_id=chem_subject.id,
        chapter_number=1,
        title="Chemical Reactions & Equations",
        status="APPROVED"
    )
    db_session.add(chem_chapter)
    db_session.flush()

    chem_topic = Topic(
        chapter_id=chem_chapter.id,
        sequence_number=1,
        title="Types of Chemical Reactions",
        status="APPROVED"
    )
    db_session.add(chem_topic)
    db_session.flush()

    chem_video = Video(
        topic_id=chem_topic.id,
        title="Chemical Reactions Lesson 1",
        status="PUBLISHED",
        render_status="RENDERED",
        duration_seconds=330,
        actual_duration_seconds=330.0,
        storage_key="/static/videos/chem_1.mp4",
        video_storage_key="videos/chem/chem_1.mp4"
    )
    chem_quiz = Quiz(
        topic_id=chem_topic.id,
        title="Chemical Reactions Mastery Quiz",
        quiz_type="TOPIC",
        passing_score=80.0,
        status="PUBLISHED"
    )
    db_session.add_all([chem_video, chem_quiz])
    db_session.commit()

    return {
        "cs_subject": cs_subject,
        "cs_topic": cs_topic,
        "v1": v1_published,
        "v2": v2_review,
        "cs_quiz": cs_quiz,
        "chem_subject": chem_subject,
        "chem_topic": chem_topic,
        "chem_video": chem_video,
        "chem_quiz": chem_quiz
    }


def test_01_student_assigned_to_cs_sees_array_foundations(client, auth_headers, curriculum_fixture):
    """TEST 1: Student assigned to Computer Science & Engineering sees Array Foundations - Module 1."""
    res = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
    assert res.status_code == 200
    data = res.json()
    assert "Computer Science & Engineering" in data["assigned_subjects"]
    assert data["resume_learning"] is not None
    assert data["resume_learning"]["video_title"] == "Array Foundations - Module 1"
    assert data["resume_learning"]["subject_name"] == "Computer Science & Engineering"
    assert data["resume_learning"]["topic_title"] == "Arrays and Dynamic Sizing"

    mod_titles = [m["title"] for m in data["modules"]]
    assert "Array Foundations - Module 1" in mod_titles


def test_02_student_does_not_see_chemical_reactions_unless_assigned(client, auth_headers, curriculum_fixture):
    """TEST 2: Student does not see Chemical Reactions content unless that subject is actually assigned to them."""
    res = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
    assert res.status_code == 200
    data = res.json()

    # Chemical Science is NOT assigned to student
    assert "Chemical Science" not in data["assigned_subjects"]
    assert "Chemical" not in str(data.get("resume_learning", {}))
    for m in data.get("modules", []):
        assert "Chemical" not in m["title"]
        assert "Chemical" not in m["subject_name"]
    for q in data.get("quizzes", []):
        assert "Chemical" not in q["title"]
        assert "Chemical" not in q["subject_name"]


def test_03_published_rendered_video_appears(client, auth_headers, curriculum_fixture):
    """TEST 3: Published + rendered video appears in student curriculum and dashboard."""
    res = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
    assert res.status_code == 200
    data = res.json()
    v1_id = curriculum_fixture["v1"].id
    v1_mods = [m for m in data["modules"] if m["item_id"] == v1_id]
    assert len(v1_mods) == 1
    assert v1_mods[0]["duration_seconds"] == 321
    assert v1_mods[0]["status"] in ["Ready to Watch", "In Progress", "Completed"]


def test_04_review_video_does_not_appear(client, auth_headers, curriculum_fixture):
    """TEST 4: REVIEW video does not appear in student dashboard or topic video list."""
    v2_id = curriculum_fixture["v2"].id
    res = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
    assert res.status_code == 200
    data = res.json()
    item_ids = [m["item_id"] for m in data["modules"]]
    assert v2_id not in item_ids

    # Query topic videos directly
    topic_id = curriculum_fixture["cs_topic"].id
    res_topic = client.get(f"/learn/topics/{topic_id}/videos", headers=auth_headers["student_assigned"])
    assert res_topic.status_code == 200
    topic_video_ids = [v["id"] for v in res_topic.json()]
    assert v2_id not in topic_video_ids


def test_05_not_rendered_video_does_not_appear(client, auth_headers, curriculum_fixture, db_session):
    """TEST 5: NOT_RENDERED video does not appear even if status is marked published."""
    v_unrendered = Video(
        topic_id=curriculum_fixture["cs_topic"].id,
        title="Unrendered Published Video",
        status="PUBLISHED",
        render_status="NOT_STARTED",
        storage_key="unrendered.mp4",
        duration_seconds=300
    )
    db_session.add(v_unrendered)
    db_session.commit()

    try:
        res = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
        assert res.status_code == 200
        mod_ids = [m["item_id"] for m in res.json()["modules"]]
        assert v_unrendered.id not in mod_ids

        res_v = client.get(f"/learn/videos/{v_unrendered.id}", headers=auth_headers["student_assigned"])
        assert res_v.status_code == 404
    finally:
        db_session.delete(v_unrendered)
        db_session.commit()


def test_06_placeholder_video_does_not_appear(client, auth_headers, curriculum_fixture, db_session):
    """TEST 6: Placeholder video (seed_*.mp4 or sample.mp4) does not appear to student."""
    v_placeholder = Video(
        topic_id=curriculum_fixture["cs_topic"].id,
        title="Placeholder Seed Video",
        status="PUBLISHED",
        render_status="RENDERED",
        storage_key="/static/videos/seed_1_1.mp4",
        video_storage_key="seed_1_1.mp4",
        duration_seconds=300,
        actual_duration_seconds=300.0
    )
    db_session.add(v_placeholder)
    db_session.commit()

    try:
        res = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
        assert res.status_code == 200
        mod_ids = [m["item_id"] for m in res.json()["modules"]]
        assert v_placeholder.id not in mod_ids

        res_v = client.get(f"/learn/videos/{v_placeholder.id}", headers=auth_headers["student_assigned"])
        assert res_v.status_code == 404
    finally:
        db_session.delete(v_placeholder)
        db_session.commit()


def test_07_unauthorized_student_content_cannot_be_accessed(client, auth_headers, curriculum_fixture):
    """TEST 7: Unauthorized student cannot access unassigned subjects or their videos."""
    # Student unassigned to Chemical Science cannot access Chemical Science video
    chem_video_id = curriculum_fixture["chem_video"].id
    res_v = client.get(f"/learn/videos/{chem_video_id}", headers=auth_headers["student_assigned"])
    assert res_v.status_code == 403

    # Student with no subjects has empty curriculum
    res_dash = client.get("/learn/dashboards/progress", headers=auth_headers["student_unassigned"])
    assert res_dash.status_code == 200
    data = res_dash.json()
    assert len(data["assigned_subjects"]) == 0
    assert data["resume_learning"] is None
    assert len(data["modules"]) == 0
    assert len(data["quizzes"]) == 0


def test_08_resume_learning_uses_actual_student_learning_state(client, auth_headers, curriculum_fixture, db_session):
    """TEST 8: Resume Learning uses the student's actual learning state."""
    v1_id = curriculum_fixture["v1"].id
    # Record in-progress playback on Video 1 for Alice (student_id=1)
    res_prog = client.post(
        f"/learn/videos/{v1_id}/progress",
        headers=auth_headers["student_assigned"],
        json={"progress_pct": 75.0, "completed": False}
    )
    assert res_prog.status_code == 200

    res_dash = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
    assert res_dash.status_code == 200
    resume = res_dash.json()["resume_learning"]
    assert resume is not None
    assert resume["video_id"] == v1_id
    assert resume["video_title"] == "Array Foundations - Module 1"
    assert resume["progress_percentage"] == 75.0
    assert resume["completed"] is False
    assert resume["duration_seconds"] == 321
    assert "5 min 21 sec" in resume["duration_minutes_formatted"]


def test_09_learning_modules_and_quizzes_correspond_to_authorized_curriculum(client, auth_headers, curriculum_fixture):
    """TEST 9: Learning Modules and quizzes correspond to the student's authorized curriculum."""
    res_dash = client.get("/learn/dashboards/progress", headers=auth_headers["student_assigned"])
    assert res_dash.status_code == 200
    data = res_dash.json()

    # Modules
    for m in data["modules"]:
        assert m["subject_name"] in data["assigned_subjects"]
        assert m["type"] == "video"

    # Quizzes
    for q in data["quizzes"]:
        assert q["subject_name"] in data["assigned_subjects"]
        assert q["type"] == "quiz"
        assert q["topic_title"] == "Arrays and Dynamic Sizing"

    quiz_titles = [q["title"] for q in data["quizzes"]]
    assert "Arrays Diagnostic Assessment" in quiz_titles
