"""
Video Studio backend workflow tests (Phase 3).

Covers:
- Chapter-scoped PDF upload (`source_type=CHAPTER` -> exactly one chapter)
- Complete-textbook upload remains chapter-split (TEXTBOOK mode)
- Admin-authored video plan creation, deletion safety, and textbook filtering
- Admin-requested regeneration feedback persistence + approval reset
- Publish gate: a rendered but unapproved video cannot be published
"""
import io

import pytest

from tests.conftest import make_auth_header
from app.models.models import (
    Video, Subject, Chapter, Topic, StudentSubject, Student, User, Role
)

PDF_BYTES = (
    b"%PDF-1.4\n1 0 obj\n<< /Title (Video Studio Test) >>\nendobj\n"
    b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
)


def _admin():
    return make_auth_header(1, "admin")


def _make_curriculum(db_session, marker: str):
    subject = Subject(name=f"Studio {marker}", created_by=1)
    db_session.add(subject)
    db_session.flush()
    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=1,
        title=f"Studio Chapter {marker}",
        status="APPROVED",
    )
    db_session.add(chapter)
    db_session.flush()
    topic = Topic(
        chapter_id=chapter.id,
        sequence_number=1,
        title=f"Studio Topic {marker}",
        status="APPROVED",
        source_start_page=1,
        source_end_page=5,
    )
    db_session.add(topic)
    db_session.commit()
    return subject, chapter, topic


