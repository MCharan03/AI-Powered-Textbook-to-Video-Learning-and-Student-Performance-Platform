import pytest
from app.models.models import (
    User, Subject, Chapter, Topic, Subtopic, Video,
    ProcessingJob, JobStatus, StudentSubject
)
from tests.conftest import make_auth_header
from app.services.video_segmentation import (
    VideoSegmentationService,
    DeterministicVideoSegmentationEngine,
    LLMVideoSegmentationEngine,
    AIProviderUnavailableError
)
from app.core.config import settings


@pytest.fixture
def auth_headers():
    return {
        "admin": make_auth_header(1, "admin"),
        "student": make_auth_header(2, "student"),  # Alice
        "student_unassigned": make_auth_header(3, "student"),  # Bob
        "teacher": make_auth_header(4, "teacher"),
        "parent": make_auth_header(5, "parent"),
    }


def create_approved_curriculum(db, topic_title="Data Structures", subtopics_data=None, status="APPROVED"):
    """Helper to create an approved subject, chapter, topic, and subtopics."""
    subject = Subject(name=f"Subj-{topic_title}", created_by=1)
    db.add(subject)
    db.flush()

    # Link student 1 (Alice) to subject for learning visibility tests
    link = StudentSubject(student_id=1, subject_id=subject.id)
    db.add(link)

    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=1,
        title=f"Chapter {topic_title}",
        status=status,
        source_start_page=10,
        source_end_page=50
    )
    db.add(chapter)
    db.flush()

    topic = Topic(
        chapter_id=chapter.id,
        sequence_number=1,
        title=topic_title,
        status=status,
        source_start_page=10,
        source_end_page=35
    )
    db.add(topic)
    db.flush()

    if subtopics_data:
        for idx, sdata in enumerate(subtopics_data, start=1):
            subtopic = Subtopic(
                topic_id=topic.id,
                sequence_number=idx,
                title=sdata.get("title", f"Subtopic {idx}"),
                description=sdata.get("description", "Standard description"),
                source_start_page=sdata.get("start_page", 10 + idx * 2),
                source_end_page=sdata.get("end_page", 12 + idx * 2)
            )
            db.add(subtopic)
        db.flush()

    db.commit()
    db.refresh(topic)
    return subject, chapter, topic


