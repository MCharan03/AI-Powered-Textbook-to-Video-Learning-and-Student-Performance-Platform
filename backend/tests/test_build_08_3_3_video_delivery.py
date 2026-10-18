import os
import pytest
from app.models.models import (
    User, Student, Subject, Chapter, Topic, Video,
    StudentSubject, Role
)
from tests.conftest import make_auth_header
from app.core.security import hash_pw


@pytest.fixture
def video_delivery_fixture(db_session):
    """Sets up an assigned subject with a rendered real video, an unrendered video, and a placeholder video."""
    # Ensure students
    user_assigned = db_session.query(User).filter(User.username == "student_delivery_assigned").first()
    if not user_assigned:
        user_assigned = User(
            username="student_delivery_assigned",
            name="Assigned Student",
            email="assigned_delivery@example.com",
            password_hash=hash_pw("Pass123!"),
            role=Role.STUDENT,
            is_active=True
        )
        db_session.add(user_assigned)
        db_session.flush()

        student_assigned = Student(
            user_id=user_assigned.id,
            student_id="CMRIT_DELIV_ASSIGNED",
            name="Assigned Student",
            email="assigned_delivery@example.com"
        )
        db_session.add(student_assigned)
        db_session.flush()
    else:
        student_assigned = db_session.query(Student).filter(Student.user_id == user_assigned.id).first()

    user_unauthorized = db_session.query(User).filter(User.username == "student_delivery_unauthorized").first()
    if not user_unauthorized:
        user_unauthorized = User(
            username="student_delivery_unauthorized",
            name="Unauthorized Student",
            email="unauth_delivery@example.com",
            password_hash=hash_pw("Pass123!"),
            role=Role.STUDENT,
            is_active=True
        )
        db_session.add(user_unauthorized)
        db_session.flush()

        student_unauthorized = Student(
            user_id=user_unauthorized.id,
            student_id="CMRIT_DELIV_UNAUTH",
            name="Unauthorized Student",
            email="unauth_delivery@example.com"
        )
        db_session.add(student_unauthorized)
        db_session.flush()
    else:
        student_unauthorized = db_session.query(Student).filter(Student.user_id == user_unauthorized.id).first()

    # Subjects
    subj = Subject(name="Computer Science - Delivery Testing", created_by=1)
    other_subj = Subject(name="Other Subject - Delivery Testing", created_by=1)
    db_session.add(subj)
    db_session.add(other_subj)
    db_session.flush()

    # Link assigned student to CS only
    link1 = StudentSubject(student_id=student_assigned.id, subject_id=subj.id)
    # Link unauthorized student to Other Subject only
    link2 = StudentSubject(student_id=student_unauthorized.id, subject_id=other_subj.id)
    db_session.add(link1)
    db_session.add(link2)

    # Chapter & Topic
    chap = Chapter(
        subject_id=subj.id,
        chapter_number=1,
        title="Array Structures",
        status="APPROVED"
    )
    db_session.add(chap)
    db_session.flush()

    top = Topic(
        chapter_id=chap.id,
        sequence_number=1,
        title="Arrays and Dynamic Sizing",
        status="APPROVED"
    )
    db_session.add(top)
    db_session.flush()

    # 1. Real rendered & published video
    v_real = Video(
        topic_id=top.id,
        sequence_number=1,
        title="Array Foundations - Module 1",
        status="PUBLISHED",
        render_status="RENDERED",
        storage_key="",
        video_storage_key="",
        actual_duration_seconds=321.21,
        duration_seconds=330,
        video_url=""
    )
    db_session.add(v_real)
    db_session.flush()

    # Create real test MP4 in uploads/videos/{vid}
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    v1_dir = os.path.join(uploads_dir, "videos", str(v_real.id))
    os.makedirs(v1_dir, exist_ok=True)
    real_mp4_path = os.path.join(v1_dir, f"video_{v_real.id}.mp4")
    with open(real_mp4_path, "wb") as f:
        f.write(b"\x00\x00\x00 ftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00(moov" + b"\x00" * 4096)

    v_real.storage_key = f"videos/{v_real.id}/video_{v_real.id}.mp4"
    v_real.video_storage_key = f"videos/{v_real.id}/video_{v_real.id}.mp4"
    v_real.video_url = f"videos/{v_real.id}/video_{v_real.id}.mp4"

    # 2. Unrendered video
    v_unrendered = Video(
        topic_id=top.id,
        sequence_number=2,
        title="Unrendered Video Lesson",
        status="PUBLISHED",
        render_status="PENDING",
        storage_key=None,
        video_storage_key=None,
        actual_duration_seconds=None,
        duration_seconds=330,
        video_url=None
    )
    db_session.add(v_unrendered)

    # 3. Placeholder / Seed video
    v_placeholder = Video(
        topic_id=top.id,
        sequence_number=3,
        title="Placeholder Seed Video",
        status="PUBLISHED",
        render_status="RENDERED",
        storage_key="/static/videos/seed_1_1.mp4",
        video_storage_key="/static/videos/seed_1_1.mp4",
        actual_duration_seconds=120.0,
        duration_seconds=120,
        video_url="/static/videos/seed_1_1.mp4"
    )
    db_session.add(v_placeholder)

    db_session.commit()

    return {
        "user_assigned_id": user_assigned.id,
        "user_unauth_id": user_unauthorized.id,
        "v_real_id": v_real.id,
        "v_unrendered_id": v_unrendered.id,
        "v_placeholder_id": v_placeholder.id,
        "real_mp4_path": real_mp4_path
    }