def test_chapter_pdf_upload_creates_exactly_one_chapter(client, db_session):
    title = "Chapter 4: Thermodynamics"
    res = client.post(
        "/admin/textbooks",
        headers=_admin(),
        files={"file": (f"chapter_thermo_{title[-4:]}.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
        data={
            "title": title,
            "description": "Thermodynamics chapter PDF",
            "source_type": "CHAPTER",
            "chapter_number": "4",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["source_type"] == "CHAPTER"
    assert body["chapter_number"] == 4

    tb_id = body["id"]
    proc = client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=_admin())
    assert proc.status_code in (200, 202), proc.text

    hier = client.get(f"/admin/textbooks/{tb_id}/hierarchy", headers=_admin())
    assert hier.status_code == 200, hier.text
    chapters = hier.json()["chapters"]
    assert len(chapters) == 1, "A chapter PDF must be processed as exactly ONE chapter"
    assert chapters[0]["title"] == title
    assert chapters[0]["chapter_number"] == 4
    assert len(chapters[0]["topics"]) >= 1


def test_complete_textbook_upload_still_extracts_chapters(client):
    res = client.post(
        "/admin/textbooks",
        headers=_admin(),
        files={"file": ("full_textbook.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
        data={"title": "Full Textbook Upload", "source_type": "TEXTBOOK"},
    )
    assert res.status_code == 201, res.text
    tb_id = res.json()["id"]
    assert res.json()["source_type"] == "TEXTBOOK"

    proc = client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=_admin())
    assert proc.status_code in (200, 202), proc.text

    hier = client.get(f"/admin/textbooks/{tb_id}/hierarchy", headers=_admin())
    assert hier.status_code == 200
    assert len(hier.json()["chapters"]) >= 1


def test_admin_can_create_and_delete_a_video_plan(client, db_session):
    _, _, topic = _make_curriculum(db_session, "PlanCRUD")

    created = client.post(
        f"/admin/topics/{topic.id}/video-plans",
        headers=_admin(),
        json={
            "title": "Manual Plan: Entropy",
            "description": "Admin-authored supplemental video",
            "duration_seconds": 300,
            "content_outline": ["Entropy intuition", "Second law"],
            "learning_objective": "Explain entropy with examples",
            "source_start_page": 1,
            "source_end_page": 3,
        },
    )
    assert created.status_code == 201, created.text
    plan = created.json()
    assert plan["title"] == "Manual Plan: Entropy"
    assert plan["status"] == "REVIEW"
    assert plan["sequence_number"] >= 1

    deleted = client.delete(f"/admin/video-plans/{plan['id']}", headers=_admin())
    assert deleted.status_code == 200, deleted.text
    assert db_session.get(Video, plan["id"]) is None


def test_rendered_or_approved_plans_cannot_be_deleted(client, db_session):
    _, _, topic = _make_curriculum(db_session, "PlanSafety")

    rendered = Video(
        topic_id=topic.id,
        title="Rendered Plan",
        status="REVIEW",
        render_status="RENDERED",
        actual_duration_seconds=300.0,
        video_storage_key="videos/9999/video_9999_v1.mp4",
        duration_seconds=300,
    )
    approved = Video(
        topic_id=topic.id,
        title="Approved Plan",
        status="APPROVED",
        render_status="NOT_STARTED",
        duration_seconds=300,
    )
    db_session.add_all([rendered, approved])
    db_session.commit()

    assert client.delete(f"/admin/video-plans/{rendered.id}", headers=_admin()).status_code == 400
    assert client.delete(f"/admin/video-plans/{approved.id}", headers=_admin()).status_code == 400
    assert db_session.get(Video, rendered.id) is not None
    assert db_session.get(Video, approved.id) is not None


def test_video_and_plan_lists_filter_by_textbook(client, db_session):
    subject, chapter, topic = _make_curriculum(db_session, "FilterTb")
    other_subject, other_chapter, other_topic = _make_curriculum(db_session, "FilterOther")

    # Attach a textbook to this chapter for filtering
    from app.models.models import Textbook, PipelineStatus
    tb = Textbook(title="Filter Textbook", subject_id=subject.id, status=PipelineStatus.approved,
                  source_type="TEXTBOOK", stage=7, stages_log=[])
    other_tb = Textbook(title="Other Textbook", subject_id=other_subject.id, status=PipelineStatus.approved,
                        source_type="TEXTBOOK", stage=7, stages_log=[])
    db_session.add_all([tb, other_tb])
    db_session.flush()
    chapter.textbook_id = tb.id
    other_chapter.textbook_id = other_tb.id

    v1 = Video(topic_id=topic.id, title="Filter A", status="REVIEW", render_status="NOT_STARTED", duration_seconds=300)
    v2 = Video(topic_id=other_topic.id, title="Filter B", status="REVIEW", render_status="NOT_STARTED", duration_seconds=300)
    db_session.add_all([v1, v2])
    db_session.commit()

    plans = client.get(f"/admin/video-plans?textbook_id={tb.id}", headers=_admin())
    assert plans.status_code == 200
    assert {p["id"] for p in plans.json()} == {v1.id}

    videos = client.get(f"/admin/videos?textbook_id={tb.id}", headers=_admin())
    assert videos.status_code == 200
    assert {v["id"] for v in videos.json()} == {v1.id}


def test_request_regeneration_records_feedback_and_resets_approval(client, db_session):
    _, _, topic = _make_curriculum(db_session, "Regen")
    video = Video(
        topic_id=topic.id,
        title="Regen Review Video",
        status="APPROVED",
        render_status="RENDERED",
        script_status="SCRIPT_APPROVED",
        actual_duration_seconds=300.0,
        scenes_data=[{"type": "CONCEPT", "title": "Intro", "duration_seconds": 300.0}],
        video_storage_key="videos/8888/video_8888_v1.mp4",
        duration_seconds=300,
    )
    db_session.add(video)
    db_session.commit()

    empty = client.post(
        f"/admin/videos/{video.id}/request-regeneration",
        headers=_admin(),
        json={"feedback": "   "},
    )
    assert empty.status_code == 400

    res = client.post(
        f"/admin/videos/{video.id}/request-regeneration",
        headers=_admin(),
        json={"feedback": "Narration is too fast and the entropy slide is missing the formula."},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["regeneration_feedback"].startswith("Narration is too fast")
    assert body["regeneration_requested_at"] is not None
    # The PLAN stays approved so the script can be regenerated, but the script
    # re-enters review and publication remains blocked.
    assert body["status"] == "APPROVED"
    assert body["script_status"] == "NEEDS_REVIEW"

    db_session.refresh(video)
    assert video.status == "APPROVED"
    assert video.script_status == "NEEDS_REVIEW"

    blocked = client.post(f"/admin/videos/{video.id}/publish", headers=_admin())
    assert blocked.status_code == 400
    assert "script is not approved" in blocked.json()["detail"].lower()


def test_rendered_unapproved_video_cannot_be_published(client, db_session):
    _, _, topic = _make_curriculum(db_session, "PublishGate")
    video = Video(
        topic_id=topic.id,
        title="Needs Review Before Publish",
        status="REVIEW",
        render_status="RENDERED",
        script_status="SCRIPT_APPROVED",
        actual_duration_seconds=300.0,
        scenes_data=[{"type": "CONCEPT", "title": "Intro", "duration_seconds": 300.0}],
        video_storage_key="videos/7777/video_7777.mp4",
        duration_seconds=300,
    )
    db_session.add(video)
    db_session.commit()

    blocked = client.post(f"/admin/videos/{video.id}/publish", headers=_admin())
    assert blocked.status_code == 400
    assert "must be approved first" in blocked.json()["detail"].lower()

    approved = client.post(f"/admin/videos/{video.id}/approve", headers=_admin())
    assert approved.status_code == 200, approved.text

    published = client.post(f"/admin/videos/{video.id}/publish", headers=_admin())
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "PUBLISHED"


def test_regeneration_feedback_is_woven_into_revised_script(client, db_session):
    """Stage 4 & 6: Verify regeneration feedback is actually used when generating a revised script."""
    subject, chapter, topic = _make_curriculum(db_session, "FeedbackScript")
    topic.description = "Core principles of entropy, thermodynamic states, reversible processes, and the second law."
    db_session.commit()

    # Create and approve plan
    video = Video(
        topic_id=topic.id,
        title="Entropy Mechanics",
        status="APPROVED",
        render_status="NOT_STARTED",
        duration_seconds=300,
        content_outline=["Entropy concept", "Second law"],
        source_start_page=1,
        source_end_page=5,
    )
    db_session.add(video)
    db_session.commit()

    # Initial script generation
    res_s1 = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=_admin())
    assert res_s1.status_code == 200
    s1 = res_s1.json()
    assert s1["script_status"] in ("SCRIPT_REVIEW", "NEEDS_REVIEW")
    assert s1.get("regeneration_feedback") is None

    # Admin requests changes with feedback
    fb_text = "Please emphasize the second law and provide a clearer recap."
    res_fb = client.post(
        f"/admin/videos/{video.id}/request-regeneration",
        headers=_admin(),
        json={"feedback": fb_text}
    )
    assert res_fb.status_code == 200
    assert res_fb.json()["script_status"] == "NEEDS_REVIEW"

    # Regenerate script
    res_s2 = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=_admin())
    assert res_s2.status_code == 200
    s2 = res_s2.json()
    assert s2["regeneration_feedback"] == fb_text
    assert fb_text in s2["narration_text"], "Feedback must be woven into narration text"
    assert s2["script_status"] == "SCRIPT_REVIEW"


def test_student_access_isolation_for_unapproved_and_unpublished_videos(client, db_session):
    """Stage 7: Only published videos are accessible to students. Rendered or approved videos remain blocked."""
    subject, chapter, topic = _make_curriculum(db_session, "StudentGate")

    # Set up student assigned to this subject
    from app.core.security import hash_pw
    student_user = User(
        username="studio_student",
        email="studio_student@example.com",
        password_hash=hash_pw("StudentPass123!"),
        role=Role.STUDENT,
        is_active=True
    )
    db_session.add(student_user)
    db_session.flush()
    student_prof = Student(
        user_id=student_user.id,
        student_id="STUDIO-S01",
        name="Studio Student",
        email="studio_student@example.com"
    )
    db_session.add(student_prof)
    db_session.flush()
    enrollment = StudentSubject(student_id=student_prof.id, subject_id=subject.id)
    db_session.add(enrollment)

    # Rendered video in REVIEW status (unapproved, unpublished)
    video = Video(
        topic_id=topic.id,
        title="Student Isolation Video",
        status="REVIEW",
        render_status="RENDERED",
        script_status="SCRIPT_APPROVED",
        actual_duration_seconds=300.0,
        scenes_data=[{"type": "CONCEPT", "title": "Intro", "duration_seconds": 300.0}],
        video_storage_key="videos/5555/video_5555.mp4",
        duration_seconds=300,
    )
    db_session.add(video)
    db_session.commit()

    student_headers = make_auth_header(student_user.id, "student")

    # 1. Unapproved video must NOT be in topic listing for student
    res_list = client.get(f"/learn/topics/{topic.id}/videos", headers=student_headers)
    assert res_list.status_code == 200
    assert video.id not in [v["id"] for v in res_list.json()]

    # 2. Unapproved video detail must 404 for student
    res_detail = client.get(f"/learn/videos/{video.id}", headers=student_headers)
    assert res_detail.status_code == 404

    # 3. Admin approves video (status -> APPROVED, but NOT yet published)
    appr_res = client.post(f"/admin/videos/{video.id}/approve", headers=_admin())
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "APPROVED"

    # 4. Approved but UNPUBLISHED video must still NOT be returned to student
    res_list_appr = client.get(f"/learn/topics/{topic.id}/videos", headers=student_headers)
    assert res_list_appr.status_code == 200
    assert video.id not in [v["id"] for v in res_list_appr.json()]

    res_detail_appr = client.get(f"/learn/videos/{video.id}", headers=student_headers)
    assert res_detail_appr.status_code == 404

    # 5. Admin explicitly publishes video
    pub_res = client.post(f"/admin/videos/{video.id}/publish", headers=_admin())
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    # 6. Now student can access it
    res_list_pub = client.get(f"/learn/topics/{topic.id}/videos", headers=student_headers)
    assert res_list_pub.status_code == 200
    assert video.id in [v["id"] for v in res_list_pub.json()]

    res_detail_pub = client.get(f"/learn/videos/{video.id}", headers=student_headers)
    assert res_detail_pub.status_code == 200
    assert res_detail_pub.json()["title"] == "Student Isolation Video"


def test_admin_video_preview_url_and_metadata(client, db_session):
    """Stage 6: Verify admin video review endpoint exposes MP4 url, thumbnail, scenes, captions and textbook title."""
    subject, chapter, topic = _make_curriculum(db_session, "PreviewMeta")
    from app.models.models import Textbook, PipelineStatus
    tb = Textbook(title="Physics Vol 1", subject_id=subject.id, status=PipelineStatus.approved,
                  source_type="TEXTBOOK", stage=7, stages_log=[])
    db_session.add(tb)
    db_session.flush()
    chapter.textbook_id = tb.id

    video = Video(
        topic_id=topic.id,
        textbook_id=tb.id,
        title="Kinematics Preview",
        status="REVIEW",
        render_status="RENDERED",
        script_status="SCRIPT_APPROVED",
        actual_duration_seconds=312.5,
        video_storage_key="videos/preview/video_preview.mp4",
        thumbnail_storage_key="videos/preview/thumb.jpg",
        duration_seconds=300,
        scenes_data=[
            {"type": "CONCEPT", "title": "Intro", "duration_seconds": 60.0},
            {"type": "WORKED_EXAMPLE", "title": "Velocity Problem", "duration_seconds": 252.5}
        ]
    )
    db_session.add(video)
    db_session.commit()

    res = client.get(f"/admin/videos/{video.id}", headers=_admin())
    assert res.status_code == 200, res.text
    v = res.json()
    assert v["title"] == "Kinematics Preview"
    assert v["render_status"] == "RENDERED"
    assert v["actual_duration_seconds"] == 312.5
    assert len(v["scenes"]) == 2
    assert v["textbook_title"] == "Physics Vol 1"
    assert v["chapter_title"] == chapter.title
    assert v["topic_title"] == topic.title
    # Media URLs must resolve to API asset path, not frontend Vite port
    assert v["video_url"].startswith("/assets/") or v["video_url"].startswith("http")
    assert "/assets/videos/preview/video_preview.mp4" in v["video_url"]


def test_complete_video_studio_e2e_stages_1_to_7(client, db_session):
    """End-to-End: Full Stage 1 to Stage 7 workflow with real video rendering and access gates."""
    # Stage 1: Upload individual chapter PDF
    ch_title = "Chapter 2: Energy and Work"
    res_up = client.post(
        "/admin/textbooks",
        headers=_admin(),
        files={"file": ("chapter2_energy.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
        data={"title": ch_title, "source_type": "CHAPTER", "chapter_number": "2"},
    )
    assert res_up.status_code == 201
    tb_id = res_up.json()["id"]

    # Trigger processing
    proc = client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=_admin())
    assert proc.status_code in (200, 202)

    # Stage 2: Verify hierarchy and approve curriculum
    hier = client.get(f"/admin/textbooks/{tb_id}/hierarchy", headers=_admin())
    assert hier.status_code == 200
    chapters = hier.json()["chapters"]
    assert len(chapters) == 1
    chapter_id = chapters[0]["id"]
    topic_id = chapters[0]["topics"][0]["id"]

    res_appr_curric = client.post(f"/admin/textbooks/{tb_id}/approve", headers=_admin())
    assert res_appr_curric.status_code == 200

    # Stage 3: Dynamic video planning
    res_plan = client.post(f"/admin/chapters/{chapter_id}/video-plans/generate", headers=_admin())
    assert res_plan.status_code == 200
    plans = res_plan.json()
    assert len(plans) >= 1
    plan_id = plans[0]["id"]

    # Approve plan
    res_appr_plan = client.post(
        f"/admin/video-plans/{plan_id}/approve",
        headers=_admin()
    )
    assert res_appr_plan.status_code == 200

    # Stage 4: Grounded script generation and approval
    res_script = client.post(f"/admin/video-plans/{plan_id}/script/generate", headers=_admin())
    assert res_script.status_code == 200
    assert len(res_script.json()["sections"]) >= 1

    res_appr_script = client.post(f"/admin/scripts/{plan_id}/approve", headers=_admin())
    assert res_appr_script.status_code == 200

    # Stage 5: Real video rendering
    res_render = client.post(f"/admin/video-plans/{plan_id}/video/generate", headers=_admin())
    assert res_render.status_code == 200, res_render.text
    render_data = res_render.json()
    assert render_data["render_status"] == "RENDERED"
    assert (render_data["actual_duration_seconds"] or 0) > 0

    # Stage 6: Admin video review
    res_review = client.get(f"/admin/videos/{plan_id}", headers=_admin())
    assert res_review.status_code == 200
    rev_data = res_review.json()
    assert rev_data["video_url"]
    assert rev_data["textbook_title"] == ch_title
    assert rev_data["status"] == "REVIEW"

    # Blocked from publishing before explicit approval
    blocked_pub = client.post(f"/admin/videos/{plan_id}/publish", headers=_admin())
    assert blocked_pub.status_code == 400

    # Explicit admin review approval
    appr_vid = client.post(f"/admin/videos/{plan_id}/approve", headers=_admin())
    assert appr_vid.status_code == 200
    assert appr_vid.json()["status"] == "APPROVED"

    # Stage 7: Publishing
    pub_vid = client.post(f"/admin/videos/{plan_id}/publish", headers=_admin())
    assert pub_vid.status_code == 200
    assert pub_vid.json()["status"] == "PUBLISHED"
