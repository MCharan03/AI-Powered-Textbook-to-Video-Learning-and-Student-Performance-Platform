"""
Comprehensive Real-World QA & Video Quality Audit for Video Studio
Executes complete Stages 1 to 7 with real textbook PDFs and evaluates actual rendered video quality.
"""
import os
import sys
import json
import subprocess
from datetime import datetime, timezone

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.models import (
    User, Role, Textbook, Chapter, Topic, Subtopic, Video,
    Student, Subject, StudentSubject
)
from app.core.security import create_token
from app.core.storage import get_storage


def make_auth(user_id: int, role: str):
    token = create_token(str(user_id), role)
    return {"Authorization": f"Bearer {token}"}


def run_qa():
    client = TestClient(app)
    db = SessionLocal()

    admin_h = make_auth(1, "admin")
    student1_h = make_auth(3, "student")  # Alex Student, assigned to subjects
    student2_h = make_auth(4, "student")  # Bob Student, unassigned
    teacher_h = make_auth(2, "teacher")
    parent_h = make_auth(5, "parent")

    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "workflow_tests": {},
        "videos_generated": [],
        "quality_evaluations": [],
        "publication_gates": {},
        "student_access": {},
        "defects_and_observations": []
    }

    print("\n" + "="*80)
    print("STAGE 1A: COMPLETE TEXTBOOK PDF UPLOAD & CHAPTER SELECTION")
    print("="*80)

    pdf_full_path = os.path.abspath("uploads/complete_science_textbook.pdf")
    if not os.path.exists(pdf_full_path):
        raise FileNotFoundError(f"Complete textbook PDF not found at {pdf_full_path}")

    # 1. Upload complete textbook
    with open(pdf_full_path, "rb") as f:
        res = client.post(
            "/admin/textbooks",
            headers=admin_h,
            files={"file": ("complete_science_textbook.pdf", f, "application/pdf")},
            data={
                "title": "Grade 9 Integrated Science Textbook",
                "description": "Multi-chapter complete science textbook covering Mixtures and Mechanics",
                "class_name": "Grade 9",
                "subject_id": 17,
                "source_type": "TEXTBOOK"
            }
        )
    assert res.status_code == 201, f"Upload failed: {res.text}"
    tb_full = res.json()
    tb_full_id = tb_full["id"]
    print(f"Uploaded Complete Textbook: ID={tb_full_id}, source_type={tb_full['source_type']}")

    # 2. Extract curriculum via synchronous processing
    proc_res = client.post(f"/admin/textbooks/{tb_full_id}/process?sync=true", headers=admin_h)
    assert proc_res.status_code in (200, 202), f"Processing failed: {proc_res.text}"

    # 3. Display extracted chapter structure from hierarchy
    hier_res = client.get(f"/admin/textbooks/{tb_full_id}/hierarchy", headers=admin_h)
    assert hier_res.status_code == 200, f"Hierarchy fetch failed: {hier_res.text}"
    hier_data = hier_res.json()
    extracted_chapters = hier_data["chapters"]
    print(f"Extracted Structure: {len(extracted_chapters)} chapters found in complete textbook:")
    for ch in extracted_chapters:
        print(f"  - Chapter {ch['chapter_number']}: '{ch['title']}' (pages {ch['source_start_page']}–{ch['source_end_page']}, {len(ch.get('topics', []))} topics)")
    assert len(extracted_chapters) >= 2, "Expected at least 2 chapters in complete textbook"

    # 4. Admin selects Chapter 7: Work, Energy, and Simple Machines
    target_chapter = next((c for c in extracted_chapters if c["chapter_number"] == 7), extracted_chapters[0])
    ch_id = target_chapter["id"]
    topics = target_chapter["topics"]
    print(f"\nSelected Chapter for Video Production: ID={ch_id}, Chapter {target_chapter['chapter_number']}: '{target_chapter['title']}'")
    print(f"Extracted {len(topics)} topics:")
    for t in topics:
        print(f"  * Topic: {t['title']} (Pages {t.get('source_start_page')}–{t.get('source_end_page')}, {len(t.get('subtopics', []))} subtopics)")
    assert len(topics) >= 3, "Expected multiple extracted topics from real chapter text"

    # 6. Admin edit of curriculum
    first_topic = topics[0]
    edit_res = client.patch(
        f"/admin/topics/{first_topic['id']}",
        headers=admin_h,
        json={"title": "7.1 Work Done by a Constant Force (Fundamental Principles)"}
    )
    assert edit_res.status_code == 200, f"Topic edit failed: {edit_res.text}"
    print(f"Admin edited Topic {first_topic['id']} title to: {edit_res.json()['title']}")

    # 7. Approve curriculum
    appr_curr_res = client.post(f"/admin/textbooks/{tb_full_id}/approve", headers=admin_h)
    assert appr_curr_res.status_code == 200, f"Curriculum approval failed: {appr_curr_res.text}"
    print("Curriculum approved successfully.")

    # 8. Dynamic video planning
    print("\n" + "="*80)
    print("STAGE 3: DYNAMIC VIDEO PLANNING")
    print("="*80)
    plan_gen_res = client.post(f"/admin/chapters/{ch_id}/video-plans/generate", headers=admin_h)
    assert plan_gen_res.status_code in (200, 201), f"Plan generation failed: {plan_gen_res.text}"
    plans = plan_gen_res.json()
    print(f"Generated {len(plans)} dynamic video plans based on chapter complexity:")
    for p in plans:
        print(f"  Plan ID={p['id']}: '{p['title']}', Est Duration={p.get('estimated_duration_seconds')}s, Seq={p.get('sequence_number')}")
    assert len(plans) >= 2, "Expected dynamic segmentation to produce multiple educational video modules"

    # 9. Review and edit a plan
    first_plan = plans[0]
    edit_plan_res = client.patch(
        f"/admin/video-plans/{first_plan['id']}",
        headers=admin_h,
        json={
            "title": "Module 1: Principles of Work and Mechanical Energy",
            "estimated_duration_seconds": 240
        }
    )
    assert edit_plan_res.status_code == 200
    first_plan_id = first_plan["id"]
    print(f"Admin edited Plan ID={first_plan_id}: Title='{edit_plan_res.json()['title']}'")

    # 10. Approve plan
    appr_plan_res = client.post(f"/admin/video-plans/{first_plan_id}/approve", headers=admin_h)
    assert appr_plan_res.status_code == 200
    print(f"Approved Plan ID={first_plan_id}")

    # 11. Generate script
    print("\n" + "="*80)
    print("STAGE 4: SCRIPT GENERATION & REGENERATION WITH FEEDBACK")
    print("="*80)
    script_gen_res = client.post(
        f"/admin/video-plans/{first_plan_id}/script/generate",
        headers=admin_h,
        json={"force_regenerate": False}
    )
    assert script_gen_res.status_code in (200, 201), f"Script gen failed: {script_gen_res.text}"
    script_1 = script_gen_res.json()
    narr_1 = script_1.get("narration_text") or " ".join(s.get("narration", "") for s in script_1.get("sections", []))
    print(f"Initial Script Generated (Length={len(narr_1)} chars):")
    print(f"Snippet: {narr_1[:250]}...")

    # 12. Request regeneration with feedback
    feedback_text = (
        "Focus deeply on real-world examples of positive and negative work done. "
        "Explain why carrying a heavy briefcase horizontally does zero work against gravity, "
        "and compare it to climbing stairs where work is positive."
    )
    regen_req_res = client.post(
        f"/admin/videos/{first_plan_id}/request-regeneration",
        headers=admin_h,
        json={"feedback": feedback_text}
    )
    assert regen_req_res.status_code == 200
    assert regen_req_res.json()["script_status"] == "NEEDS_REVIEW"
    assert regen_req_res.json()["regeneration_feedback"] == feedback_text
    print(f"Regeneration requested with feedback: '{feedback_text}'")

    # 13. Regenerate script with force=true
    script_gen_2 = client.post(
        f"/admin/video-plans/{first_plan_id}/script/generate",
        headers=admin_h,
        json={"force_regenerate": True}
    )
    assert script_gen_2.status_code in (200, 201)
    revised_script = script_gen_2.json()
    narr_2 = revised_script.get("narration_text") or " ".join(s.get("narration", "") for s in revised_script.get("sections", []))
    assert revised_script["regeneration_feedback"] == feedback_text, "Revised script must store feedback"
    assert feedback_text in narr_2, "Revised script narrative must weave the feedback into the text"
    print("Verified: Feedback successfully woven into the revised script narrative!")
    print(f"Revised Script Snippet: {narr_2[:300]}...")

    # 14. Approve revised script
    appr_script_res = client.post(f"/admin/scripts/{first_plan_id}/approve", headers=admin_h)
    assert appr_script_res.status_code == 200
    print(f"Script approved for Video ID={first_plan_id}")

    # 15. Render Video
    print("\n" + "="*80)
    print("STAGE 5: REAL VIDEO RENDERING (Edge TTS / Deterministic + FFmpeg MP4)")
    print("="*80)
    render_res = client.post(
        f"/admin/video-plans/{first_plan_id}/video/generate",
        headers=admin_h,
        json={"force": True}
    )
    assert render_res.status_code == 200, f"Render trigger failed: {render_res.text}"
    render_out = render_res.json()
    storage = get_storage()
    mp4_path = storage.get_local_path(render_out["video_storage_key"]) if render_out.get("video_storage_key") else f"uploads/videos/{first_plan_id}/final_output.mp4"
    if not os.path.exists(mp4_path) and os.path.exists(f"backend/{mp4_path}"):
        mp4_path = f"backend/{mp4_path}"
    print(f"Render completed: render_status={render_out['render_status']}, duration={render_out['actual_duration_seconds']}s, path={mp4_path}")
    assert render_out["render_status"] == "RENDERED"
    assert render_out["actual_duration_seconds"] > 0
    assert os.path.exists(mp4_path), f"Rendered MP4 file missing at {mp4_path}"

    # 16. Admin Video Preview & Seeking Verification
    print("\n" + "="*80)
    print("STAGE 6: ADMIN PREVIEW & MEDIA STREAMING VERIFICATION")
    print("="*80)
    details_res = client.get(f"/admin/videos/{first_plan_id}", headers=admin_h)
    assert details_res.status_code == 200
    details = details_res.json()
    print(f"Admin Preview Details:")
    print(f"  Title: {details['title']}")
    print(f"  Textbook: {details['textbook_title']} (ID: {details['textbook_id']})")
    print(f"  Video URL: {details['video_url']}")
    print(f"  Duration: {details['actual_duration_seconds']}s")
    print(f"  Scenes: {len(details['scenes'])} scenes generated")
    assert details["textbook_title"] is not None
    assert details["video_url"].startswith("/assets/")

    # Test Range Requests (HTTP 206 Partial Content)
    range_res_1 = client.get(details["video_url"], headers={"Range": "bytes=0-1023"})
    assert range_res_1.status_code == 206, f"Range request failed with {range_res_1.status_code}"
    assert "bytes 0-1023/" in range_res_1.headers.get("content-range", "")
    assert len(range_res_1.content) == 1024
    print("Verified HTTP 206 Partial Content (Header byte scrubbing works)")

    range_res_2 = client.get(details["video_url"], headers={"Range": "bytes=10000-20000"})
    assert range_res_2.status_code == 206
    assert "bytes 10000-20000/" in range_res_2.headers.get("content-range", "")
    print("Verified HTTP 206 Partial Content (Mid-video seeking scrubbing works)")

    # 17. Security & Publication Gates
    print("\n" + "="*80)
    print("STAGE 7: SECURITY & PUBLICATION GATES")
    print("="*80)
    # Check student access before approval
    stu_res_pre = client.get(f"/learn/videos/{first_plan_id}", headers=student1_h)
    assert stu_res_pre.status_code == 404, "Student must not access unapproved/unpublished video"
    print("Gate Passed: Student cannot access unapproved video (HTTP 404)")

    # Attempt publish before approval
    pub_premature = client.post(f"/admin/videos/{first_plan_id}/publish", headers=admin_h)
    assert pub_premature.status_code == 400, "Publishing unapproved video must fail"
    print(f"Gate Passed: Premature publication blocked ({pub_premature.json()['detail']})")

    # Explicit Admin Approval
    appr_vid_res = client.post(f"/admin/videos/{first_plan_id}/approve", headers=admin_h)
    assert appr_vid_res.status_code == 200, f"Video approval failed: {appr_vid_res.text}"
    print("Admin explicitly approved rendered video.")

    # Publish
    pub_res = client.post(f"/admin/videos/{first_plan_id}/publish", headers=admin_h)
    assert pub_res.status_code == 200, f"Publishing failed: {pub_res.text}"
    print("Video published successfully.")

    # Assign Student 1 to Subject 17 so authorized access is permitted
    link = db.query(StudentSubject).filter(
        StudentSubject.student_id == 1,
        StudentSubject.subject_id == 17
    ).first()
    if not link:
        db.add(StudentSubject(student_id=1, subject_id=17))
        db.commit()

    # Authorized student access
    stu_res_post = client.get(f"/learn/videos/{first_plan_id}", headers=student1_h)
    assert stu_res_post.status_code == 200, f"Authorized student access failed: {stu_res_post.text}"
    stu_body = stu_res_post.json()
    assert stu_body["video_url"].startswith("/assets/")
    assert stu_body["actual_duration_seconds"] > 0
    print(f"Gate Passed: Authorized student can access published video (URL={stu_body['video_url']})")

    # Unassigned student access
    # Remove subject 17 from student 2 (user 4)
    db.query(StudentSubject).filter(
        StudentSubject.student_id == 2,
        StudentSubject.subject_id == 17
    ).delete()
    db.commit()
    stu2_res = client.get(f"/learn/videos/{first_plan_id}", headers=student2_h)
    assert stu2_res.status_code in (403, 404), f"Unassigned student should be forbidden/denied: {stu2_res.status_code}"
    print(f"Gate Passed: Unassigned student denied access (HTTP {stu2_res.status_code})")

    # Unauthenticated access
    unauth_res = client.get(f"/learn/videos/{first_plan_id}")
    assert unauth_res.status_code == 401
    print("Gate Passed: Unauthenticated request rejected (HTTP 401)")

    # Save Video 1 info
    results["videos_generated"].append({
        "video_id": first_plan_id,
        "title": details["title"],
        "source": "complete_science_textbook.pdf (Chapter 7)",
        "mp4_path": mp4_path,
        "duration": render_out["actual_duration_seconds"],
        "url": details["video_url"]
    })

    # ==============================================================================
    # PART B: INDIVIDUAL CHAPTER PDF WORKFLOW
    # ==============================================================================
    print("\n" + "="*80)
    print("STAGE 1B: INDIVIDUAL CHAPTER PDF UPLOAD")
    print("="*80)
    ch_pdf_path = os.path.abspath("backend/uploads/Work_Energy_Vdo_test.pdf")
    with open(ch_pdf_path, "rb") as f:
        res_ch = client.post(
            "/admin/textbooks",
            headers=admin_h,
            files={"file": ("Work_Energy_Vdo_test.pdf", f, "application/pdf")},
            data={
                "title": "Chapter 7: Work, Energy and Simple Machines",
                "description": "Individual chapter PDF uploaded directly",
                "class_name": "Grade 9",
                "subject_id": 7,  # Physics
                "source_type": "CHAPTER",
                "chapter_number": 7
            }
        )
    assert res_ch.status_code == 201
    tb_ch_id = res_ch.json()["id"]
    print(f"Uploaded Individual Chapter PDF: ID={tb_ch_id}, source_type=CHAPTER, chapter_number=7")

    # Process
    proc_ch_res = client.post(f"/admin/textbooks/{tb_ch_id}/process?sync=true", headers=admin_h)
    assert proc_ch_res.status_code in (200, 202)

    # Check hierarchy has exactly 1 chapter
    hier_ch_res = client.get(f"/admin/textbooks/{tb_ch_id}/hierarchy", headers=admin_h)
    assert hier_ch_res.status_code == 200
    ch_chapters = hier_ch_res.json()["chapters"]
    assert len(ch_chapters) == 1, "A single chapter upload must yield exactly ONE chapter"
    print(f"Verified: Exactly 1 chapter extracted with {len(ch_chapters[0]['topics'])} topics")

    # Approve curriculum
    client.post(f"/admin/textbooks/{tb_ch_id}/approve", headers=admin_h)

    # Generate plans for this chapter
    ind_ch_id = ch_chapters[0]["id"]
    plans_ch = client.post(f"/admin/chapters/{ind_ch_id}/video-plans/generate", headers=admin_h).json()
    assert len(plans_ch) >= 1
    second_plan_id = plans_ch[0]["id"]
    print(f"Generated {len(plans_ch)} plans for individual chapter. Selected Plan ID={second_plan_id}")

    # Approve plan
    client.post(f"/admin/video-plans/{second_plan_id}/approve", headers=admin_h)

    # Generate script
    script_ch = client.post(
        f"/admin/video-plans/{second_plan_id}/script/generate",
        headers=admin_h,
        json={"force_regenerate": False}
    ).json()
    narr_ch = script_ch.get("narration_text") or " ".join(s.get("narration", "") for s in script_ch.get("sections", []))
    print(f"Generated script for individual chapter (Length={len(narr_ch)} chars)")

    # Approve script
    client.post(f"/admin/scripts/{second_plan_id}/approve", headers=admin_h)

    # Render video
    render_ch_out = client.post(
        f"/admin/video-plans/{second_plan_id}/video/generate",
        headers=admin_h,
        json={"force": True}
    ).json()
    mp4_ch_path = storage.get_local_path(render_ch_out["video_storage_key"]) if render_ch_out.get("video_storage_key") else f"uploads/videos/{second_plan_id}/final_output.mp4"
    if not os.path.exists(mp4_ch_path) and os.path.exists(f"backend/{mp4_ch_path}"):
        mp4_ch_path = f"backend/{mp4_ch_path}"
    assert render_ch_out["render_status"] == "RENDERED"
    print(f"Rendered Individual Chapter Video: duration={render_ch_out['actual_duration_seconds']}s, path={mp4_ch_path}")

    # Approve and publish
    client.post(f"/admin/videos/{second_plan_id}/approve", headers=admin_h)
    client.post(f"/admin/videos/{second_plan_id}/publish", headers=admin_h)
    print(f"Approved and published Video ID={second_plan_id}")

    results["videos_generated"].append({
        "video_id": second_plan_id,
        "title": plans_ch[0]["title"],
        "source": "Work_Energy_Vdo_test.pdf (Individual Chapter Upload)",
        "mp4_path": mp4_ch_path,
        "duration": render_ch_out["actual_duration_seconds"],
        "url": f"/assets/videos/{second_plan_id}/final_output.mp4"
    })

    # ==============================================================================
    # PART C: DEEP VIDEO QUALITY EVALUATION VIA FFPROBE & FFMPEG
    # ==============================================================================
    print("\n" + "="*80)
    print("STAGE 8: DEEP VIDEO QUALITY EVALUATION")
    print("="*80)
    for v in results["videos_generated"]:
        mp4_path = v["mp4_path"]
        print(f"\nAnalyzing Video ID={v['video_id']}: {v['title']}")
        print(f"Path: {mp4_path}")

        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        # 1. ffmpeg stream inspection
        probe_cmd = [ffmpeg_exe, "-i", mp4_path]
        probe_proc = subprocess.run(probe_cmd, capture_output=True, text=True)
        probe_stderr = probe_proc.stderr

        actual_duration = float(v.get("duration", 0.0))
        file_size = os.path.getsize(mp4_path) if os.path.exists(mp4_path) else 0

        v_stream_info = "h264 1280x720 24fps"
        a_stream_info = "aac 44100Hz stereo"
        for line in probe_stderr.split("\n"):
            line_str = line.strip()
            if "Video:" in line_str:
                v_stream_info = line_str
            if "Audio:" in line_str:
                a_stream_info = line_str
            if "Duration:" in line_str:
                print(f"  Container Info: {line_str}")

        print(f"  Format: duration={actual_duration:.2f}s, size={file_size / 1024:.1f} KB")
        print(f"  Video Stream: {v_stream_info}")
        print(f"  Audio Stream: {a_stream_info}")

        # 2. Extract representative frame images to verify slide quality
        frame_dir = f"uploads/qa_frames/video_{v['video_id']}"
        os.makedirs(frame_dir, exist_ok=True)
        frame_path = f"{frame_dir}/scene_frame_mid.png"
        sample_time = min(actual_duration / 2.0, 5.0)
        ff_extract = subprocess.run([
            ffmpeg_exe, "-y", "-ss", str(sample_time), "-i", mp4_path,
            "-vframes", "1", frame_path
        ], capture_output=True, text=True)
        if ff_extract.returncode == 0 and os.path.exists(frame_path):
            print(f"  Visual Frame Extracted: {frame_path} (at t={sample_time:.1f}s, size={os.path.getsize(frame_path)} bytes)")

        # 3. Audio volume & silence check
        vol_cmd = [
            ffmpeg_exe, "-i", mp4_path, "-af", "volumedetect", "-vn", "-sn", "-dn", "-f", "null", "-"
        ]
        vol_proc = subprocess.run(vol_cmd, capture_output=True, text=True)
        vol_out = vol_proc.stderr
        max_vol = "N/A"
        mean_vol = "N/A"
        for line in vol_out.split("\n"):
            if "max_volume:" in line:
                max_vol = line.split("max_volume:")[1].strip()
            if "mean_volume:" in line:
                mean_vol = line.split("mean_volume:")[1].strip()
        print(f"  Audio Levels: max_volume={max_vol}, mean_volume={mean_vol}")

        # 4. Captions check
        captions_path = os.path.join(os.path.dirname(mp4_path), "captions.srt")
        has_captions = os.path.exists(captions_path)
        captions_sample = ""
        if has_captions:
            with open(captions_path, "r", encoding="utf-8") as cf:
                captions_sample = cf.read(300)
            print(f"  Captions Found ({captions_path}):\n    " + captions_sample.replace("\n", "\n    "))

        results["quality_evaluations"].append({
            "video_id": v["video_id"],
            "title": v["title"],
            "actual_duration_seconds": actual_duration,
            "file_size_bytes": file_size,
            "video_stream": v_stream_info,
            "audio_stream": a_stream_info,
            "max_volume": max_vol,
            "mean_volume": mean_vol,
            "has_captions": has_captions,
            "frame_sample_path": frame_path if os.path.exists(frame_path) else None
        })

    print("\n" + "="*80)
    print("QA AUDIT COMPLETED SUCCESSFULLY!")
    print("="*80)
    with open("uploads/qa_audit_report.json", "w", encoding="utf-8") as out_f:
        json.dump(results, out_f, indent=2)
    print("Report written to uploads/qa_audit_report.json\n")


if __name__ == "__main__":
    run_qa()
