import pytest
from app.models.models import (
    User, Subject, Chapter, Topic, Subtopic, Video,
    Quiz, Question, StudentSubject, VideoRenderVersion, ProcessingJob
)
from tests.conftest import make_auth_header
from app.services.video_rendering import VideoGenerationService
from app.services.quiz_service import QuizService


@pytest.fixture
def auth_headers():
    return {
        "admin": make_auth_header(1, "admin"),
        "student": make_auth_header(2, "student"),
        "teacher": make_auth_header(4, "teacher"),
        "parent": make_auth_header(5, "parent"),
    }


def create_test_curriculum(db, title="Build83 Curriculum"):
    subject = Subject(name=f"Subj-{title}", created_by=1)
    db.add(subject)
    db.flush()

    link = StudentSubject(student_id=2, subject_id=subject.id)
    db.add(link)

    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=1,
        title=f"Chap-{title}",
        status="APPROVED",
        source_start_page=10,
        source_end_page=30
    )
    db.add(chapter)
    db.flush()

    topic_desc = (
        f"In-depth analysis of {title}. "
        f"Standard textbook narrative detailing algorithmic structures, node pointers, key comparisons, and edge conditions. " * 15
    )
    topic = Topic(
        chapter_id=chapter.id,
        title=f"Topic-{title}",
        description=topic_desc,
        status="APPROVED",
        source_start_page=10,
        source_end_page=20
    )
    db.add(topic)
    db.flush()

    subtopic = Subtopic(
        topic_id=topic.id,
        title=f"Subtopic-{title}",
        description=f"Detailed theoretical breakdown and worked examples for {title}. " * 10,
        sequence_number=1,
        source_start_page=10,
        source_end_page=15
    )
    db.add(subtopic)
    db.flush()

    return subject, chapter, topic, subtopic


# ==============================================================================
# 1. CONTENT REVIEW TESTS
# ==============================================================================