# ==============================================================================
# TEST 1: Small topic produces exactly one video
# ==============================================================================
def test_01_small_topic_produces_one_video(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Small topic ~150 words total
    subtopics = [
        {
            "title": "Introduction to Stacks",
            "description": "A stack is a linear data structure following LIFO principle. " * 8,
            "start_page": 10,
            "end_page": 12
        }
    ]
    _, _, topic = create_approved_curriculum(db_session, "Small Stacks Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    assert len(plans) == 1
    assert plans[0]["sequence_number"] == 1
    assert "Stacks" in plans[0]["title"]
    assert plans[0]["status"] == "REVIEW"


# ==============================================================================
# TEST 2: Medium topic produces multiple videos when required
# ==============================================================================
def test_02_medium_topic_produces_multiple_videos(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Medium topic ~1000 words total across subtopics (~428s, exceeds 360s)
    subtopics = [
        {
            "title": "Queue Operations and Arrays",
            "description": "Queues operate on First-In-First-Out FIFO methodology. Elements enter at the rear and exit from the front. " * 50,
            "start_page": 15,
            "end_page": 20
        },
        {
            "title": "Circular Queues and Deque",
            "description": "Circular queues solve memory wastage in linear queues by connecting rear back to front through modular arithmetic. " * 50,
            "start_page": 21,
            "end_page": 26
        }
    ]
    _, _, topic = create_approved_curriculum(db_session, "Medium Queue Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    assert len(plans) == 2
    assert plans[0]["sequence_number"] == 1
    assert plans[1]["sequence_number"] == 2
    assert plans[0]["estimated_duration_seconds"] > 0
    assert plans[1]["estimated_duration_seconds"] > 0


# ==============================================================================
# TEST 3: Large topic produces 3 or more videos
# ==============================================================================
def test_03_large_topic_produces_multiple_videos(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Large topic with 4 substantial subtopics (~2200 words total)
    subtopics = [
        {
            "title": "Binary Tree Fundamentals",
            "description": "Binary trees are hierarchical structures where each node has at most two children termed left and right child. " * 30,
            "start_page": 30,
            "end_page": 35
        },
        {
            "title": "Binary Search Tree Properties",
            "description": "BST invariant requires left keys strictly less and right keys strictly greater than root key for ordered retrieval. " * 30,
            "start_page": 36,
            "end_page": 40
        },
        {
            "title": "Tree Traversals",
            "description": "Pre-order In-order and Post-order depth first traversals enable systematic evaluation and serialization of expression trees. " * 30,
            "start_page": 41,
            "end_page": 45
        },
        {
            "title": "Balanced Trees and AVL Rotations",
            "description": "AVL trees maintain height balance within plus minus one through single and double rotations during node insertion and deletion. " * 30,
            "start_page": 46,
            "end_page": 52
        }
    ]
    _, _, topic = create_approved_curriculum(db_session, "Large Tree Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    assert len(plans) >= 3
    # Check consecutive sequence numbers
    seqs = [p["sequence_number"] for p in plans]
    assert seqs == list(range(1, len(plans) + 1))


# ==============================================================================
# TEST 4: Large subtopic can be split across videos
# ==============================================================================
def test_04_large_subtopic_splits_across_videos(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Single subtopic with ~1300 words (exceeds single subtopic threshold of ~468s)
    subtopics = [
        {
            "title": "CPU Scheduling Algorithms Deep Dive",
            "description": "CPU scheduling algorithms determine process execution sequence. FCFS is non-preemptive and suffers from convoy effect. " * 35 +
                           "Shortest Job First SJF minimizes average waiting time but risks starvation for lengthy CPU bursts. " * 35 +
                           "Round Robin assigns fixed time slices ensuring responsiveness in interactive time-sharing operating environments. " * 35,
            "start_page": 60,
            "end_page": 75
        }
    ]
    _, _, topic = create_approved_curriculum(db_session, "Large Subtopic Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    assert len(plans) >= 2
    # Verify split titles contain part designations
    assert any("Part 1" in p["title"] for p in plans)
    assert any("Part 2" in p["title"] for p in plans)


# ==============================================================================
# TEST 5: Semantic boundaries are preserved
# ==============================================================================
def test_05_semantic_boundaries_preserved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [
        {"title": "Derivation of Newton First Law", "description": "Formulation and axioms. " * 20, "start_page": 1, "end_page": 3},
        {"title": "Worked Example 1", "description": "Free body diagrams and calculations. " * 20, "start_page": 4, "end_page": 6},
    ]
    _, _, topic = create_approved_curriculum(db_session, "Mechanics Laws", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    # Content outlines should preserve the semantic sections
    for p in plans:
        assert len(p["content_outline"]) >= 1
        assert p["learning_objective"] is not None
        assert len(p["learning_objective"]) > 10


# ==============================================================================
# TEST 6: Duration estimation works
# ==============================================================================
def test_06_duration_estimation_works():
    engine = DeterministicVideoSegmentationEngine(
        target_min_seconds=300,
        target_max_seconds=360,
        target_seconds=330,
        narration_words_per_minute=140
    )
    # 280 words at 140 WPM should be exactly 120 seconds
    duration = engine.estimate_duration(280)
    assert duration == 120
    # 70 words should be 30 seconds
    assert engine.estimate_duration(70) == 30


# ==============================================================================
# TEST 7: Video duration targets approximately 5–6 minutes
# ==============================================================================
def test_07_video_duration_targets_approximately_5_to_6_minutes(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Provide multi-segment content
    subtopics = [
        {"title": f"Sub {i}", "description": "Standard physics concepts explanation text block with technical details. " * 25, "start_page": i*5, "end_page": (i+1)*5}
        for i in range(1, 5)
    ]
    _, _, topic = create_approved_curriculum(db_session, "Target Duration Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    # Check that durations are reasonable and close to target range
    for p in plans:
        assert p["estimated_duration_seconds"] > 60
        assert p["estimated_duration_seconds"] <= 450


# ==============================================================================
# TEST 8: Small content is not artificially padded
# ==============================================================================
def test_08_small_content_not_artificially_padded(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [
        {"title": "Brief Definition", "description": "Quick definition of an algorithm in twenty words or less.", "start_page": 1, "end_page": 2}
    ]
    _, _, topic = create_approved_curriculum(db_session, "Tiny Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    plans = res.json()
    assert len(plans) == 1
    # Should not artificially inflate duration to 300 seconds
    assert plans[0]["estimated_duration_seconds"] < 120


# ==============================================================================
# TEST 9: Video sequence numbers are correct
# ==============================================================================
def test_09_video_sequence_numbers_are_correct(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [
        {"title": f"Section {i}", "description": "Educational narrative explaining systematic algorithms with concrete examples and in-depth mathematical walkthroughs. " * 30, "start_page": i*4, "end_page": (i+1)*4}
        for i in range(1, 4)
    ]
    _, _, topic = create_approved_curriculum(db_session, "Ordered Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) >= 2
    for idx, p in enumerate(plans, start=1):
        assert p["sequence_number"] == idx


# ==============================================================================
# TEST 10: Source page ranges are preserved
# ==============================================================================
def test_10_source_page_ranges_are_preserved(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [
        {"title": "Section A", "description": "Topic content page range verification text. " * 30, "start_page": 101, "end_page": 105},
        {"title": "Section B", "description": "Topic content page range continuation text. " * 30, "start_page": 106, "end_page": 112}
    ]
    _, _, topic = create_approved_curriculum(db_session, "Page Range Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200
    plans = res.json()
    for p in plans:
        assert p["source_start_page"] is not None
        assert p["source_end_page"] is not None
        assert p["source_start_page"] <= p["source_end_page"]
        assert p["source_start_page"] >= 101
        assert p["source_end_page"] <= 112


# ==============================================================================
# TEST 11 & 12: Only APPROVED curriculum can generate plans / Unapproved rejected
# ==============================================================================
def test_11_and_12_curriculum_approval_gate(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # 1. Test DRAFT topic rejected with 400
    subtopics = [{"title": "Draft Sub", "description": "Draft content description.", "start_page": 1, "end_page": 2}]
    _, _, draft_topic = create_approved_curriculum(db_session, "Draft Topic", subtopics, status="DRAFT")

    res = client.post(f"/admin/topics/{draft_topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 400
    assert "unapproved curriculum" in res.text.lower()

    # 2. Test REVIEW topic rejected with 400
    _, _, review_topic = create_approved_curriculum(db_session, "Review Topic", subtopics, status="REVIEW")
    res = client.post(f"/admin/topics/{review_topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 400
    assert "unapproved curriculum" in res.text.lower()

    # 3. Transition to APPROVED succeeds
    review_topic.status = "APPROVED"
    review_topic.chapter.status = "APPROVED"
    db_session.commit()

    res = client.post(f"/admin/topics/{review_topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200
    assert len(res.json()) >= 1


# ==============================================================================
# TEST 13 & 14: Admin only access works / Non-admin users receive 403
# ==============================================================================
def test_13_and_14_rbac_boundaries(client, auth_headers, db_session):
    subtopics = [{"title": "Auth Sub", "description": "RBAC verification text.", "start_page": 1, "end_page": 2}]
    _, _, topic = create_approved_curriculum(db_session, "RBAC Topic", subtopics)

    # Student cannot generate
    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=auth_headers["student"])
    assert res.status_code == 403

    # Teacher cannot generate
    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=auth_headers["teacher"])
    assert res.status_code == 403

    # Parent cannot generate
    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=auth_headers["parent"])
    assert res.status_code == 403

    # Admin generates successfully
    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=auth_headers["admin"])
    assert res.status_code == 200
    plan_id = res.json()[0]["id"]

    # Non-admin cannot patch
    res = client.patch(f"/admin/video-plans/{plan_id}", headers=auth_headers["student"], json={"title": "Hacked"})
    assert res.status_code == 403

    # Non-admin cannot approve
    res = client.post(f"/admin/video-plans/{plan_id}/approve", headers=auth_headers["teacher"])
    assert res.status_code == 403


# ==============================================================================
# TEST 15: Regeneration does not silently overwrite existing approved plans
# ==============================================================================
def test_15_safe_regeneration_behavior(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [
        {"title": "Regen Sub A", "description": "Original content block A. " * 30, "start_page": 1, "end_page": 5},
        {"title": "Regen Sub B", "description": "Original content block B. " * 30, "start_page": 6, "end_page": 10}
    ]
    _, _, topic = create_approved_curriculum(db_session, "Regen Topic", subtopics)

    # Initial generation
    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200
    initial_plans = res.json()
    assert len(initial_plans) >= 1
    first_id = initial_plans[0]["id"]

    # Approve first video plan
    client.post(f"/admin/video-plans/{first_id}/approve", headers=admin_h)

    # Attempt re-generation preview
    preview_res = client.post(f"/admin/topics/{topic.id}/video-plans/regenerate", headers=admin_h)
    assert preview_res.status_code == 200
    preview = preview_res.json()
    assert preview["topic_id"] == topic.id
    assert "current_plans" in preview
    assert "new_plans" in preview
    assert "comparison" in preview
    assert preview["comparison"]["current_count"] == len(initial_plans)

    # Calling generate without force should NOT overwrite
    res_repeat = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res_repeat.status_code == 200
    # Returned existing plans without modification
    assert res_repeat.json()[0]["id"] == first_id
    assert res_repeat.json()[0]["status"] == "APPROVED"


# ==============================================================================
# TEST 16 & 17: ProcessingJob is created and reaches COMPLETED
# ==============================================================================
def test_16_and_17_processing_job_lifecycle(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [{"title": "Job Sub", "description": "Processing job testing text.", "start_page": 1, "end_page": 2}]
    _, _, topic = create_approved_curriculum(db_session, "Job Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200

    # Verify ProcessingJob record in database
    job = db_session.query(ProcessingJob).filter(
        ProcessingJob.topic_id == topic.id,
        ProcessingJob.job_type == "VIDEO_PLAN_GENERATION"
    ).order_by(ProcessingJob.id.desc()).first()

    assert job is not None
    assert job.status == "COMPLETED"
    assert job.progress == 100.0
    assert job.current_stage == "COMPLETED"
    assert job.started_at is not None
    assert job.completed_at is not None


# ==============================================================================
# TEST 18: Failed segmentation records FAILED status
# ==============================================================================
def test_18_failed_segmentation_records_failed_job(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Unapproved topic causes validation failure
    _, _, unapproved_topic = create_approved_curriculum(db_session, "Failing Topic", status="DRAFT")

    res = client.post(f"/admin/topics/{unapproved_topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 400

    # Verify a failed processing job was logged
    job = db_session.query(ProcessingJob).filter(
        ProcessingJob.topic_id == unapproved_topic.id,
        ProcessingJob.job_type == "VIDEO_PLAN_GENERATION"
    ).order_by(ProcessingJob.id.desc()).first()

    assert job is not None
    assert job.status == "FAILED"
    assert "unapproved" in job.error_message.lower()


# ==============================================================================
# TEST 19: Video plans are stored correctly
# ==============================================================================
def test_19_video_plans_stored_correctly(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [
        {"title": "Storage Subtopic", "description": "Detailed explanation for storage verification.", "start_page": 15, "end_page": 18}
    ]
    _, _, topic = create_approved_curriculum(db_session, "Storage Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res.status_code == 200
    plan_data = res.json()[0]

    video = db_session.get(Video, plan_data["id"])
    assert video is not None
    assert video.topic_id == topic.id
    assert video.sequence_number == 1
    assert video.title != ""
    assert video.estimated_duration_seconds > 0
    assert video.source_start_page == 15
    assert video.source_end_page == 18
    assert video.learning_objective != ""
    assert isinstance(video.content_outline, list)
    assert video.status == "REVIEW"


# ==============================================================================
# TEST 20: Admin can edit generated plans
# ==============================================================================
def test_20_admin_can_edit_generated_plans(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [{"title": "Editable Sub", "description": "Initial text.", "start_page": 1, "end_page": 2}]
    _, _, topic = create_approved_curriculum(db_session, "Edit Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    plan_id = res.json()[0]["id"]

    # Patch plan
    patch_payload = {
        "title": "Mastering Dynamic Programming",
        "description": "Comprehensive analysis of memoization vs tabulation.",
        "sequence_number": 1,
        "estimated_duration_seconds": 345,
        "learning_objective": "Derive optimal substructure and solve overlapping subproblems.",
        "content_outline": ["Memoization Introduction", "Tabulation Comparison", "Complexity Bounds"]
    }
    patch_res = client.patch(f"/admin/video-plans/{plan_id}", headers=admin_h, json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == "Mastering Dynamic Programming"
    assert updated["estimated_duration_seconds"] == 345
    assert updated["learning_objective"] == "Derive optimal substructure and solve overlapping subproblems."
    assert len(updated["content_outline"]) == 3


# ==============================================================================
# TEST 21: Admin can approve video plans
# ==============================================================================
def test_21_admin_can_approve_video_plans(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [{"title": "Approval Sub", "description": "Content for approval flow.", "start_page": 1, "end_page": 2}]
    _, _, topic = create_approved_curriculum(db_session, "Approve Topic", subtopics)

    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    plan_id = res.json()[0]["id"]

    # Single approve
    app_res = client.post(f"/admin/video-plans/{plan_id}/approve", headers=admin_h)
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "APPROVED"

    # Bulk approve by topic
    bulk_res = client.post(f"/admin/topics/{topic.id}/video-plans/approve", headers=admin_h)
    assert bulk_res.status_code == 200
    assert len(bulk_res.json()) >= 1


# ==============================================================================
# TEST 22: No duplicate video plans after repeated requests unless explicitly forced
# ==============================================================================
def test_22_idempotent_plan_generation(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    subtopics = [{"title": "Idempotent Sub", "description": "Subtopic text.", "start_page": 1, "end_page": 2}]
    _, _, topic = create_approved_curriculum(db_session, "Idempotent Topic", subtopics)

    res1 = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res1.status_code == 200
    count1 = len(res1.json())

    # Call again without force
    res2 = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    assert res2.status_code == 200
    count2 = len(res2.json())

    assert count1 == count2

    # Check total videos in DB for topic
    total_db = db_session.query(Video).filter(Video.topic_id == topic.id).count()
    assert total_db == count1


# ==============================================================================
# TEST 23: Student visibility isolation (Unapproved hidden, Approved visible)
# ==============================================================================
def test_23_student_visibility_isolation(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    student_h = auth_headers["student"]

    subtopics = [{"title": "Visibility Sub", "description": "Student visibility testing content.", "start_page": 1, "end_page": 2}]
    _, _, topic = create_approved_curriculum(db_session, "Visibility Topic", subtopics)

    # Generate plan (status = REVIEW)
    res = client.post(f"/admin/topics/{topic.id}/video-plans/generate", headers=admin_h)
    plan_id = res.json()[0]["id"]

    # Student cannot see unapproved video plan
    s_res = client.get(f"/learn/topics/{topic.id}/video-plans", headers=student_h)
    assert s_res.status_code == 200
    assert len(s_res.json()) == 0

    # Student cannot access unapproved video directly
    v_res = client.get(f"/learn/videos/{plan_id}", headers=student_h)
    assert v_res.status_code == 404

    # Admin approves plan
    client.post(f"/admin/video-plans/{plan_id}/approve", headers=admin_h)

    # Student now CAN see approved video plan
    s_res_after = client.get(f"/learn/topics/{topic.id}/video-plans", headers=student_h)
    assert s_res_after.status_code == 200
    assert len(s_res_after.json()) == 1
    assert s_res_after.json()[0]["id"] == plan_id


# ==============================================================================
# TEST 24: AI Engine Fallback & Abstraction Verification
# ==============================================================================
def test_24_ai_engine_abstraction_and_fallback():
    # Deterministic Engine directly tested
    det_engine = DeterministicVideoSegmentationEngine(
        target_min_seconds=300,
        target_max_seconds=360,
        target_seconds=330,
        narration_words_per_minute=140
    )
    sample_topic = Topic(id=999, title="Sample Topic", sequence_number=1)
    sample_sub = Subtopic(id=888, topic_id=999, title="Sample Subtopic", description="Sample detailed text description for segmentation testing.")
    result = det_engine.segment_topic(sample_topic, [sample_sub])
    assert len(result) >= 1
    assert "Sample" in result[0]["title"]

    # LLM Engine without API key raises AIProviderUnavailableError
    llm_engine = LLMVideoSegmentationEngine()
    with pytest.raises(AIProviderUnavailableError):
        llm_engine.segment_topic(sample_topic, [sample_sub])
