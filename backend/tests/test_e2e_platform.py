import io

from app.core.security import create_token
from app.services.pipeline_service import run_stages_1_to_5

def make_auth_header(uid: int, role: str):
    token = create_token(sub=str(uid), role=role)
    return {"Authorization": f"Bearer {token}"}

# ==========================================
# 1. Health Checks
# ==========================================
def test_health_endpoints(client):
    res = client.get("/health/liveness")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    res_ready = client.get("/health/readiness")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ok"

# ==========================================
# 2. Authentication & RBAC (VER-001, VER-002)
# ==========================================
def test_login_success_and_failure(client):
    # Success
    res = client.post("/auth/login", json={"email": "admin@example.com", "password": "AdminPass123!"})
    assert res.status_code == 200
    assert "access_token" in res.json()
    assert res.json()["role"] == "admin"

    # Bad password
    res_bad = client.post("/auth/login", json={"email": "admin@example.com", "password": "WrongPassword"})
    assert res_bad.status_code == 401

def test_rbac_admin_boundary(client):
    # Student attempting to access admin endpoints should be rejected with 403 (VER-002)
    student_headers = make_auth_header(2, "student")
    res = client.get("/admin/users", headers=student_headers)
    assert res.status_code == 403

    # Admin accessing admin endpoints should succeed (200)
    admin_headers = make_auth_header(1, "admin")
    res_admin = client.get("/admin/users", headers=admin_headers)
    assert res_admin.status_code == 200

# ==========================================
# 3. PDF Ingestion & Validation (VER-005, SEC-FILE-001..004)
# ==========================================
def test_pdf_upload_validation(client):
    admin_headers = make_auth_header(1, "admin")

    # Reject non-PDF
    bad_file = io.BytesIO(b"Hello world text file")
    res_bad = client.post(
        "/admin/textbooks",
        headers=admin_headers,
        data={"title": "Test Doc"},
        files={"file": ("test.txt", bad_file, "text/plain")}
    )
    assert res_bad.status_code == 400

    # Accept valid PDF with magic bytes
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    pdf_file = io.BytesIO(valid_pdf_content)
    res_ok = client.post(
        "/admin/textbooks",
        headers=admin_headers,
        data={"title": "Introduction to Computer Science"},
        files={"file": ("cs101.pdf", pdf_file, "application/pdf")}
    )
    assert res_ok.status_code == 201
    assert res_ok.json()["title"] == "Introduction to Computer Science"
    assert res_ok.json()["status"] == "uploaded"

