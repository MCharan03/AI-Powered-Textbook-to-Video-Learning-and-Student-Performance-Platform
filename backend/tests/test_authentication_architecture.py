import pytest
from fastapi.testclient import TestClient


def test_student_login_with_student_id_and_role(client: TestClient):
    """1. Student can log in using Student ID + password with role='student'."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "CMRIT26ECE001",
            "password": "StudentPass123!",
            "role": "student"
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "student"
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_parent_login_with_parent_id_and_role(client: TestClient):
    """2. Parent can log in using Parent ID + password with role='parent'."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "PAR-CMRIT001",
            "password": "ParentPass123!",
            "role": "parent"
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "parent"
    assert "access_token" in data


def test_teacher_login_with_teacher_id_and_role(client: TestClient):
    """3. Teacher can log in using Teacher ID + password with role='teacher'."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "TCH001",
            "password": "TeacherPass123!",
            "role": "teacher"
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "teacher"
    assert "access_token" in data


def test_teacher_login_with_email_and_role(client: TestClient):
    """3b. Teacher can log in using email + password with role='teacher'."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "teacher@example.com",
            "password": "TeacherPass123!",
            "role": "teacher"
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "teacher"
    assert "access_token" in data


def test_admin_login_with_email_and_role(client: TestClient):
    """4. Admin can log in using Admin Email + password with role='admin'."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "admin@example.com",
            "password": "AdminPass123!",
            "role": "admin"
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["role"] == "admin"
    assert "access_token" in data


def test_admin_rejected_on_learning_roles(client: TestClient):
    """Admin credentials must NOT be accepted when attempting to log in as student, parent, or teacher."""
    for forbidden_role in ["student", "parent", "teacher"]:
        res = client.post(
            "/auth/login",
            json={
                "identifier": "admin@example.com",
                "password": "AdminPass123!",
                "role": forbidden_role
            }
        )
        assert res.status_code == 401, f"Expected 401 for role={forbidden_role}, got {res.status_code}"
        assert "Invalid credentials for selected role" in res.json().get("detail", "")


def test_student_rejected_on_other_roles(client: TestClient):
    """Student credentials must NOT be accepted when attempting to log in as admin, parent, or teacher."""
    for forbidden_role in ["admin", "parent", "teacher"]:
        res = client.post(
            "/auth/login",
            json={
                "identifier": "CMRIT26ECE001",
                "password": "StudentPass123!",
                "role": forbidden_role
            }
        )
        assert res.status_code == 401, f"Expected 401 for role={forbidden_role}, got {res.status_code}"
        assert "Invalid credentials for selected role" in res.json().get("detail", "")


def test_parent_rejected_on_other_roles(client: TestClient):
    """Parent credentials must NOT be accepted when attempting to log in as admin, student, or teacher."""
    for forbidden_role in ["admin", "student", "teacher"]:
        res = client.post(
            "/auth/login",
            json={
                "identifier": "PAR-CMRIT001",
                "password": "ParentPass123!",
                "role": forbidden_role
            }
        )
        assert res.status_code == 401, f"Expected 401 for role={forbidden_role}, got {res.status_code}"
        assert "Invalid credentials for selected role" in res.json().get("detail", "")


def test_teacher_rejected_on_other_roles(client: TestClient):
    """Teacher credentials must NOT be accepted when attempting to log in as admin, student, or parent."""
    for forbidden_role in ["admin", "student", "parent"]:
        res = client.post(
            "/auth/login",
            json={
                "identifier": "TCH001",
                "password": "TeacherPass123!",
                "role": forbidden_role
            }
        )
        assert res.status_code == 401, f"Expected 401 for role={forbidden_role}, got {res.status_code}"
        assert "Invalid credentials for selected role" in res.json().get("detail", "")


def test_invalid_password_returns_401(client: TestClient):
    """Incorrect password returns 401."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "CMRIT26ECE001",
            "password": "WrongPassword!",
            "role": "student"
        }
    )
    assert res.status_code == 401
    assert "Incorrect" in res.json().get("detail", "")


def test_unsupported_role_returns_400(client: TestClient):
    """Unsupported role returns 400."""
    res = client.post(
        "/auth/login",
        json={
            "identifier": "CMRIT26ECE001",
            "password": "StudentPass123!",
            "role": "superman"
        }
    )
    assert res.status_code == 400
    assert "Unsupported role" in res.json().get("detail", "")


def test_backward_compatibility_login_without_role(client: TestClient):
    """Login without specifying role still resolves user canonically."""
    # Student by student_id
    res = client.post(
        "/auth/login",
        json={
            "username": "CMRIT26ECE001",
            "password": "StudentPass123!"
        }
    )
    assert res.status_code == 200
    assert res.json()["role"] == "student"

    # Admin by username
    res = client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "AdminPass123!"
        }
    )
    assert res.status_code == 200
    assert res.json()["role"] == "admin"
