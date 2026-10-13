import io

from app.core.security import create_token
from app.models.models import Textbook, VideoUnit, Quiz, PipelineStatus, ReviewStatus
from app.services.pipeline_service import run_stages_1_to_5

def make_auth_header(uid: int, role: str):
    token = create_token(sub=str(uid), role=role)
    return {"Authorization": f"Bearer {token}"}

# ============================================================================
# 1. Authentication & Token Security Tests (SEC-AUTHN-001..004)
# ============================================================================
def test_unauthenticated_requests_blocked(client):
    # Requests without Authorization header must return 401
    assert client.get("/admin/users").status_code == 401
    assert client.post("/admin/textbooks").status_code == 401
    assert client.get("/learn/videos/1").status_code == 401
    assert client.get("/learn/dashboards/progress").status_code == 401

def test_invalid_and_malformed_tokens_rejected(client):
    # Garbage token
    bad_header = {"Authorization": "Bearer not.a.valid.jwt.token"}
    assert client.get("/admin/users", headers=bad_header).status_code == 401

    # Missing Bearer prefix
    no_bearer = {"Authorization": "JustSomeToken"}
    assert client.get("/admin/users", headers=no_bearer).status_code == 401

# ============================================================================
# 2. File Upload Validation & Security Tests (SEC-FILE-001..004, CON-001)
# ============================================================================
def test_upload_non_pdf_rejected(client):
    admin_h = make_auth_header(1, "admin")
    fake_txt = io.BytesIO(b"Just plain text file content")
    res = client.post(
        "/admin/textbooks",
        headers=admin_h,
        data={"title": "Text File"},
        files={"file": ("malicious.exe", fake_txt, "application/x-msdownload")}
    )
    assert res.status_code == 400
    assert "PDF" in res.json()["detail"]

def test_upload_fake_pdf_magic_bytes_rejected(client):
    admin_h = make_auth_header(1, "admin")
    fake_pdf = io.BytesIO(b"This is not a PDF at all")
    res = client.post(
        "/admin/textbooks",
        headers=admin_h,
        data={"title": "Fake PDF"},
        files={"file": ("fake.pdf", fake_pdf, "application/pdf")}
    )
    assert res.status_code == 400
    assert "magic bytes" in res.json()["detail"]

def test_oversize_upload_rejected(client):
    admin_h = make_auth_header(1, "admin")
    # 51 MB payload exceeds max_upload_mb (50 MB)
    large_size = 51 * 1024 * 1024
    oversize_bytes = b"%PDF-" + b"0" * (large_size - 5)
    res = client.post(
        "/admin/textbooks",
        headers=admin_h,
        data={"title": "Oversized Book"},
        files={"file": ("large.pdf", io.BytesIO(oversize_bytes), "application/pdf")}
    )
    assert res.status_code == 413
    assert "exceeds maximum allowed size" in res.json()["detail"]

def test_corrupted_pdf_handled_gracefully(client, db_session):
    # Upload a file with valid %PDF- header but corrupt internal structure
    admin_h = make_auth_header(1, "admin")
    corrupt_content = b"%PDF-1.4\nCORRUPT_DATA_NO_OBJECTS_OR_PAGES\x00\xff\xfe\xfd%%EOF"
    res = client.post(
        "/admin/textbooks",
        headers=admin_h,
        data={"title": "Corrupt Textbook"},
        files={"file": ("corrupt.pdf", io.BytesIO(corrupt_content), "application/pdf")}
    )
    assert res.status_code == 201
    tb_id = res.json()["id"]

    # Run pipeline directly
    run_stages_1_to_5(db_session, tb_id)

    # Verify status is completed with fallback or failed gracefully without unhandled crash
    res_status = client.get(f"/admin/textbooks/{tb_id}/status", headers=admin_h)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["status"] in ["completed", "failed"]

# ============================================================================
# 3. RBAC Cross-Role Boundary Tests (SEC-AUTHZ-001..004)
# ============================================================================
def test_student_forbidden_from_admin_operations(client):
    student_h = make_auth_header(2, "student")

    # Cannot upload
    res = client.post("/admin/textbooks", headers=student_h, data={"title": "Hacked"}, files={"file": ("hack.pdf", io.BytesIO(b"%PDF-"), "application/pdf")})
    assert res.status_code == 403

    # Cannot view user management
    assert client.get("/admin/users", headers=student_h).status_code == 403

    # Cannot approve items
    assert client.post("/admin/review/items/1/approval", headers=student_h, json={"decision": "approve"}).status_code == 403

    # Cannot modify thresholds
    assert client.put("/admin/settings/thresholds", headers=student_h, json={"mastery_threshold": 50.0, "adaptive_per_weak": 2}).status_code == 403

