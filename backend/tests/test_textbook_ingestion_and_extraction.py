import pytest
import io
from app.models.models import (
    User, Subject, Textbook, Chapter, Topic, Subtopic,
    ProcessingJob, ChapterExtract, TopicExtract, SubtopicExtract, StudentSubject
)
from tests.conftest import make_auth_header


@pytest.fixture
def auth_headers():
    return {
        "admin": make_auth_header(1, "admin"),
        "student": make_auth_header(2, "student"),  # Alice, assigned to Subject 1
        "student_unassigned": make_auth_header(3, "student"),  # Bob
        "teacher": make_auth_header(4, "teacher"),
        "parent": make_auth_header(5, "parent"),
    }


def make_mock_pdf_bytes():
    """Generates standard PDF byte content with valid magic header."""
    return b"%PDF-1.4\n1 0 obj\n<< /Title (Physics Textbook) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


# ==============================================================================
# TEST 1: Valid PDF upload succeeds
# ==============================================================================
def test_valid_pdf_upload_succeeds(client, auth_headers):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("physics_grade10.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"title": "Physics Grade 10", "description": "Introductory mechanics and waves"}

    res = client.post("/admin/textbooks", headers=admin_h, files=files, data=data)
    assert res.status_code in [200, 201]
    payload = res.json()
    assert payload["id"] > 0
    assert payload["title"] == "Physics Grade 10"
    assert payload["filename"] == "physics_grade10.pdf"


# ==============================================================================
# TEST 2: Subject mapping associates textbook with existing subject
# ==============================================================================
def test_subject_mapping_associates_with_existing_subject(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("engineering_math.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"title": "Engineering Mathematics", "subject_id": "1"}

    res = client.post("/admin/textbooks", headers=admin_h, files=files, data=data)
    assert res.status_code in [200, 201]
    tb_id = res.json()["id"]

    tb = db_session.get(Textbook, tb_id)
    assert tb is not None
    assert tb.subject_id == 1


# ==============================================================================
# TEST 3: Textbook created with status QUEUED or UPLOADED
# ==============================================================================
def test_textbook_created_with_status_queued_or_uploaded(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("chemistry_fundamentals.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"title": "Chemistry Fundamentals"}

    res = client.post("/admin/textbooks", headers=admin_h, files=files, data=data)
    assert res.status_code in [200, 201]
    tb_id = res.json()["id"]

    tb = db_session.get(Textbook, tb_id)
    status_str = tb.status.value if hasattr(tb.status, "value") else str(tb.status)
    assert status_str.lower() in ["uploaded", "queued"]


# ==============================================================================
# TEST 4: Non-PDF upload rejected with 400
# ==============================================================================
def test_non_pdf_upload_rejected_with_400(client, auth_headers):
    admin_h = auth_headers["admin"]

    # Not a PDF by extension and content-type
    files = {"file": ("notes.txt", io.BytesIO(b"Hello world notes"), "text/plain")}
    data = {"title": "Text Notes"}

    res = client.post("/admin/textbooks", headers=admin_h, files=files, data=data)
    assert res.status_code == 400
    assert "PDF" in res.json()["detail"]


# ==============================================================================
# TEST 5: Missing file rejected with 422
# ==============================================================================
def test_missing_file_rejected_with_422(client, auth_headers):
    admin_h = auth_headers["admin"]
    data = {"title": "Missing File Textbook"}

    res = client.post("/admin/textbooks", headers=admin_h, data=data)
    assert res.status_code == 422


# ==============================================================================
# TEST 6: Processing job created with status QUEUED or PROCESSING
# ==============================================================================
def test_processing_job_created_with_status_queued(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("biology_cell.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"title": "Cell Biology"}

    res = client.post("/admin/textbooks", headers=admin_h, files=files, data=data)
    assert res.status_code in [200, 201]
    tb_id = res.json()["id"]

    job = db_session.query(ProcessingJob).filter(ProcessingJob.textbook_id == tb_id).first()
    assert job is not None
    assert job.status in ["QUEUED", "PROCESSING"]
    assert job.job_type == "TEXTBOOK_INGESTION"


# ==============================================================================
# TESTS 7–14: Stages 1–7 Pipeline Execution & Traceability
# ==============================================================================
def test_pipeline_stages_1_to_7_execution(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("comprehensive_physics.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"title": "Comprehensive Physics", "subject_id": "1"}

    upload_res = client.post("/admin/textbooks", headers=admin_h, files=files, data=data)
    assert upload_res.status_code in [200, 201]
    tb_id = upload_res.json()["id"]

    # Run full 7-stage extraction pipeline synchronously
    proc_res = client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=admin_h)
    assert proc_res.status_code == 200

    # Refresh DB
    tb = db_session.get(Textbook, tb_id)
    assert tb is not None

    # Test 7: Stage 1 executes and passes validation
    stages_log = tb.stages_log or []
    stage_names = [s.get("name", "").upper() for s in stages_log]
    assert any("VALIDATION" in name for name in stage_names)

    # Test 8: Stage 2 extracts text from pages
    assert any("TEXT_EXTRACTION" in name or "EXTRACTION" in name for name in stage_names)

    # Test 9: Page boundaries preserved with page numbers
    # Check that chapters have valid positive page numbers
    chapters = db_session.query(Chapter).filter(Chapter.textbook_id == tb_id).all()
    assert len(chapters) > 0
    for ch in chapters:
        assert ch.source_start_page is not None
        assert ch.source_start_page >= 1
        assert ch.source_end_page is not None
        assert ch.source_end_page >= ch.source_start_page

    # Test 10: Stage 3 detects chapters with confidence scores
    for ch in chapters:
        assert ch.confidence_score is not None
        assert 0.0 <= ch.confidence_score <= 1.0

    # Test 11: Stage 4 detects topics within chapter page ranges
    all_topics = db_session.query(Topic).join(Chapter).filter(Chapter.textbook_id == tb_id).all()
    assert len(all_topics) > 0
    for top in all_topics:
        assert top.chapter_id is not None
        assert top.source_start_page is not None
        assert top.source_start_page >= top.chapter.source_start_page
        assert top.source_end_page <= (top.chapter.source_end_page + 1)
        assert top.confidence_score is not None

    # Test 12: Stage 5 detects subtopics within topic page ranges
    all_subtopics = db_session.query(Subtopic).join(Topic).join(Chapter).filter(Chapter.textbook_id == tb_id).all()
    assert len(all_subtopics) > 0
    for sub in all_subtopics:
        assert sub.topic_id is not None
        assert sub.source_start_page is not None

    # Test 13: Stage 6 normalizes hierarchy
    assert any("NORMALIZATION" in name for name in stage_names)

    # Test 14: Stage 7 sets status to READY_FOR_REVIEW / REVIEW
    status_str = tb.status.value if hasattr(tb.status, "value") else str(tb.status)
    assert status_str.upper() == "REVIEW"

    job = db_session.query(ProcessingJob).filter(ProcessingJob.textbook_id == tb_id).order_by(ProcessingJob.created_at.desc()).first()
    assert job.status in ["COMPLETED", "READY_FOR_REVIEW"]
    assert job.progress == 100.0


# ==============================================================================
# TEST 15: Extracted hierarchy queryable by Admin
# ==============================================================================
def test_extracted_hierarchy_queryable_by_admin(client, auth_headers):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("queryable_textbook.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    res_upload = client.post("/admin/textbooks", headers=admin_h, files=files, data={"title": "Queryable Textbook"})
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=admin_h)

    res_hier = client.get(f"/admin/textbooks/{tb_id}/hierarchy", headers=admin_h)
    assert res_hier.status_code == 200
    hier = res_hier.json()
    assert hier["textbook_id"] == tb_id
    assert len(hier["chapters"]) > 0
    first_ch = hier["chapters"][0]
    assert "topics" in first_ch
    assert "source_start_page" in first_ch
    assert "confidence_score" in first_ch


# ==============================================================================
# TEST 16 & 17: Admin can edit titles, adjust page boundaries, and reorder
# ==============================================================================
def test_admin_edit_chapter_topic_subtopic_and_boundaries(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("editable_textbook.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    res_upload = client.post("/admin/textbooks", headers=admin_h, files=files, data={"title": "Editable Textbook"})
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=admin_h)

    chapter = db_session.query(Chapter).filter(Chapter.textbook_id == tb_id).first()
    assert chapter is not None

    # Patch Chapter: title, number, source pages
    patch_ch_payload = {
        "title": "Updated Mechanics & Dynamics",
        "chapter_number": 10,
        "source_start_page": 12,
        "source_end_page": 35
    }
    res_ch = client.patch(f"/admin/chapters/{chapter.id}", headers=admin_h, json=patch_ch_payload)
    assert res_ch.status_code == 200
    updated_ch = res_ch.json()
    assert updated_ch["title"] == "Updated Mechanics & Dynamics"
    assert updated_ch["chapter_number"] == 10
    assert updated_ch["source_start_page"] == 12
    assert updated_ch["source_end_page"] == 35

    # Patch Topic
    topic = db_session.query(Topic).filter(Topic.chapter_id == chapter.id).first()
    assert topic is not None
    patch_top_payload = {
        "title": "Newtonian Motion Principles",
        "sequence_number": 5,
        "source_start_page": 14,
        "source_end_page": 20
    }
    res_top = client.patch(f"/admin/topics/{topic.id}", headers=admin_h, json=patch_top_payload)
    assert res_top.status_code == 200
    updated_top = res_top.json()
    assert updated_top["title"] == "Newtonian Motion Principles"
    assert updated_top["sequence_number"] == 5

    # Patch Subtopic
    subtopic = db_session.query(Subtopic).filter(Subtopic.topic_id == topic.id).first()
    assert subtopic is not None
    patch_sub_payload = {
        "title": "Micro Concept: Inertia and Mass",
        "sequence_number": 3
    }
    res_sub = client.patch(f"/admin/subtopics/{subtopic.id}", headers=admin_h, json=patch_sub_payload)
    assert res_sub.status_code == 200
    assert res_sub.json()["title"] == "Micro Concept: Inertia and Mass"


# ==============================================================================
# TEST 18 & 19: Admin approval transitions status to APPROVED & makes visible
# ==============================================================================
def test_admin_approval_transitions_status_to_approved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("approvable_textbook.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    res_upload = client.post("/admin/textbooks", headers=admin_h, files=files, data={"title": "Approvable Textbook", "subject_id": "1"})
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=admin_h)

    # Approve
    res_app = client.post(f"/admin/textbooks/{tb_id}/approve", headers=admin_h)
    assert res_app.status_code == 200
    assert res_app.json()["status"].lower() == "approved"

    # Verify textbook status
    tb = db_session.get(Textbook, tb_id)
    status_str = tb.status.value if hasattr(tb.status, "value") else str(tb.status)
    assert status_str.upper() in ["APPROVED", "PUBLISHED"]

    # Verify chapter status in DB
    chapters = db_session.query(Chapter).filter(Chapter.textbook_id == tb_id).all()
    for ch in chapters:
        assert ch.status == "APPROVED"
        for t in ch.topics:
            assert t.status == "APPROVED"


# ==============================================================================
# TEST 20: Safe Regeneration creates draft without overwriting approved canonical tables
# ==============================================================================
def test_re_extraction_safe_regeneration_without_overwriting_approved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    pdf_bytes = make_mock_pdf_bytes()

    files = {"file": ("regenerate_safe.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    res_upload = client.post("/admin/textbooks", headers=admin_h, files=files, data={"title": "Regenerate Safe Textbook", "subject_id": "1"})
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=admin_h)
    client.post(f"/admin/textbooks/{tb_id}/approve", headers=admin_h)

    # Customize canonical chapter title to verify it is NOT overwritten
    canonical_ch = db_session.query(Chapter).filter(Chapter.textbook_id == tb_id).first()
    canonical_ch.title = "Canonical Customized Chapter Title Do Not Overwrite"
    db_session.commit()

    # Trigger safe re-extraction
    res_regen = client.post(f"/admin/textbooks/{tb_id}/regenerate", headers=admin_h, json={"target": "all"})
    assert res_regen.status_code == 200
    regen_data = res_regen.json()
    assert "comparison" in regen_data
    assert regen_data["comparison"]["canonical_chapters_count"] > 0
    assert regen_data["comparison"]["extracted_chapters_count"] > 0

    # Ensure canonical chapter in DB still has customized title!
    db_session.expire_all()
    reloaded_ch = db_session.get(Chapter, canonical_ch.id)
    assert reloaded_ch.title == "Canonical Customized Chapter Title Do Not Overwrite"

    # Ensure draft extracts are present in ChapterExtract staging table
    draft_extracts = db_session.query(ChapterExtract).filter(ChapterExtract.textbook_id == tb_id).all()
    assert len(draft_extracts) > 0


# ==============================================================================
# TEST 21: Non-admin users cannot upload or approve (403 Forbidden)
# ==============================================================================
def test_non_admin_users_cannot_upload_or_approve(client, auth_headers):
    student_h = auth_headers["student"]
    teacher_h = auth_headers["teacher"]
    parent_h = auth_headers["parent"]

    pdf_bytes = make_mock_pdf_bytes()
    files = {"file": ("unauthorized.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"title": "Unauthorized"}

    for headers in [student_h, teacher_h, parent_h]:
        res_upload = client.post("/admin/textbooks", headers=headers, files=files, data=data)
        assert res_upload.status_code == 403

        res_approve = client.post("/admin/textbooks/1/approve", headers=headers)
        assert res_approve.status_code == 403


# ==============================================================================
# TEST 22: Unapproved curriculum NOT visible to students
# ==============================================================================
def test_unapproved_curriculum_not_visible_to_students(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    student_h = auth_headers["student"]  # Alice is assigned to Subject 1

    # Create textbook for Subject 1, process it into REVIEW status (unapproved)
    pdf_bytes = make_mock_pdf_bytes()
    files = {"file": ("unapproved_curriculum.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    res_upload = client.post("/admin/textbooks", headers=admin_h, files=files, data={"title": "Draft Textbook", "subject_id": "1"})
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/process?sync=true", headers=admin_h)

    # Chapters currently have status='REVIEW'
    # Student requests curriculum for Subject 1:
    res_student_before = client.get("/learn/subjects/1/curriculum", headers=student_h)
    assert res_student_before.status_code == 200
    student_chapters = res_student_before.json()
    # Unapproved draft chapters for this textbook must NOT appear
    tb_chapter_ids = [c.id for c in db_session.query(Chapter).filter(Chapter.textbook_id == tb_id).all()]
    for sc in student_chapters:
        assert sc["id"] not in tb_chapter_ids

    # Now Admin approves the curriculum
    res_app = client.post(f"/admin/textbooks/{tb_id}/approve", headers=admin_h)
    assert res_app.status_code == 200

    # Student requests curriculum again: Now approved chapters are visible!
    res_student_after = client.get("/learn/subjects/1/curriculum", headers=student_h)
    assert res_student_after.status_code == 200
    approved_student_ch_ids = [sc["id"] for sc in res_student_after.json()]
    assert any(ch_id in approved_student_ch_ids for ch_id in tb_chapter_ids)
