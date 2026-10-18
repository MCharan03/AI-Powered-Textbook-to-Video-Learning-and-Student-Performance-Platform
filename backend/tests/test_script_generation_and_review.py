import pytest
import math
from app.models.models import (
    User, Subject, Chapter, Topic, Subtopic, Video,
    VideoScriptVersion, ProcessingJob, StudentSubject, JobStatus
)
from tests.conftest import make_auth_header
from app.services.script_generation import (
    ScriptService,
    DeterministicScriptGenerationEngine,
    LLMScriptGenerationEngine,
    ScriptQualityValidator,
    AIProviderUnavailableError
)
from app.core.config import settings


@pytest.fixture
def auth_headers():
    return {
        "admin": make_auth_header(1, "admin"),
        "student": make_auth_header(2, "student"),  # Alice
        "student_unassigned": make_auth_header(3, "student"),
        "teacher": make_auth_header(4, "teacher"),
        "parent": make_auth_header(5, "parent"),
    }


def create_approved_video_plan(
    db,
    title="Binary Search Trees",
    status="APPROVED",
    duration=330,
    outline=None,
    objective="Understand binary search tree invariants and search operations.",
    formulas=None
):
    """Helper to create a full approved curriculum hierarchy with an approved video plan."""
    subject = Subject(name=f"Subj-{title}", created_by=1)
    db.add(subject)
    db.flush()

    # Link student 1 (Alice) to subject
    link = StudentSubject(student_id=1, subject_id=subject.id)
    db.add(link)

    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=1,
        title=f"Chapter {title}",
        status="APPROVED",
        source_start_page=50,
        source_end_page=70
    )
    db.add(chapter)
    db.flush()

    formula_text = f"Governing equation: {formulas}" if formulas else ""
    topic_desc = (
        f"In-depth analysis of {title}. {formula_text} "
        f"Standard textbook narrative detailing algorithmic structures, node pointers, key comparisons, and edge conditions. " * 25
    )

    topic = Topic(
        chapter_id=chapter.id,
        sequence_number=1,
        title=title,
        description=topic_desc,
        status="APPROVED",
        source_start_page=50,
        source_end_page=60
    )
    db.add(topic)
    db.flush()

    subtopic = Subtopic(
        topic_id=topic.id,
        sequence_number=1,
        title=f"{title} Fundamentals",
        description=f"Detailed theoretical breakdown and worked examples for {title}. " * 20,
        source_start_page=50,
        source_end_page=55
    )
    db.add(subtopic)
    db.flush()

    video = Video(
        topic_id=topic.id,
        subtopic_id=subtopic.id,
        title=f"Mastering {title}",
        description=f"Comprehensive educational lesson on {title}.",
        sequence_number=1,
        duration_seconds=duration,
        estimated_duration_seconds=duration,
        source_start_page=50,
        source_end_page=55,
        learning_objective=objective,
        content_outline=outline or [
            f"Introduction to {title}",
            "Structural Invariants & Properties",
            "Worked Problem and Complexity Analysis"
        ],
        status=status
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return subject, chapter, topic, video


# ==============================================================================
# TEST 1: Approved video plan can generate script
# ==============================================================================
def test_01_approved_video_plan_can_generate_script(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Dynamic Arrays")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["video_id"] == video.id
    assert data["script_status"] in ["SCRIPT_REVIEW", "NEEDS_REVIEW"]
    assert len(data["sections"]) >= 4
    assert data["word_count"] > 200
    assert data["quality_score"] > 60.0


# ==============================================================================
# TEST 2: Unapproved video plan cannot generate script
# ==============================================================================
def test_02_unapproved_video_plan_cannot_generate_script(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, draft_video = create_approved_video_plan(db_session, "Draft Video Plan", status="REVIEW")

    res = client.post(f"/admin/video-plans/{draft_video.id}/script/generate", headers=admin_h)
    assert res.status_code == 400
    assert "unapproved video plan" in res.text.lower()


# ==============================================================================
# TEST 3, 4, 5, 6: RBAC Script Generation Boundaries
# ==============================================================================
def test_03_to_06_rbac_boundaries(client, auth_headers, db_session):
    _, _, _, video = create_approved_video_plan(db_session, "RBAC Script Plan")

    # Student forbidden (403)
    res_s = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=auth_headers["student"])
    assert res_s.status_code == 403

    # Teacher forbidden (403)
    res_t = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=auth_headers["teacher"])
    assert res_t.status_code == 403

    # Parent forbidden (403)
    res_p = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=auth_headers["parent"])
    assert res_p.status_code == 403

    # Admin succeeds (200)
    res_a = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=auth_headers["admin"])
    assert res_a.status_code == 200