def test_parent_and_teacher_forbidden_from_admin_and_student_mutations(client):
    teacher_h = make_auth_header(4, "teacher")
    parent_h = make_auth_header(5, "parent")

    # Cannot access admin users
    assert client.get("/admin/users", headers=teacher_h).status_code == 403
    assert client.get("/admin/users", headers=parent_h).status_code == 403

    # Observers cannot record student video progress
    assert client.post("/learn/videos/1/progress", headers=teacher_h, json={"progress_pct": 50.0}).status_code == 403
    assert client.post("/learn/videos/1/progress", headers=parent_h, json={"progress_pct": 50.0}).status_code == 403

    # Observers cannot submit quiz attempts
    assert client.post("/learn/quizzes/1/attempts", headers=teacher_h, json={"answers": {}}).status_code == 403
    assert client.post("/learn/quizzes/1/attempts", headers=parent_h, json={"answers": {}}).status_code == 403

# ============================================================================
# 4. Student Data Isolation & Privacy (SEC-PRIV-001, ARCH-V-006)
# ============================================================================
def test_cross_student_progress_isolation(client):
    student1_h = make_auth_header(2, "student")

    # Student 1 explicitly passes student_id=3 in query string
    res = client.get("/learn/dashboards/progress?student_id=3", headers=student1_h)
    assert res.status_code == 200
    # Must return Student 1's ID (id=2), ignoring the spoofed target student parameter
    assert res.json()["student_id"] == 2
    assert res.json()["student_name"] == "Student Alice"

# ============================================================================
# 5. Unpublished Content Gate & Invalid Approvals (CON-002, ARCH-V-004)
# ============================================================================
def test_unpublished_content_and_approval_boundaries(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")

    # Create dummy textbook first to satisfy foreign key
    tb = Textbook(title="Dummy TB", filename="dummy.pdf", status=PipelineStatus.completed, stage=5)
    db_session.add(tb)
    db_session.flush()

    # Create an unapproved video and quiz directly in DB
    unpub_v = VideoUnit(
        textbook_id=tb.id,
        title="Unpublished Video Lesson",
        video_url="/static/videos/unpub.mp4",
        duration_seconds=330,
        review_status=ReviewStatus.pending_review
    )
    unpub_q = Quiz(
        textbook_id=tb.id,
        title="Unpublished Quiz Assessment",
        review_status=ReviewStatus.pending_review
    )
    db_session.add_all([unpub_v, unpub_q])
    db_session.commit()
    v_id = unpub_v.id
    q_id = unpub_q.id

    # Student cannot access unpublished video unit
    res_v = client.get(f"/learn/videos/{v_id}", headers=student_h)
    assert res_v.status_code == 404

    # Approving non-existent review item returns 404
    res_fake_appr = client.post(
        "/admin/review/items/999999/approval",
        headers=admin_h,
        json={"decision": "approve"}
    )
    assert res_fake_appr.status_code == 404

    # Invalid decision string returns 400
    res_bad_decision = client.post(
        f"/admin/review/items/{v_id}/approval",
        headers=admin_h,
        json={"decision": "invalid_action"}
    )
    assert res_bad_decision.status_code == 400

# ============================================================================
# 6. Malformed Settings and Out-of-Bounds Validation (FR-009)
# ============================================================================
def test_threshold_settings_bounds(client):
    admin_h = make_auth_header(1, "admin")

    # Mastery threshold out of bounds (> 100)
    res_too_high = client.put(
        "/admin/settings/thresholds",
        headers=admin_h,
        json={"mastery_threshold": 120.0, "adaptive_per_weak": 3}
    )
    assert res_too_high.status_code == 400

    # Negative threshold
    res_neg = client.put(
        "/admin/settings/thresholds",
        headers=admin_h,
        json={"mastery_threshold": -5.0, "adaptive_per_weak": 3}
    )
    assert res_neg.status_code == 400

    # Adaptive question count out of bounds (> 10)
    res_adapt_high = client.put(
        "/admin/settings/thresholds",
        headers=admin_h,
        json={"mastery_threshold": 80.0, "adaptive_per_weak": 25}
    )
    assert res_adapt_high.status_code == 400

# ============================================================================
# 7. Media Delivery Verification (NFR-002, ARCH-V-005)
# ============================================================================
def test_pre_rendered_media_asset_available(client):
    # Verify the physical static pre-rendered video asset is accessible via HTTP
    res = client.get("/static/videos/sample.mp4")
    assert res.status_code == 200
    assert "video/mp4" in res.headers.get("content-type", "")
    assert len(res.content) > 1000  # Valid MP4 payload exists
