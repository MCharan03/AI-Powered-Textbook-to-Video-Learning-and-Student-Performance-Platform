"""
Build 06 Programmatic End-to-End Verification Script

Verifies the entire TTS + Scene-based Video Rendering Pipeline:
Step 1: Admin authentication
Step 2: Find or create an approved video script
Step 3: Start video generation
Step 4: Verify ProcessingJob exists
Step 5: Verify narration audio artifact exists
Step 6: Verify scenes data exists
Step 7: Verify rendered MP4 file on disk
Step 8: Validate MP4 via FFmpeg probe (video/audio streams, resolution, duration)
Step 9: Verify thumbnail and captions artifacts exist
Step 10: Verify video metadata in database
Step 11: Admin reviews generated video preview
Step 12: Admin approves and publishes video
Step 13: Student requests the learning video
Step 14: Student receives ONLY the published video
Step 15: Verify student cannot access draft/internal generation artifacts

Prints:
BUILD 06 E2E VERIFICATION PASSED
or
BUILD 06 E2E VERIFICATION FAILED
"""

import sys
import os
import json
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, engine
from app.core.migrations import sync_sqlite_schema
from app.core.security import hash_pw, create_token
from app.models.models import (
    User, Role, Subject, Chapter, Topic, Subtopic, Video,
    VideoScriptVersion, VideoRenderVersion, ProcessingJob, JobStatus,
    Student, StudentSubject
)
from app.services.script_generation import ScriptService
from app.services.video_rendering import LocalFFmpegVideoRenderer
from app.core.storage import get_storage