# ==============================================================================
# TEST 7: Source pages are retrieved and tracked
# ==============================================================================
def test_07_source_pages_are_retrieved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Traceable Pages")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert data["source_page_start"] == 50
    assert data["source_page_end"] == 55
    # Sections have source page references
    for s in data["sections"]:
        assert len(s["source_pages"]) > 0


# ==============================================================================
# TEST 8: Missing source content fails safely
# ==============================================================================
def test_08_missing_source_content_fails_safely(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subject = Subject(name="Empty Subject", created_by=1)
    db_session.add(subject)
    db_session.flush()

    chapter = Chapter(subject_id=subject.id, chapter_number=1, title="Empty Chapter", status="APPROVED")
    db_session.add(chapter)
    db_session.flush()

    # Topic with zero description
    topic = Topic(chapter_id=chapter.id, sequence_number=1, title="Empty Topic", description="", status="APPROVED")
    db_session.add(topic)
    db_session.flush()

    video = Video(
        topic_id=topic.id,
        title="Empty Content Video",
        status="APPROVED",
        source_start_page=990,
        source_end_page=995
    )
    db_session.add(video)
    db_session.commit()

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code in [400, 500]
    assert "source textbook content could not be retrieved" in res.text.lower()


# ==============================================================================
# TEST 9: Target word count is calculated correctly
# ==============================================================================
def test_09_target_word_count_calculated_correctly(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # 300 seconds at 140 WPM should be exactly 700 words
    _, _, _, video = create_approved_video_plan(db_session, "Word Count 300s", duration=300)

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert data["target_words"] == 700


# ==============================================================================
# TEST 10: Short video plan produces concise script
# ==============================================================================
def test_10_short_video_plan_produces_concise_script(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # 86 seconds at 140 WPM = ~201 words
    _, _, _, video = create_approved_video_plan(db_session, "Short 86s Plan", duration=86)

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert data["target_words"] == 201
    # Actual word count should be calibrated to section requirements
    assert data["word_count"] <= 750


# ==============================================================================
# TEST 11: Normal 5–6 minute plan produces approximately correct script length
# ==============================================================================
def test_11_normal_5_to_6_min_plan_produces_correct_script_length(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # 330 seconds = 770 target words
    _, _, _, video = create_approved_video_plan(db_session, "Standard 330s Plan", duration=330)

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert data["target_words"] == 770
    assert 550 <= data["word_count"] <= 950


# ==============================================================================
# TEST 12: Script sections are created
# ==============================================================================
def test_12_script_sections_are_created(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Sectioned Plan")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    sec_types = [s["type"] for s in data["sections"]]
    assert "INTRO" in sec_types
    assert "CONCEPT" in sec_types
    assert any("SUMMARY" in st for st in sec_types)


# ==============================================================================
# TEST 13: Learning objective is represented
# ==============================================================================
def test_13_learning_objective_is_represented(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    custom_obj = "Master asymptotic time complexity and derive recurrence relations."
    _, _, _, video = create_approved_video_plan(db_session, "Recurrences", objective=custom_obj)

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    full_narration = " ".join(s["narration"] for s in data["sections"])
    assert "recurrence" in full_narration.lower() or "asymptotic" in full_narration.lower()
    assert data["quality_breakdown"]["objective_coverage"] >= 50.0


# ==============================================================================
# TEST 14: Content outline concepts are covered
# ==============================================================================
def test_14_content_outline_concepts_are_covered(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    outline = ["Divide and Conquer Paradigm", "Merge Sort Execution", "Space Complexity Analysis"]
    _, _, _, video = create_approved_video_plan(db_session, "Merge Sort", outline=outline)

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    full_narration = " ".join(s["narration"] for s in data["sections"]).lower()
    assert "divide" in full_narration or "merge" in full_narration
    assert data["quality_breakdown"]["outline_coverage"] >= 60.0


# ==============================================================================
# TEST 15: Source traceability is preserved
# ==============================================================================
def test_15_source_traceability_preserved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Traceable Script")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    for s in data["sections"]:
        assert isinstance(s["source_pages"], list)
        assert len(s["source_pages"]) >= 1


# ==============================================================================
# TEST 16: Visual cues are generated
# ==============================================================================
def test_16_visual_cues_are_generated(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Visual Cue Script")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    for s in data["sections"]:
        assert s["visual_type"] is not None
        assert s["visual_description"] is not None
        assert s["animation_hint"] is not None


# ==============================================================================
# TEST 17: Mathematical content is preserved
# ==============================================================================
def test_17_mathematical_content_is_preserved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Ohm Law", formulas="V = IR")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    formula_sections = [s for s in data["sections"] if s.get("formula")]
    assert len(formula_sections) >= 1
    assert "V = IR" in formula_sections[0]["formula"]


# ==============================================================================
# TEST 18: Placeholder output is rejected or penalized
# ==============================================================================
def test_18_placeholder_output_flagged(client, auth_headers, db_session):
    # Test validator directly
    _, _, _, video = create_approved_video_plan(db_session, "Placeholder Check")
    bad_sections = [
        {"section_id": 1, "type": "INTRO", "narration": "[INSERT SCRIPT HERE] Lorem ipsum dolor sit amet."},
        {"section_id": 2, "type": "CONCEPT", "narration": "TBD content as an AI language model."}
    ]
    score, breakdown, warnings = ScriptQualityValidator.evaluate(video, bad_sections, [], 500)
    assert any("placeholder" in w.lower() or "prohibited" in w.lower() for w in warnings)


# ==============================================================================
# TEST 19: Script quality score is calculated
# ==============================================================================
def test_19_script_quality_score_is_calculated(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Quality Evaluation")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    data = res.json()
    assert 0.0 <= data["quality_score"] <= 100.0
    bd = data["quality_breakdown"]
    assert "objective_coverage" in bd
    assert "outline_coverage" in bd
    assert "duration_alignment" in bd
    assert "source_grounding" in bd
    assert "structural_completeness" in bd


# ==============================================================================
# TEST 20 & 21: ProcessingJob lifecycle works
# ==============================================================================
def test_20_and_21_processing_job_lifecycle(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Job Verification")

    res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res.status_code == 200

    job = db_session.query(ProcessingJob).filter(
        ProcessingJob.video_id == video.id,
        ProcessingJob.job_type == "SCRIPT_GENERATION"
    ).order_by(ProcessingJob.id.desc()).first()

    assert job is not None
    assert job.status == "COMPLETED"
    assert job.progress == 100.0
    assert job.current_stage == "COMPLETED"
    assert job.completed_at is not None


# ==============================================================================
# TEST 22: Admin can edit script
# ==============================================================================
def test_22_admin_can_edit_script(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Editable Script")

    client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)

    patch_payload = {
        "title": "Custom Edited Script Title",
        "quality_score": 98.5
    }
    patch_res = client.patch(f"/admin/scripts/{video.id}", headers=admin_h, json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == "Custom Edited Script Title"
    assert updated["quality_score"] == 98.5


# ==============================================================================
# TEST 23: Admin can approve script
# ==============================================================================
def test_23_admin_can_approve_script(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Approve Script Video")

    client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)

    app_res = client.post(f"/admin/scripts/{video.id}/approve", headers=admin_h)
    assert app_res.status_code == 200
    assert app_res.json()["script_status"] == "SCRIPT_APPROVED"

    # Video status should now be READY_FOR_VIDEO_GENERATION
    db_session.refresh(video)
    assert video.status == "READY_FOR_VIDEO_GENERATION"


# ==============================================================================
# TEST 24: Student cannot see draft script
# ==============================================================================
def test_24_student_cannot_see_draft_script(client, auth_headers, db_session):
    student_h = auth_headers["student"]
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Student Privacy Script")

    client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)

    # Student cannot call admin scripts endpoint
    res_scripts = client.get(f"/admin/scripts/{video.id}", headers=student_h)
    assert res_scripts.status_code == 403

    # Student querying learning endpoint does not receive internal script text
    learn_res = client.get(f"/learn/videos/{video.id}", headers=student_h)
    assert learn_res.status_code == 200
    data = learn_res.json()
    assert data["script_text"] == ""


# ==============================================================================
# TEST 25: Safe regeneration does not silently overwrite
# ==============================================================================
def test_25_safe_regeneration_does_not_silently_overwrite(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Safe Regen Script")

    gen_res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    first_title = gen_res.json()["title"]

    # Preview regeneration
    preview_res = client.post(f"/admin/scripts/{video.id}/regenerate", headers=admin_h)
    assert preview_res.status_code == 200
    preview = preview_res.json()
    assert preview["has_existing_script"] is True
    assert "current_script" in preview
    assert "new_script" in preview
    assert "comparison" in preview

    # Active script was NOT overwritten
    db_session.refresh(video)
    assert video.script_data["title"] == first_title


# ==============================================================================
# TEST 26, 27, 28: Script engine abstraction, deterministic & LLM fallback
# ==============================================================================
def test_26_to_28_script_engine_abstraction_and_fallback(db_session):
    _, _, _, video = create_approved_video_plan(db_session, "Engine Test")
    mock_pages = [{"page_number": 50, "text": "Physics concepts regarding energy and motion."}]

    # Deterministic engine works offline
    det = DeterministicScriptGenerationEngine(words_per_minute=140)
    res = det.generate_script(video, mock_pages, 300)
    assert len(res["sections"]) >= 4

    # LLM engine without keys raises AIProviderUnavailableError
    llm = LLMScriptGenerationEngine()
    with pytest.raises(AIProviderUnavailableError):
        llm.generate_script(video, mock_pages, 300)


# ==============================================================================
# TEST 29: Repeated generation does not duplicate or corrupt existing scripts
# ==============================================================================
def test_29_repeated_generation_is_idempotent(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Idempotent Script Plan")

    res1 = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res1.status_code == 200
    count1 = db_session.query(VideoScriptVersion).filter(VideoScriptVersion.video_id == video.id).count()

    # Call again without force
    res2 = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res2.status_code == 200
    count2 = db_session.query(VideoScriptVersion).filter(VideoScriptVersion.video_id == video.id).count()

    # Version count remains 1 (idempotent)
    assert count1 == count2 == 1


# ==============================================================================
# TEST 30: Script versioning tracks successive generations
# ==============================================================================
def test_30_script_versioning(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_video_plan(db_session, "Versioned Script Plan")

    # Initial generation (v1)
    res1 = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_h)
    assert res1.json()["version_number"] == 1

    # Force regeneration (v2)
    res2 = client.post(f"/admin/scripts/{video.id}/regenerate?force=true", headers=admin_h)
    assert res2.status_code == 200
    assert res2.json()["version_number"] == 2

    # Database records both versions
    versions = db_session.query(VideoScriptVersion).filter(
        VideoScriptVersion.video_id == video.id
    ).order_by(VideoScriptVersion.version_number.asc()).all()

    assert len(versions) == 2
    assert versions[0].version_number == 1
    assert versions[1].version_number == 2