def test_content_review_list_and_rbac(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    student_h = auth_headers["student"]
    teacher_h = auth_headers["teacher"]

    # Student / Teacher forbidden from calling admin review items
    assert client.get("/admin/review/items", headers=student_h).status_code == 403
    assert client.get("/admin/review/items", headers=teacher_h).status_code == 403

    # Admin allowed
    res = client.get("/admin/review/items?status=all", headers=admin_h)
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    for it in items:
        assert "status" in it
        assert "review_status" in it
        assert "type" in it


def test_content_review_inspect_details(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, _ = create_test_curriculum(db_session, "Inspect Item")

    # Create a quiz under this topic
    quiz = Quiz(
        topic_id=topic.id,
        title="Inspectable Quiz",
        status="REVIEW",
        passing_score=80.0
    )
    db_session.add(quiz)
    db_session.flush()

    q1 = Question(
        quiz_id=quiz.id,
        question_text="What is a red-black tree invariant?",
        options=["Root is black", "Root is red", "Leaves are red", "None"],
        correct_answer="0",
        objective="Invariants"
    )
    db_session.add(q1)
    db_session.commit()

    res = client.get(f"/admin/review/items/{quiz.id}?type=quiz", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "quiz"
    assert data["status"] == "review"
    assert "details" in data
    assert data["details"]["question_count"] == 1
    assert data["details"]["questions"][0]["question_text"] == "What is a red-black tree invariant?"


def test_content_review_approval_gate_unrendered_video_rejected(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, _ = create_test_curriculum(db_session, "Unrendered Video Gate")

    video = Video(
        topic_id=topic.id,
        title="Unrendered Gate Video",
        status="REVIEW",
        render_status="NOT_STARTED",
        duration_seconds=330
    )
    db_session.add(video)
    db_session.commit()

    # Attempt to approve via Content Review gate
    res = client.post(
        f"/admin/review/items/{video.id}/approval?type=video",
        headers=admin_h,
        json={"decision": "approve", "notes": "Try publishing"}
    )
    assert res.status_code == 400
    assert "cannot publish: video has not been rendered" in res.json()["detail"].lower()


# ==============================================================================
# 2. SCRIPT REVIEW TESTS
# ==============================================================================

def test_script_review_approved_plans_returned_unapproved_excluded(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, _ = create_test_curriculum(db_session, "Script Dropdown Plans")

    # Unapproved plan
    unapp = Video(
        topic_id=topic.id,
        title="Unapproved Plan",
        status="REVIEW",
        script_status=None,
        duration_seconds=300
    )
    db_session.add(unapp)

    # Approved plan
    app = Video(
        topic_id=topic.id,
        title="Approved Video Plan For Narration",
        status="APPROVED",
        script_status=None,
        duration_seconds=330,
        source_start_page=12,
        source_end_page=15,
        learning_objective="Understand asymptotic notation",
        content_outline=["Intro", "Big-O definition", "Examples"]
    )
    db_session.add(app)
    db_session.commit()

    res = client.get("/admin/video-plans?status=APPROVED", headers=admin_h)
    assert res.status_code == 200
    plans = res.json()
    titles = [p["title"] for p in plans]
    assert "Approved Video Plan For Narration" in titles
    assert "Unapproved Plan" not in titles

    # Verify 10-point metadata response shape
    target = next(p for p in plans if p["id"] == app.id)
    assert target["subject_name"] is not None
    assert target["chapter_title"] is not None
    assert target["topic_title"] is not None
    assert target["title"] == "Approved Video Plan For Narration"
    assert target["duration_seconds"] == 330
    assert target["learning_objective"] == "Understand asymptotic notation"
    assert len(target["content_outline"]) == 3
    assert target["source_start_page"] == 12
    assert target["source_end_page"] == 15
    assert target["status"] == "APPROVED"


def test_script_review_generation_and_approval_workflow(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, subtopic = create_test_curriculum(db_session, "Script Full Lifecycle")

    plan = Video(
        topic_id=topic.id,
        subtopic_id=subtopic.id,
        title="Script Lifecycle Video",
        description="Comprehensive lesson on script lifecycle.",
        status="APPROVED",
        script_status=None,
        duration_seconds=330,
        source_start_page=10,
        source_end_page=15,
        content_outline=["Introduction to Script Lifecycle", "Core Invariants", "Worked Example"]
    )
    db_session.add(plan)
    db_session.commit()

    # 1. Generate script
    gen_res = client.post(f"/admin/video-plans/{plan.id}/script/generate", headers=admin_h)
    assert gen_res.status_code == 200
    script_data = gen_res.json()
    assert script_data["script_status"] in ["SCRIPT_REVIEW", "NEEDS_REVIEW"]
    assert len(script_data["sections"]) > 0

    # 2. Edit section
    sections = script_data["sections"]
    sections[0]["narration"] = "Updated spoken narration grounded in textbook."
    patch_res = client.patch(
        f"/admin/video-plans/{plan.id}/script",
        headers=admin_h,
        json={"sections": sections}
    )
    assert patch_res.status_code == 200

    # 3. Approve script
    app_res = client.post(f"/admin/video-plans/{plan.id}/script/approve", headers=admin_h)
    assert app_res.status_code == 200
    assert app_res.json()["script_status"] == "SCRIPT_APPROVED"

    # DB verified
    db_session.refresh(plan)
    assert plan.script_status == "SCRIPT_APPROVED"


# ==============================================================================
# 3. VIDEO REVIEW & LIFECYCLE TESTS
# ==============================================================================

def test_video_generation_requires_approved_script(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, _ = create_test_curriculum(db_session, "Gate Unapproved Script")

    # Video with script_status=None
    v1 = Video(
        topic_id=topic.id,
        title="No Script Video",
        status="APPROVED",
        script_status=None,
        duration_seconds=300
    )
    db_session.add(v1)
    db_session.commit()

    res1 = client.post(f"/admin/video-plans/{v1.id}/video/generate", headers=admin_h)
    assert res1.status_code == 400
    assert "video rendering requires an approved script" in res1.json()["detail"].lower()

    # Video with script_status="SCRIPT_REVIEW"
    v1.script_status = "SCRIPT_REVIEW"
    db_session.commit()

    res2 = client.post(f"/admin/video-plans/{v1.id}/video/generate", headers=admin_h)
    assert res2.status_code == 400
    assert "video rendering requires an approved script" in res2.json()["detail"].lower()


def test_video_publish_validation_and_placeholder_protection(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, _ = create_test_curriculum(db_session, "Publish Protection")

    # 1. Unrendered video cannot be published
    v1 = Video(
        topic_id=topic.id,
        title="Unrendered Plan",
        status="REVIEW",
        render_status="NOT_STARTED",
        script_status="SCRIPT_APPROVED",
        duration_seconds=300
    )
    db_session.add(v1)
    db_session.commit()

    res1 = client.post(f"/admin/videos/{v1.id}/publish", headers=admin_h)
    assert res1.status_code == 400
    assert "cannot publish: video has not been rendered" in res1.json()["detail"].lower()

    # 2. Placeholder video cannot be published
    v2 = Video(
        topic_id=topic.id,
        title="Placeholder Seed Video",
        status="APPROVED",
        render_status="RENDERED",
        script_status="SCRIPT_APPROVED",
        actual_duration_seconds=300.0,
        scenes_data=[{"type": "CONCEPT", "title": "Intro", "duration_seconds": 300.0}],
        video_storage_key="/static/videos/seed_1_1.mp4"
    )
    db_session.add(v2)
    db_session.commit()

    res2 = client.post(f"/admin/videos/{v2.id}/publish", headers=admin_h)
    assert res2.status_code == 400
    assert "placeholder" in res2.json()["detail"].lower()


def test_student_cannot_see_unrendered_or_placeholder_videos(client, auth_headers, db_session):
    student_h = auth_headers["student"]
    _, _, topic, _ = create_test_curriculum(db_session, "Student Privacy Video")

    # Placeholder video marked PUBLISHED in legacy data
    v_placeholder = Video(
        topic_id=topic.id,
        title="Legacy Seed Video",
        status="PUBLISHED",
        render_status="NOT_STARTED",
        video_storage_key="/static/videos/seed_1_1.mp4"
    )
    db_session.add(v_placeholder)
    db_session.commit()

    res = client.get(f"/learn/videos/{v_placeholder.id}", headers=student_h)
    assert res.status_code in [404, 403]


# ==============================================================================
# 4. QUIZ MANAGEMENT & REVIEW TESTS
# ==============================================================================

def test_quiz_publish_validation_rules(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, topic, _ = create_test_curriculum(db_session, "Quiz Validation")

    # 1. Quiz with 0 questions cannot publish
    empty_quiz = Quiz(
        topic_id=topic.id,
        title="Empty Quiz",
        status="REVIEW",
        passing_score=80.0
    )
    db_session.add(empty_quiz)
    db_session.commit()

    res1 = client.post(f"/admin/quizzes/{empty_quiz.id}/publish", headers=admin_h)
    assert res1.status_code == 400
    assert "no valid questions" in res1.json()["detail"].lower()

    # 2. Add question with invalid distractor duplication
    bad_q = Question(
        quiz_id=empty_quiz.id,
        question_text="Valid text",
        options=["Duplicate", "Duplicate"],
        correct_answer="0"
    )
    db_session.add(bad_q)
    db_session.commit()

    res2 = client.post(f"/admin/quizzes/{empty_quiz.id}/publish", headers=admin_h)
    assert res2.status_code == 400
    assert "duplicate answer options" in res2.json()["detail"].lower()

    # 3. Fix options to be unique and valid
    bad_q.options = ["Option A", "Option B", "Option C", "Option D"]
    bad_q.correct_answer = "0"
    db_session.commit()

    res3 = client.post(f"/admin/quizzes/{empty_quiz.id}/publish", headers=admin_h)
    assert res3.status_code == 200
    assert res3.json()["status"] == "PUBLISHED"