def test_1_get_video_returns_valid_playable_url(client, video_delivery_fixture):
    """TEST 1: GET /learn/videos/{id} returns a valid playable video URL."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_real_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "video_url" in data
    assert data["video_url"].startswith("/assets/") or data["video_url"].startswith("/videos/")
    assert data["video_url"].endswith(".mp4")


def test_2_returned_url_resolves_to_real_mp4(client, video_delivery_fixture):
    """TEST 2: The returned URL resolves to the real MP4 on disk."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_real_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    video_url = res.json()["video_url"]

    # Request the resolved URL directly from the application
    mp4_res = client.get(video_url)
    assert mp4_res.status_code == 200
    assert len(mp4_res.content) > 0


def test_3_content_type_and_range_requests(client, video_delivery_fixture):
    """TEST 3: Content-Type is video/mp4 and byte-range requests return HTTP 206 Partial Content."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_real_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    video_url = res.json()["video_url"]

    # Full request
    full_res = client.get(video_url)
    assert full_res.status_code == 200
    assert full_res.headers.get("content-type") == "video/mp4"
    assert full_res.headers.get("accept-ranges") == "bytes"

    # Range request (HTTP 206)
    range_res = client.get(video_url, headers={"Range": "bytes=0-100"})
    assert range_res.status_code == 206
    assert range_res.headers.get("content-type") == "video/mp4"
    assert "bytes 0-100/" in range_res.headers.get("content-range", "")
    assert range_res.headers.get("content-length") == "101"
    assert len(range_res.content) == 101


def test_4_video_has_non_zero_duration(client, video_delivery_fixture):
    """TEST 4: Video has non-zero duration in both integer duration_seconds and float actual_duration_seconds."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_real_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["duration_seconds"] > 0
    assert data["actual_duration_seconds"] is not None
    assert data["actual_duration_seconds"] > 0


def test_5_rendered_published_video_authorized_student(client, video_delivery_fixture):
    """TEST 5: RENDERED + PUBLISHED video can be requested by authorized student."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_real_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    assert res.status_code == 200
    assert res.json()["title"] == "Array Foundations - Module 1"


def test_6_unrendered_video_cannot_be_requested(client, video_delivery_fixture):
    """TEST 6: Unrendered video cannot be requested by students (returns 404)."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_unrendered_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    assert res.status_code == 404


def test_7_placeholder_video_cannot_be_requested(client, video_delivery_fixture):
    """TEST 7: Placeholder / Seed video cannot be requested by students (returns 404)."""
    headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    vid = video_delivery_fixture["v_placeholder_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    assert res.status_code == 404


def test_8_unauthorized_student_cannot_access_video(client, video_delivery_fixture):
    """TEST 8: Unauthorized student cannot access video for unassigned subject (returns 403)."""
    headers = make_auth_header(video_delivery_fixture["user_unauth_id"], "student")
    vid = video_delivery_fixture["v_real_id"]
    res = client.get(f"/learn/videos/{vid}", headers=headers)
    assert res.status_code == 403
    assert "not assigned" in res.json().get("detail", "").lower()


def test_9_video_player_url_consistency(client, video_delivery_fixture):
    """TEST 9: Admin video review and Student video player resolve to the same canonical URL."""
    student_headers = make_auth_header(video_delivery_fixture["user_assigned_id"], "student")
    admin_headers = make_auth_header(1, "admin")
    vid = video_delivery_fixture["v_real_id"]

    student_res = client.get(f"/learn/videos/{vid}", headers=student_headers)
    assert student_res.status_code == 200
    student_url = student_res.json()["video_url"]

    admin_res = client.get(f"/admin/videos/{vid}", headers=admin_headers)
    assert admin_res.status_code == 200
    admin_url = admin_res.json()["video_url"]

    # Canonical URL consistency
    assert student_url == admin_url
    assert student_url.startswith(f"/assets/videos/{vid}/")
