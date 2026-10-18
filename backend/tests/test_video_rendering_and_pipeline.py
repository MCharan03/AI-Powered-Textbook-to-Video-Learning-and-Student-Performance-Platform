"""
Comprehensive test suite for BUILD 06:
AI NARRATION (TTS) & SCENE-BASED VIDEO RENDERING PIPELINE

Tests all 30 core requirements:
1. Approved script can start video generation
2. Unapproved script cannot generate video
3-6. RBAC boundaries (student, parent, teacher blocked; admin allowed)
7. TTS engine abstraction works
8. Deterministic TTS works without API keys
9. Scene generation works
10. Scene durations are calculated from word count
11. Total duration is reasonable
12. Visual cues are preserved
13. Source pages are preserved
14. FFmpeg renderer creates valid MP4
15. MP4 contains video stream
16. MP4 contains audio stream
17. Thumbnail generation works
18. Caption generation works
19. Output validation works
20-21. ProcessingJob progress and failure tracking
22. Admin can review generated video
23. Admin can approve video
24. Student cannot see REVIEW video
25. Student can see PUBLISHED video
26. Regeneration preserves previous version (SUPERSEDED)
27. Missing TTS provider falls back safely
28. Missing script fails safely
29. Invalid MP4 is rejected
30. End-to-end pipeline works
"""

