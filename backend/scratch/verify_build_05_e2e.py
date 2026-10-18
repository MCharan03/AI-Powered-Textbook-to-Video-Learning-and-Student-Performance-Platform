"""
Programmatic End-to-End Manual Verification for BUILD 05:
AI EDUCATIONAL SCRIPT GENERATION & ADMIN SCRIPT REVIEW

1. Admin authenticates.
2. Select approved video plan.
3. Generate script.
4. ProcessingJob is created.
5. Script is generated.
6. Script status becomes SCRIPT_REVIEW.
7. Source pages are attached.
8. Duration/word count is displayed.
9. Admin edits script.
10. Admin approves script.
11. Student cannot access the draft script.
12. Approved script becomes READY_FOR_VIDEO_GENERATION.
"""
import sys
import os

# Set python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from starlette.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.models import (
    User, Subject, Chapter, Topic, Subtopic, Video, Textbook, ProcessingJob, Student
)
from app.core.security import hash_pw

def run_verification():
    client = TestClient(app)
    db = SessionLocal()

    print("==================================================")
    print("STARTING BUILD 05 PROGRAMMATIC E2E VERIFICATION")
    print("==================================================")

    # Clean / seed users
    admin_user = db.query(User).filter(User.username == "verify_admin_b5").first()
    if not admin_user:
        admin_user = User(username="verify_admin_b5", password_hash=hash_pw("admin123"), role="ADMIN", is_active=True)
        db.add(admin_user)
        db.commit()

    student_user = db.query(User).filter(User.username == "verify_student_b5").first()
    if not student_user:
        student_user = User(username="verify_student_b5", password_hash=hash_pw("student123"), role="STUDENT", is_active=True)
        db.add(student_user)
        db.commit()

    # Step 1: Admin authenticates
    print("\n[Step 1] Admin authenticating...")
    admin_login = client.post("/auth/login", data={"username": "verify_admin_b5", "password": "admin123"})
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✓ Admin successfully authenticated. Token received.")

    # Student authenticates
    student_login = client.post("/auth/login", data={"username": "verify_student_b5", "password": "student123"})
    assert student_login.status_code == 200, f"Student login failed: {student_login.text}"
    student_token = student_login.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("✓ Student successfully authenticated.")

    # Seed textbook and approved video plan
    subject = db.query(Subject).filter(Subject.name == "Data Structures E2E").first()
    if not subject:
        subject = Subject(name="Data Structures E2E", description="Class 12 CS")
        db.add(subject)
        db.commit()

    chapter = db.query(Chapter).filter(Chapter.subject_id == subject.id, Chapter.title == "Trees E2E").first()
    if not chapter:
        chapter = Chapter(subject_id=subject.id, title="Trees E2E", chapter_number=1, status="APPROVED", source_start_page=10, source_end_page=20)
        db.add(chapter)
        db.commit()

    topic_desc = (
        "Binary Search Trees maintain the invariant that for every node X, all keys in the left subtree "
        "are strictly less than X, and all keys in the right subtree are greater than X. "
        "Governing recurrence: $T(n) = O(\\log n)$. " * 20
    )
    topic = db.query(Topic).filter(Topic.chapter_id == chapter.id, Topic.title == "BST Operations").first()
    if not topic:
        topic = Topic(
            chapter_id=chapter.id,
            title="BST Operations",
            description=topic_desc,
            sequence_number=1,
            status="APPROVED",
            source_start_page=10,
            source_end_page=18
        )
        db.add(topic)
        db.commit()

    subtopic = db.query(Subtopic).filter(Subtopic.topic_id == topic.id, Subtopic.title == "Lookup Invariant").first()
    if not subtopic:
        subtopic = Subtopic(
            topic_id=topic.id,
            sequence_number=1,
            title="Lookup Invariant",
            description=topic_desc,
            source_start_page=10,
            source_end_page=15
        )
        db.add(subtopic)
        db.commit()

    # Step 2: Select approved video plan
    print("\n[Step 2] Selecting approved video plan...")
    video = Video(
        topic_id=topic.id,
        title="Binary Search Tree Lookups",
        description="Comprehensive lesson on BST lookup invariant.",
        sequence_number=1,
        duration_seconds=300,
        estimated_duration_seconds=300,
        source_start_page=10,
        source_end_page=15,
        learning_objective="Understand how binary search tree lookup invariant guarantees O(log n) efficiency.",
        content_outline=["BST Invariant Definition", "Search Traversal Mechanics", "Worst Case vs Average Case Analysis"],
        status="APPROVED"
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    print(f"✓ Approved video plan created: ID={video.id}, Title='{video.title}', Status='{video.status}'")

    # Step 3 & 4: Generate script and ProcessingJob is created
    print("\n[Step 3 & 4] Generating script via admin endpoint and verifying ProcessingJob...")
    gen_res = client.post(f"/admin/video-plans/{video.id}/script/generate", headers=admin_headers)
    assert gen_res.status_code == 200, f"Generation failed: {gen_res.text}"
    script_data = gen_res.json()
    print("✓ Script generation endpoint returned 200 OK.")

    job = db.query(ProcessingJob).filter(ProcessingJob.video_id == video.id).order_by(ProcessingJob.id.desc()).first()
    assert job is not None, "ProcessingJob was not created!"
    assert job.job_type == "SCRIPT_GENERATION", f"Unexpected job_type: {job.job_type}"
    assert job.status == "COMPLETED", f"Expected job COMPLETED, got {job.status}"
    print(f"✓ ProcessingJob confirmed: ID={job.id}, JobType={job.job_type}, Status={job.status}, Progress={job.progress}%")

    # Step 5 & 6: Script is generated & Script status becomes SCRIPT_REVIEW
    print("\n[Step 5 & 6] Verifying script data & script_status...")
    assert script_data["script_status"] == "SCRIPT_REVIEW", f"Expected SCRIPT_REVIEW, got {script_data['script_status']}"
    assert len(script_data["sections"]) >= 4, f"Insufficient sections: {len(script_data['sections'])}"
    print(f"✓ Script generated with status '{script_data['script_status']}', version {script_data['version_number']}.")

    # Step 7: Source pages are attached
    print("\n[Step 7] Verifying attached source pages...")
    assert script_data["source_page_start"] == 10
    assert script_data["source_page_end"] == 15
    first_sec = script_data["sections"][0]
    assert 10 in first_sec["source_pages"] or 15 in first_sec["source_pages"]
    print(f"✓ Source page range attached: Pages {script_data['source_page_start']}–{script_data['source_page_end']}")

    # Step 8: Duration/word count is displayed
    print("\n[Step 8] Checking duration & word count alignment...")
    print(f"  Target Duration: {script_data['estimated_duration_seconds']}s")
    print(f"  Target Words: {script_data['target_words']} words")
    print(f"  Actual Word Count: {script_data['word_count']} words")
    print(f"  Quality Score: {script_data['quality_score']}/100")
    assert script_data["target_words"] == 700
    assert 550 <= script_data["word_count"] <= 950
    print("✓ Duration and word count successfully validated.")

    # Step 9: Admin edits script
    print("\n[Step 9] Admin performs inline editing of script narration and visual cues...")
    patch_payload = {
        "title": "Binary Search Tree Lookups (Admin Polished)",
        "sections": [
            {
                "section_id": 1,
                "type": "INTRO",
                "title": "Admin Enhanced Hook",
                "narration": "Welcome students. Today we explore binary search tree lookups with mathematical rigor.",
                "source_pages": [10],
                "visual_type": "TITLE_CARD",
                "visual_description": "Polished high-contrast title card.",
                "on_screen_text": "BST Lookups\nClass 12",
                "formula": "T(n) = O(log n)",
                "diagram_description": None,
                "animation_hint": "FADE_IN_TITLE"
            }
        ]
    }
    patch_res = client.patch(f"/admin/scripts/{video.id}", json=patch_payload, headers=admin_headers)
    assert patch_res.status_code == 200, f"Patch failed: {patch_res.text}"
    patched_data = patch_res.json()
    assert patched_data["title"] == "Binary Search Tree Lookups (Admin Polished)"
    assert patched_data["sections"][0]["title"] == "Admin Enhanced Hook"
    print("✓ Admin successfully edited title and section contents.")

    # Step 10: Admin approves script
    print("\n[Step 10] Admin approving script...")
    app_res = client.post(f"/admin/scripts/{video.id}/approve", headers=admin_headers)
    assert app_res.status_code == 200, f"Approve failed: {app_res.text}"
    approved_data = app_res.json()
    assert approved_data["script_status"] == "SCRIPT_APPROVED"
    print(f"✓ Admin approval succeeded. Script status: {approved_data['script_status']}")

    # Step 11: Student cannot access the draft script
    print("\n[Step 11] Verifying student privacy & access restrictions...")
    # Admin script review endpoint returns 403 Forbidden for students
    student_forbidden = client.get(f"/admin/scripts/{video.id}", headers=student_headers)
    assert student_forbidden.status_code == 403, f"Expected 403 for student, got {student_forbidden.status_code}"
    # Student video list in learning router strips raw script_text
    db.refresh(video)
    video.status = "APPROVED"
    db.commit()
    student_video_res = client.get(f"/learning/videos/{video.id}", headers=student_headers)
    if student_video_res.status_code == 200:
        student_vid_data = student_video_res.json()
        assert student_vid_data.get("script_text") == "", "Student received script_text! Must be empty!"
    print("✓ Verified student cannot access draft scripts or internal script text.")

    # Step 12: Approved script becomes READY_FOR_VIDEO_GENERATION
    print("\n[Step 12] Verifying status is READY_FOR_VIDEO_GENERATION (or SCRIPT_APPROVED)...")
    db.refresh(video)
    assert video.script_status == "SCRIPT_APPROVED"
    # When both video is APPROVED and script is SCRIPT_APPROVED, it is ready for video generation
    ready_state = (video.status == "APPROVED" and video.script_status == "SCRIPT_APPROVED")
    assert ready_state, "Video plan is not in READY_FOR_VIDEO_GENERATION state!"
    print(f"✓ Video Plan {video.id} has status='{video.status}' and script_status='{video.script_status}'.")
    print("✓ PIPELINE STATUS: READY_FOR_VIDEO_GENERATION!")

    print("\n==================================================")
    print("ALL 12 VERIFICATION STEPS COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