# ==========================================
# 4. End-to-End Pipeline & Admin Approval Gate (CON-002, ARCH-V-004, VER-007)
# ==========================================
def test_e2e_pipeline_review_and_learning_lifecycle(client, db_session):
    admin_headers = make_auth_header(1, "admin")
    student_headers = make_auth_header(2, "student")

    # Step 1: Upload Textbook
    pdf_content = b"%PDF-1.4\nChapter 1: Python Architecture\nTopic 1.1: Virtual Environments\nContent explaining Python\n%%EOF"
    res_upload = client.post(
        "/admin/textbooks",
        headers=admin_headers,
        data={"title": "Python Architecture Textbook", "subject_id": 1},
        files={"file": ("python_arch.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert res_upload.status_code == 201
    tb_id = res_upload.json()["id"]

    # Step 2: Trigger Pipeline (Stages 1-5)
    res_pipe = client.post(f"/admin/textbooks/{tb_id}/pipeline", headers=admin_headers)
    assert res_pipe.status_code == 200

    # Execute pipeline synchronously for test verification
    run_stages_1_to_5(db_session, tb_id)

    # Step 3: Check Status
    res_status = client.get(f"/admin/textbooks/{tb_id}/status", headers=admin_headers)
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "completed"

    # Step 4: Check Hierarchy
    res_hier = client.get(f"/admin/textbooks/{tb_id}/hierarchy", headers=admin_headers)
    assert res_hier.status_code == 200
    chapters = res_hier.json()["chapters"]
    assert len(chapters) > 0
    tb_topic_ids = {t["id"] for ch in chapters for t in ch.get("topics", [])}

    # Step 5: Review Queue - Verify generated content is in pending_review
    res_rev = client.get("/admin/review/items", headers=admin_headers)
    assert res_rev.status_code == 200
    items = res_rev.json()
    assert len(items) > 0

    video_item = next(i for i in items if i["type"] == "video" and (not tb_topic_ids or i.get("topic_id") in tb_topic_ids))
    quiz_item = next(i for i in items if i["type"] == "quiz" and (not tb_topic_ids or i.get("topic_id") in tb_topic_ids))
    video_id = video_item["item_id"]
    quiz_id = quiz_item["item_id"]

    # Step 6: Verify Content CANNOT be accessed by student before admin approval (CON-002, VER-007)
    res_unpub_video = client.get(f"/learn/videos/{video_id}", headers=student_headers)
    assert res_unpub_video.status_code == 404

    # Step 7: Admin approves video and quiz
    res_appr_v = client.post(
        f"/admin/review/items/{video_id}/approval?type=video",
        headers=admin_headers,
        json={"decision": "approve"}
    )
    assert res_appr_v.status_code == 200
    assert res_appr_v.json()["status"] == "published"

    res_appr_q = client.post(
        f"/admin/review/items/{quiz_id}/approval?type=quiz",
        headers=admin_headers,
        json={"decision": "approve"}
    )
    assert res_appr_q.status_code == 200
    assert res_appr_q.json()["status"] == "published"

    # Step 8: Now student CAN access the pre-rendered video
    res_pub_video = client.get(f"/learn/videos/{video_id}", headers=student_headers)
    assert res_pub_video.status_code == 200
    assert res_pub_video.json()["review_status"] == "published"
    assert res_pub_video.json()["duration_seconds"] == 330  # Targets ~5.5 min

    # Step 9: Student records video progress
    res_prog = client.post(
        f"/learn/videos/{video_id}/progress",
        headers=student_headers,
        json={"progress_pct": 100.0, "completed": True}
    )
    assert res_prog.status_code == 200
    assert res_prog.json()["completed"] is True

    # Step 10: Student retrieves published quiz
    topic_id = res_pub_video.json()["topic_id"]
    res_quiz = client.get(f"/learn/topics/{topic_id}/quiz", headers=student_headers)
    assert res_quiz.status_code == 200
    questions = res_quiz.json()["questions"]
    assert len(questions) > 0

    # Step 11: Student submits quiz attempt with intentional errors to trigger weak concepts
    answers_payload = {str(questions[0]["id"]): 3}  # Choose wrong answer
    res_attempt = client.post(
        f"/learn/quizzes/{quiz_id}/attempts",
        headers=student_headers,
        json={"answers": answers_payload}
    )
    assert res_attempt.status_code == 200
    attempt_data = res_attempt.json()
    assert len(attempt_data["weak_concepts"]) > 0

    # Step 12: Stage 6 - Student retrieves adaptive remediation quiz
    res_adapt = client.get("/learn/quizzes/adaptive", headers=student_headers)
    assert res_adapt.status_code == 200
    adapt_data = res_adapt.json()
    assert len(adapt_data["questions"]) > 0
    assert adapt_data["questions"][0]["adaptive"] is True

    # Step 13: Parent / Teacher reads read-only dashboard summary (VER-003, ARCH-V-006)
    parent_headers = make_auth_header(5, "parent")
    res_parent_dash = client.get(f"/learn/dashboards/progress?student_id=2", headers=parent_headers)
    assert res_parent_dash.status_code == 200
    dash_data = res_parent_dash.json()
    assert dash_data["student_id"] == 2
    assert dash_data["completed_videos_count"] == 1
    assert dash_data["quizzes_taken_count"] == 1
    assert "weak_concepts" in dash_data