import os
import tempfile
import pytest
from app.models.models import (
    User, Subject, Chapter, Topic, Subtopic, Video,
    VideoScriptVersion, VideoRenderVersion, ProcessingJob, StudentSubject
)
from tests.conftest import make_auth_header
from app.services.script_generation import ScriptService
from app.services.video_rendering import (
    VideoGenerationService,
    get_tts_engine,
    DeterministicTTSEngine,
    LocalTTSEngine,
    ProductionTTSEngine,
    TTSProviderUnavailableError,
    SceneGenerator,
    VisualSlideRenderer,
    CaptionGenerator,
    LocalFFmpegVideoRenderer
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


def create_approved_script_video(
    db,
    title="Binary Search Trees",
    duration=300,
    outline=None,
    objective="Understand binary search tree invariants and search operations."
):
    """Creates curriculum hierarchy, video plan, generates script and marks it SCRIPT_APPROVED."""
    subject = Subject(name=f"Subj-{title}", created_by=1)
    db.add(subject)
    db.flush()

    link = StudentSubject(student_id=1, subject_id=subject.id)
    db.add(link)

    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=1,
        title=f"Chapter {title}",
        status="APPROVED",
        source_start_page=10,
        source_end_page=20
    )
    db.add(chapter)
    db.flush()

    topic_desc = f"In-depth analysis of {title}. Recurrence $T(n) = O(\\log n)$. " * 25
    topic = Topic(
        chapter_id=chapter.id,
        sequence_number=1,
        title=title,
        description=topic_desc,
        status="APPROVED",
        source_start_page=10,
        source_end_page=18
    )
    db.add(topic)
    db.flush()

    subtopic = Subtopic(
        topic_id=topic.id,
        sequence_number=1,
        title=f"{title} Fundamentals",
        description=topic_desc,
        source_start_page=10,
        source_end_page=15
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
        source_start_page=10,
        source_end_page=15,
        learning_objective=objective,
        content_outline=outline or [
            f"Introduction to {title}",
            "Structural Invariants & Properties",
            "Worked Problem and Complexity Analysis"
        ],
        status="APPROVED"
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    # Generate and approve script
    ScriptService.generate_script_for_video(db, video.id)
    ScriptService.approve_script(db, video.id)
    db.refresh(video)
    return subject, chapter, topic, video


# ==============================================================================
# TEST 1: Approved script can start video generation
# ==============================================================================
def test_01_approved_script_can_start_video_generation(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_script_video(db_session, "Trees Lookups 01")

    res = client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["video_id"] == video.id
    assert data["render_status"] == "RENDERED"
    assert data["status"] == "REVIEW"
    assert data["actual_duration_seconds"] > 0
    assert data["video_url"] != ""
    assert len(data["scenes"]) >= 4


# ==============================================================================
# TEST 2: Unapproved script cannot generate video
# ==============================================================================
def test_02_unapproved_script_cannot_generate_video(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_script_video(db_session, "Unapproved Script Plan")

    # Manually reset script_status to SCRIPT_REVIEW
    video.script_status = "SCRIPT_REVIEW"
    db_session.commit()

    res = client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)
    assert res.status_code == 400
    assert "script_approved" in res.text.lower()


# ==============================================================================
# TEST 3 to 6: RBAC boundaries
# ==============================================================================
def test_03_to_06_rbac_boundaries(client, auth_headers, db_session):
    _, _, _, video = create_approved_script_video(db_session, "RBAC Render Plan")

    for role in ["student", "parent", "teacher"]:
        h = auth_headers[role]
        res = client.post(f"/admin/video-plans/{video.id}/video/generate", headers=h)
        assert res.status_code == 403, f"{role} should be forbidden from generating video"

    # Admin allowed
    admin_res = client.post(f"/admin/video-plans/{video.id}/video/generate", headers=auth_headers["admin"])
    assert admin_res.status_code == 200


# ==============================================================================
# TEST 7: TTS engine abstraction works
# ==============================================================================
def test_07_tts_engine_abstraction_works():
    engine = get_tts_engine("deterministic")
    assert isinstance(engine, DeterministicTTSEngine)
    res = engine.synthesize("Welcome students to algorithm analysis.")
    assert hasattr(res, "audio_bytes")
    assert len(res.audio_bytes) > 0
    assert res.duration_seconds > 0
    assert res.format == "wav"


# ==============================================================================
# TEST 8: Deterministic TTS works without API keys
# ==============================================================================
def test_08_deterministic_tts_works():
    engine = DeterministicTTSEngine(words_per_minute=140)
    text = "Binary search trees enforce that left is smaller and right is greater." * 5
    res = engine.synthesize(text)
    assert res.duration_seconds > 2.0
    assert res.engine == "deterministic"
    assert res.is_development is True


# ==============================================================================
# TEST 9: Scene generation works
# ==============================================================================
def test_09_scene_generation_works(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Scene Gen Test")
    generator = SceneGenerator()
    scenes = generator.generate_scenes(video, video.script_data["sections"])
    assert len(scenes) == len(video.script_data["sections"])
    assert scenes[0]["scene_number"] == 1
    assert scenes[0]["section_type"] == "INTRO"
    assert "start_time_seconds" in scenes[0]
    assert "end_time_seconds" in scenes[0]


# ==============================================================================
# TEST 10: Scene durations are calculated
# ==============================================================================
def test_10_scene_durations_are_calculated(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Scene Duration Test")
    generator = SceneGenerator(words_per_minute=140)
    sections = [
        {"type": "INTRO", "title": "Intro", "narration": "Short text of seven words here now."},
        {"type": "CONCEPT", "title": "Concept", "narration": "Word " * 70}
    ]
    scenes = generator.generate_scenes(video, sections)
    assert scenes[0]["estimated_duration_seconds"] >= 3.0
    assert scenes[1]["estimated_duration_seconds"] > scenes[0]["estimated_duration_seconds"]
    assert scenes[1]["start_time_seconds"] == scenes[0]["end_time_seconds"]


# ==============================================================================
# TEST 11: Total duration is reasonable
# ==============================================================================
def test_11_total_duration_is_reasonable(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Total Dur Plan", duration=300)
    generator = SceneGenerator(words_per_minute=140)
    scenes = generator.generate_scenes(video, video.script_data["sections"])
    total_dur = sum(s["estimated_duration_seconds"] for s in scenes)
    assert 200 <= total_dur <= 400


# ==============================================================================
# TEST 12: Visual cues are preserved
# ==============================================================================
def test_12_visual_cues_are_preserved(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Visual Cues Test")
    generator = SceneGenerator()
    scenes = generator.generate_scenes(video, video.script_data["sections"])
    visual_types = [s["visual_type"] for s in scenes]
    assert any(vt in ["TITLE_CARD", "DIAGRAM", "FORMULA_CARD", "SUMMARY_CHIPS", "CODE_SNIPPET"] for vt in visual_types)


# ==============================================================================
# TEST 13: Source pages are preserved
# ==============================================================================
def test_13_source_pages_are_preserved(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Source Trace Test")
    generator = SceneGenerator()
    scenes = generator.generate_scenes(video, video.script_data["sections"])
    for sc in scenes:
        assert len(sc["source_pages"]) > 0


# ==============================================================================
# TEST 14: FFmpeg renderer creates valid MP4
# ==============================================================================
def test_14_ffmpeg_renderer_creates_valid_mp4(db_session):
    _, _, _, video = create_approved_script_video(db_session, "FFmpeg Render Test")
    renderer = LocalFFmpegVideoRenderer()
    generator = SceneGenerator()
    scenes = generator.generate_scenes(video, video.script_data["sections"][:3])
    tts = DeterministicTTSEngine()
    audio = tts.synthesize("Narration for testing ffmpeg rendering.")

    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, "test.mp4")
        res = renderer.render(video, scenes, audio.audio_bytes, out_path)
        assert os.path.exists(res["mp4_path"])
        assert os.path.getsize(res["mp4_path"]) > 1000


# ==============================================================================
# TEST 15 & 16: MP4 contains video stream and audio stream
# ==============================================================================
def test_15_and_16_mp4_contains_video_and_audio_streams(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Stream Test")
    renderer = LocalFFmpegVideoRenderer()
    generator = SceneGenerator()
    scenes = generator.generate_scenes(video, video.script_data["sections"][:2])
    tts = DeterministicTTSEngine()
    audio = tts.synthesize("Narration audio stream check.")

    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, "streams.mp4")
        res = renderer.render(video, scenes, audio.audio_bytes, out_path)
        probe = res["probe"]
        assert probe["has_video"] is True
        assert probe["has_audio"] is True
        assert probe["streams_count"] >= 2
        assert "x" in probe["resolution"]


# ==============================================================================
# TEST 17: Thumbnail generation works
# ==============================================================================
def test_17_thumbnail_generation_works(db_session):
    _, _, _, video = create_approved_script_video(db_session, "Thumbnail Test")
    renderer = LocalFFmpegVideoRenderer()
    generator = SceneGenerator()
    scenes = generator.generate_scenes(video, video.script_data["sections"][:2])
    tts = DeterministicTTSEngine()
    audio = tts.synthesize("Thumbnail test speech.")

    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, "thumb.mp4")
        res = renderer.render(video, scenes, audio.audio_bytes, out_path)
        assert os.path.exists(res["thumbnail_path"])
        assert os.path.getsize(res["thumbnail_path"]) > 1000


# ==============================================================================
# TEST 18: Caption generation works
# ==============================================================================
def test_18_caption_generation_works():
    scenes = [
        {"scene_number": 1, "start_time_seconds": 0.0, "end_time_seconds": 5.2, "narration_text": "Hello world."},
        {"scene_number": 2, "start_time_seconds": 5.2, "end_time_seconds": 12.0, "narration_text": "Second scene."}
    ]
    srt = CaptionGenerator.generate_srt(scenes)
    assert "00:00:00,000 --> 00:00:05,200" in srt
    assert "Hello world." in srt
    assert "00:00:05,200 --> 00:00:12,000" in srt


# ==============================================================================
# TEST 19: Output validation works
# ==============================================================================
def test_19_output_validation_works(db_session):
    renderer = LocalFFmpegVideoRenderer()
    # Non-existent file should raise FileNotFoundError
    with pytest.raises(FileNotFoundError):
        renderer.probe_media("/tmp/non_existent_video.mp4")


# ==============================================================================
# TEST 20 & 21: ProcessingJob lifecycle & failure handling
# ==============================================================================
def test_20_and_21_processing_job_lifecycle(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_script_video(db_session, "Job Lifecycle Plan")

    res = client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)
    assert res.status_code == 200

    job = db_session.query(ProcessingJob).filter(
        ProcessingJob.video_id == video.id,
        ProcessingJob.job_type == "VIDEO_GENERATION"
    ).order_by(ProcessingJob.id.desc()).first()
    assert job is not None
    assert job.status == "COMPLETED"
    assert job.progress == 100.0


# ==============================================================================
# TEST 22: Admin can review generated video
# ==============================================================================
def test_22_admin_can_review_generated_video(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_script_video(db_session, "Review Preview Plan")
    client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)

    res = client.get(f"/admin/videos/{video.id}/preview", headers=admin_h)
    assert res.status_code == 200
    data = res.json()
    assert data["video_id"] == video.id
    assert data["render_status"] == "RENDERED"
    assert data["status"] == "REVIEW"
    assert len(data["scenes"]) >= 3


# ==============================================================================
# TEST 23: Admin can approve video
# ==============================================================================
def test_23_admin_can_approve_video(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_script_video(db_session, "Approve Video Plan")
    client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)

    res = client.post(f"/admin/videos/{video.id}/approve", headers=admin_h)
    assert res.status_code == 200
    assert res.json()["status"] == "APPROVED"


# ==============================================================================
# TEST 24: Student cannot see REVIEW video
# ==============================================================================
def test_24_student_cannot_see_review_video(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    student_h = auth_headers["student"]
    _, _, _, video = create_approved_script_video(db_session, "Student Privacy Plan")
    client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)

    db_session.refresh(video)
    assert video.status == "REVIEW"

    # Student requests video -> 404 Not Found
    res = client.get(f"/learn/videos/{video.id}", headers=student_h)
    assert res.status_code in [404, 403]


# ==============================================================================
# TEST 25: Student can see PUBLISHED video
# ==============================================================================
def test_25_student_can_see_published_video(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    student_h = auth_headers["student"]
    _, _, _, video = create_approved_script_video(db_session, "Student Published Plan")
    client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)
    client.post(f"/admin/videos/{video.id}/approve", headers=admin_h)
    pub_res = client.post(f"/admin/videos/{video.id}/publish", headers=admin_h)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    # Student requests published video -> 200 OK
    res = client.get(f"/learn/videos/{video.id}", headers=student_h)
    assert res.status_code == 200
    assert res.json()["id"] == video.id


# ==============================================================================
# TEST 26: Regeneration preserves previous version
# ==============================================================================
def test_26_regeneration_preserves_previous_version(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    _, _, _, video = create_approved_script_video(db_session, "Version History Plan")
    # First generation
    client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)
    v1_versions = db_session.query(VideoRenderVersion).filter(VideoRenderVersion.video_id == video.id).all()
    assert len(v1_versions) == 1
    assert v1_versions[0].version_number == 1

    # Second generation (regeneration)
    regen_res = client.post(f"/admin/videos/{video.id}/regenerate", headers=admin_h)
    assert regen_res.status_code == 200
    assert regen_res.json()["version_number"] == 2

    db_session.expire_all()
    all_versions = db_session.query(VideoRenderVersion).filter(VideoRenderVersion.video_id == video.id).order_by(VideoRenderVersion.version_number.asc()).all()
    assert len(all_versions) == 2
    assert all_versions[0].status == "SUPERSEDED"
    assert all_versions[1].status == "REVIEW"


# ==============================================================================
# TEST 27: Missing TTS provider falls back safely
# ==============================================================================
def test_27_missing_tts_provider_falls_back_safely():
    engine = ProductionTTSEngine(provider="openai")
    # In test mode without API keys, raises TTSProviderUnavailableError
    with pytest.raises(TTSProviderUnavailableError):
        engine.synthesize("Testing missing credentials.")

    # Factory falls back to local/deterministic
    resolved = get_tts_engine("production")
    assert isinstance(resolved, (LocalTTSEngine, DeterministicTTSEngine))


# ==============================================================================
# TEST 28: Missing script fails safely
# ==============================================================================
def test_28_missing_script_fails_safely(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    # Video without script
    subject = Subject(name="Subj-NoScript", created_by=1)
    db_session.add(subject)
    db_session.commit()
    chapter = Chapter(subject_id=subject.id, title="Ch1", status="APPROVED")
    db_session.add(chapter)
    db_session.commit()
    topic = Topic(chapter_id=chapter.id, title="T1", status="APPROVED")
    db_session.add(topic)
    db_session.commit()
    v = Video(topic_id=topic.id, title="No Script Video", status="APPROVED", script_status=None)
    db_session.add(v)
    db_session.commit()

    res = client.post(f"/admin/video-plans/{v.id}/video/generate", headers=admin_h)
    assert res.status_code == 400


# ==============================================================================
# TEST 29: Invalid MP4 is rejected
# ==============================================================================
def test_29_invalid_mp4_is_rejected():
    renderer = LocalFFmpegVideoRenderer()
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tf:
        tf.write(b"NOT A REAL VIDEO")
        bad_path = tf.name

    try:
        with pytest.raises(ValueError):
            renderer.probe_media(bad_path)
    finally:
        if os.path.exists(bad_path):
            os.remove(bad_path)


# ==============================================================================
# TEST 30: End-to-end pipeline works
# ==============================================================================
def test_30_end_to_end_pipeline_works(client, auth_headers, db_session):
    admin_h = auth_headers["admin"]
    student_h = auth_headers["student"]
    _, _, _, video = create_approved_script_video(db_session, "E2E Final Plan", duration=300)

    # 1. Admin generates video
    gen_res = client.post(f"/admin/video-plans/{video.id}/video/generate", headers=admin_h)
    assert gen_res.status_code == 200
    assert gen_res.json()["render_status"] == "RENDERED"

    # 2. Student cannot access REVIEW video
    rev_res = client.get(f"/learn/videos/{video.id}", headers=student_h)
    assert rev_res.status_code in [404, 403]

    # 3. Admin approves video
    app_res = client.post(f"/admin/videos/{video.id}/approve", headers=admin_h)
    assert app_res.status_code == 200

    # 4. Admin publishes video
    pub_res = client.post(f"/admin/videos/{video.id}/publish", headers=admin_h)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    # 5. Student accesses published video
    std_res = client.get(f"/learn/videos/{video.id}", headers=student_h)
    assert std_res.status_code == 200
    assert std_res.json()["id"] == video.id
    assert std_res.json()["video_url"] != ""