def run_e2e():
    print("=" * 60)
    print("STARTING BUILD 06 PROGRAMMATIC E2E VERIFICATION")
    print("=" * 60)
    
    sync_sqlite_schema(engine)
    client = TestClient(app)
    db = SessionLocal()

    try:
        # Step 1: Admin authentication
        print("\n[Step 1] Admin authentication...")
        admin_user = db.query(User).filter(User.username == "admin_build06_e2e").first()
        if not admin_user:
            admin_user = User(
                username="admin_build06_e2e",
                name="Build 06 Admin",
                password_hash=hash_pw("AdminPass123!"),
                role=Role.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        admin_token = create_token(admin_user.id, "admin")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print("  ✓ Admin authenticated successfully")

        # Step 2: Find or create an approved video script
        print("\n[Step 2] Finding or creating an APPROVED video script...")
        approved_video = db.query(Video).filter(Video.script_status == "SCRIPT_APPROVED").first()
        if not approved_video:
            # Create subject, student, link, chapter, topic, subtopic, video
            subj = Subject(name="E2E Physics 101", code="E2E-PHYS-06")
            db.add(subj)
            db.flush()

            chap = Chapter(
                subject_id=subj.id,
                chapter_number=1,
                title="Classical Dynamics",
                status="APPROVED",
                source_start_page=1,
                source_end_page=20
            )
            db.add(chap)
            db.flush()

            topic_desc = "Newton's second law of motion states that force equals mass times acceleration: F = m*a. " * 20
            top = Topic(
                chapter_id=chap.id,
                sequence_number=1,
                title="Newton's Laws of Motion",
                description=topic_desc,
                status="APPROVED",
                source_start_page=1,
                source_end_page=10
            )
            db.add(top)
            db.flush()

            subtop = Subtopic(
                topic_id=top.id,
                sequence_number=1,
                title="Force, Mass, and Acceleration",
                description=topic_desc,
                source_start_page=1,
                source_end_page=5
            )
            db.add(subtop)
            db.flush()

            approved_video = Video(
                topic_id=top.id,
                subtopic_id=subtop.id,
                title="Newton's Second Law: Dynamics in Action",
                description="Educational video demonstrating F=ma and real-world force dynamics.",
                sequence_number=1,
                duration_seconds=300,
                estimated_duration_seconds=300,
                source_start_page=1,
                source_end_page=5,
                learning_objective="Understand and calculate net force, mass, and acceleration.",
                content_outline=[
                    "Introduction to Forces and Vectors",
                    "Mass and Inertial Resistance",
                    "Mathematical Formulation: F = ma",
                    "Worked Problem and Real-World Application"
                ],
                status="APPROVED"
            )
            db.add(approved_video)
            db.commit()
            db.refresh(approved_video)

            # Generate script and approve it
            ScriptService.generate_script_for_video(db, approved_video.id)
            ScriptService.approve_script(db, approved_video.id)
            db.refresh(approved_video)
        
        video_id = approved_video.id
        print(f"  ✓ Found APPROVED script (video_id={video_id}, title={approved_video.title}, script_status={approved_video.script_status})")

        # Step 3: Start video generation
        print("\n[Step 3] Starting video generation via API...")
        gen_res = client.post(
            f"/admin/video-plans/{video_id}/video/generate",
            headers=admin_headers,
            json={"tts_engine": "deterministic", "voice": "educational-en"}
        )
        assert gen_res.status_code == 200, f"Video generation trigger failed: {gen_res.text}"
        gen_data = gen_res.json()
        job_id = gen_data["job_id"]
        print(f"  ✓ Video generation initiated. video_id={video_id}, job_id={job_id}")

        # Step 4: Verify ProcessingJob exists
        print("\n[Step 4] Verifying ProcessingJob...")
        db.expire_all()
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        assert job is not None, "ProcessingJob not found in database!"
        assert job.job_type == "VIDEO_GENERATION", f"Job type mismatch: {job.job_type}"
        status_str = job.status.value if hasattr(job.status, "value") else str(job.status)
        print(f"  ✓ ProcessingJob status: {status_str}, progress: {job.progress}%, current_stage: {job.current_stage}")
        assert status_str == "COMPLETED", f"Job did not complete: {job.error_message}"

        # Step 5: Verify narration audio artifact exists
        print("\n[Step 5] Verifying narration audio artifact...")
        video = db.query(Video).filter(Video.id == video_id).first()
        assert video is not None, "Video record missing!"
        assert video.audio_storage_key is not None, "audio_storage_key is None!"
        storage = get_storage()
        audio_abs = storage.get_local_path(video.audio_storage_key)
        assert audio_abs and os.path.exists(audio_abs), f"Audio file does not exist on disk: {audio_abs}"
        audio_size = os.path.getsize(audio_abs)
        assert audio_size > 1000, f"Audio file suspiciously small: {audio_size} bytes"
        print(f"  ✓ Narration audio exists: {video.audio_storage_key} ({audio_size} bytes)")

        # Step 6: Verify scenes data exists
        print("\n[Step 6] Verifying scene definitions...")
        scenes = video.scenes_data
        assert scenes and len(scenes) >= 3, f"Scenes data empty or incomplete: {scenes}"
        total_scene_duration = sum(s.get("estimated_duration_seconds", 0) for s in scenes)
        print(f"  ✓ {len(scenes)} scenes generated. Total calculated duration: {total_scene_duration}s")
        for s in scenes:
            print(f"    - Scene {s['scene_number']}: [{s['visual_type']}] {s['title']} ({s['estimated_duration_seconds']}s)")

        # Step 7: Verify rendered MP4 file on disk
        print("\n[Step 7] Verifying rendered MP4 file on disk...")
        assert video.video_storage_key is not None, "video_storage_key is None!"
        video_abs = storage.get_local_path(video.video_storage_key)
        assert video_abs and os.path.exists(video_abs), f"MP4 file does not exist on disk: {video_abs}"
        video_size = os.path.getsize(video_abs)
        assert video_size > 5000, f"MP4 file suspiciously small: {video_size} bytes"
        print(f"  ✓ MP4 exists on disk: {video.video_storage_key} ({video_size} bytes)")

        # Step 8: Validate MP4 via FFmpeg probe
        print("\n[Step 8] Validating MP4 via FFmpeg probe...")
        renderer = LocalFFmpegVideoRenderer()
        probe_res = renderer.probe_media(video_abs)
        assert probe_res["valid"], f"MP4 validation failed: {probe_res}"
        assert probe_res["has_video"], "Missing video stream!"
        assert probe_res["has_audio"], "Missing audio stream!"
        assert "1280x720" in probe_res["resolution"], f"Unexpected resolution: {probe_res['resolution']}"
        assert probe_res["duration"] > 0, "Video duration is 0!"
        print(f"  ✓ MP4 Validated:")
        print(f"    - Resolution: {probe_res['resolution']}")
        print(f"    - Duration: {probe_res['duration']:.2f}s")
        print(f"    - Streams count: {probe_res['streams_count']}")
        print(f"    - Video stream: {probe_res['video_codec']}")
        print(f"    - Audio stream: {probe_res['audio_codec']}")

        # Step 9: Verify thumbnail and captions
        print("\n[Step 9] Verifying thumbnail and captions...")
        assert video.thumbnail_storage_key is not None, "thumbnail_storage_key is None!"
        thumb_abs = storage.get_local_path(video.thumbnail_storage_key)
        assert thumb_abs and os.path.exists(thumb_abs), f"Thumbnail missing: {thumb_abs}"
        print(f"  ✓ Thumbnail exists: {video.thumbnail_storage_key} ({os.path.getsize(thumb_abs)} bytes)")

        assert video.captions_storage_key is not None, "captions_storage_key is None!"
        captions_abs = storage.get_local_path(video.captions_storage_key)
        assert captions_abs and os.path.exists(captions_abs), f"Captions missing: {captions_abs}"
        with open(captions_abs, "r", encoding="utf-8") as f:
            captions_sample = f.read(200)
        print(f"  ✓ Captions exist: {video.captions_storage_key} ({len(captions_sample)} chars sample: {captions_sample[:60]}...)")

        # Step 10: Verify video metadata in database
        print("\n[Step 10] Verifying video metadata in database...")
        assert video.render_status == "RENDERED", f"Unexpected render status: {video.render_status}"
        assert video.status == "REVIEW", f"Expected video status REVIEW, got: {video.status}"
        assert video.render_engine == "ffmpeg"
        assert video.tts_engine == "deterministic"
        assert video.actual_duration_seconds > 0
        print(f"  ✓ Video metadata intact: status={video.status}, render_status={video.render_status}, duration={video.actual_duration_seconds}s")

        # Step 11: Admin reviews generated video preview
        print("\n[Step 11] Admin reviews generated video preview...")
        preview_res = client.get(f"/admin/videos/{video_id}/preview", headers=admin_headers)
        assert preview_res.status_code == 200, f"Admin preview failed: {preview_res.text}"
        preview_data = preview_res.json()
        assert preview_data["video_url"] is not None
        assert preview_data["thumbnail_url"] is not None
        assert preview_data["captions_url"] is not None
        assert len(preview_data["scenes"]) >= 3
        print(f"  ✓ Admin preview returned valid payload with video, thumbnail, captions, and scenes.")

        # Step 12: Admin approves and publishes video
        print("\n[Step 12] Admin approves and publishes video...")
        approve_res = client.post(f"/admin/videos/{video_id}/approve", headers=admin_headers, json={"feedback": "Approved for Grade 11"})
        assert approve_res.status_code == 200, f"Approve failed: {approve_res.text}"
        
        publish_res = client.post(f"/admin/videos/{video_id}/publish", headers=admin_headers, json={"notes": "Published for student access"})
        assert publish_res.status_code == 200, f"Publish failed: {publish_res.text}"
        db.expire_all()
        v_pub = db.query(Video).filter(Video.id == video_id).first()
        assert v_pub.status == "PUBLISHED"
        print(f"  ✓ Video {video_id} approved and PUBLISHED (status: {v_pub.status}).")

        # Step 13: Student requests the learning video
        print("\n[Step 13] Student authentication and assignment...")
        student_user = db.query(User).filter(User.username == "student_build06_e2e").first()
        if not student_user:
            student_user = User(
                username="student_build06_e2e",
                name="Build 06 Student",
                password_hash=hash_pw("StudentPass123!"),
                role=Role.STUDENT,
                is_active=True
            )
            db.add(student_user)
            db.flush()
            student_record = Student(
                user_id=student_user.id,
                student_id="E2E-STU-06",
                name="Build 06 Student",
                class_="Grade 11"
            )
            db.add(student_record)
            db.flush()
        else:
            student_record = db.query(Student).filter(Student.user_id == student_user.id).first()

        # Enroll student in subject
        top_rec = db.query(Topic).filter(Topic.id == v_pub.topic_id).first()
        chap_rec = db.query(Chapter).filter(Chapter.id == top_rec.chapter_id).first()
        sub_assoc = db.query(StudentSubject).filter(
            StudentSubject.student_id == student_record.id,
            StudentSubject.subject_id == chap_rec.subject_id
        ).first()
        if not sub_assoc:
            db.add(StudentSubject(student_id=student_record.id, subject_id=chap_rec.subject_id))
        db.commit()

        student_token = create_token(student_user.id, "student")
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Step 14: Student receives ONLY the published video
        print("\n[Step 14] Verifying student receives published video...")
        learn_res = client.get(f"/learn/videos/{video_id}", headers=student_headers)
        assert learn_res.status_code == 200, f"Student learning request failed: {learn_res.text}"
        learn_data = learn_res.json()
        assert learn_data["id"] == video_id
        assert learn_data["status"] == "PUBLISHED"
        assert learn_data["video_url"] is not None
        assert "scenes_data" not in learn_data or not learn_data.get("scenes_data") # Internal details not exposed
        print(f"  ✓ Student successfully received published video: {learn_data['title']}")

        # Step 15: Verify student cannot access draft/internal generation artifacts
        print("\n[Step 15] Verifying student is forbidden from admin/draft endpoints...")
        # Try admin video preview as student
        admin_preview_by_student = client.get(f"/admin/videos/{video_id}/preview", headers=student_headers)
        assert admin_preview_by_student.status_code in (401, 403), f"Student should be forbidden from admin preview: {admin_preview_by_student.status_code}"
        
        # Try generation status as student
        gen_status_by_student = client.get(f"/admin/videos/{video_id}/generation-status", headers=student_headers)
        assert gen_status_by_student.status_code in (401, 403), f"Student should be forbidden from generation status: {gen_status_by_student.status_code}"

        # Verify an unapproved video returns 404 to students
        draft_video = Video(
            topic_id=v_pub.topic_id,
            subtopic_id=v_pub.subtopic_id,
            title="Unpublished Draft Video",
            status="REVIEW",
            render_status="RENDERED",
            actual_duration_seconds=60
        )
        db.add(draft_video)
        db.commit()
        db.refresh(draft_video)

        draft_access_res = client.get(f"/learn/videos/{draft_video.id}", headers=student_headers)
        assert draft_access_res.status_code in (403, 404), f"Student should NOT see unapproved/review video! Got {draft_access_res.status_code}"
        print(f"  ✓ Confirmed student receives 404/403 when requesting REVIEW/unpublished video.")
        print(f"  ✓ Confirmed student forbidden (403) from admin video preview.")

        print("\n" + "=" * 60)
        print("BUILD 06 E2E VERIFICATION PASSED")
        print("=" * 60)
        return True

    except Exception as e:
        print("\n" + "=" * 60)
        print(f"BUILD 06 E2E VERIFICATION FAILED: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_e2e()
    sys.exit(0 if success else 1)
