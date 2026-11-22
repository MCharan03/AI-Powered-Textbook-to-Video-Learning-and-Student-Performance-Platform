import io
import pytest
from app.models.models import User, Video, Chapter, Topic, Subtopic, VideoRenderingJob
from app.services.pipeline_service import run_stages_1_to_5
from app.services.script_generation import ScriptService
from tests.test_security_and_failures import make_auth_header


def test_maintenance_cleanup_preview_and_safety_gate(client, db_session):
    admin_headers = make_auth_header(1, "admin")
    student_headers = make_auth_header(2, "student")

    # 1. Non-admin forbidden
    res_student = client.get("/admin/maintenance/cleanup-preview", headers=student_headers)
    assert res_student.status_code in [401, 403]

    # 2. Admin dry-run preview
    res_preview = client.get("/admin/maintenance/cleanup-preview", headers=admin_headers)
    assert res_preview.status_code == 200
    data = res_preview.json()
    assert "summary" in data
    assert "preserved_core_data" in data
    assert "affected_target_directories" in data
    assert data["status"] == "PREVIEW_ONLY"
    assert data["dry_run"] is True

    # 3. Execution without confirmation MUST fail with 400
    res_unconfirmed = client.post(
        "/admin/maintenance/cleanup-execute",
        headers=admin_headers,
        json={"confirm": False, "create_backup": True}
    )
    assert res_unconfirmed.status_code == 400
    assert "Confirmation" in res_unconfirmed.json()["detail"] or "confirm: true" in res_unconfirmed.json()["detail"]


def test_video_rendering_job_lifecycle_and_cancellation(client, db_session):
    admin_headers = make_auth_header(1, "admin")

    # Setup textbook & approved script
    pdf_content = b"%PDF-1.4\nChapter 1: Dynamic Systems\nTopic 1.1: State Space Models\nFeedback loops and matrix representations.\n%%EOF"
    res_upload = client.post(
        "/admin/textbooks",
        headers=admin_headers,
        data={"title": "Dynamic Systems Textbook", "subject_id": 1},
        files={"file": ("dyn_sys.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert res_upload.status_code == 201
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/pipeline", headers=admin_headers)
    run_stages_1_to_5(db_session, tb_id)
    client.post(f"/admin/textbooks/{tb_id}/approve", headers=admin_headers)

    res_plans = client.get(f"/admin/video-plans?textbook_id={tb_id}", headers=admin_headers)
    assert res_plans.status_code == 200
    plans = res_plans.json()
    assert len(plans) > 0
    video_id = plans[0]["id"]

    # Approve plan & generate approved script
    client.post(f"/admin/video-plans/{video_id}/approve", headers=admin_headers)
    client.post(f"/admin/video-plans/{video_id}/script/generate", headers=admin_headers)
    client.post(f"/admin/scripts/{video_id}/approve", headers=admin_headers)

    # 1. Queue background rendering job
    res_job = client.post(
        "/admin/video-rendering/jobs",
        headers=admin_headers,
        json={"video_id": video_id, "force": True}
    )
    assert res_job.status_code == 200
    job_data = res_job.json()
    job_id = job_data["job_id"]
    assert job_id.startswith("vjob-")
    assert job_data["video_id"] == video_id
    assert job_data["stage_number"] >= 1
    assert "stage_name" in job_data

    # 2. Query job status by job_id
    res_get_job = client.get(f"/admin/video-rendering/jobs/{job_id}", headers=admin_headers)
    assert res_get_job.status_code == 200
    assert res_get_job.json()["job_id"] == job_id

    # 3. List recent jobs with filter
    res_list_jobs = client.get(f"/admin/video-rendering/jobs?video_id={video_id}", headers=admin_headers)
    assert res_list_jobs.status_code == 200
    job_list = res_list_jobs.json()
    assert len(job_list) >= 1
    assert any(j["job_id"] == job_id for j in job_list)

    # 4. Check video generation status endpoint exposes 9-stage tracking
    res_status = client.get(f"/admin/videos/{video_id}/generation-status", headers=admin_headers)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["job_id"] == job_id
    assert status_data["stage_number"] is not None
    assert status_data["stage_name"] is not None
    assert "elapsed_seconds" in status_data

    # 5. Cancel the job safely
    res_cancel = client.post(
        f"/admin/video-rendering/jobs/{job_id}/cancel",
        headers=admin_headers,
        json={"reason": "Testing cancellation"}
    )
    assert res_cancel.status_code == 200
    cancelled_job = res_cancel.json()
    assert cancelled_job["status"] == "CANCELLED"
    assert cancelled_job["is_cancelled"] is True
    assert cancelled_job["cancellation_reason"] == "Testing cancellation"
