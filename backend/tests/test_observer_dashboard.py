from app.core.security import create_token
from app.models.models import Teacher, User, Role


def auth_header(user_id: int, role: str):
    token = create_token(sub=str(user_id), role=role)
    return {"Authorization": f"Bearer {token}"}


def test_parent_dashboard_contains_only_linked_students(client):
    response = client.get("/learn/dashboards/observer", headers=auth_header(5, "parent"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == "parent"
    assert [student["student_id"] for student in payload["students"]] == [2]
    assert payload["students_count"] == 1
    assert "answers" not in response.text


def test_teacher_dashboard_contains_only_assigned_students(client):
    response = client.get("/learn/dashboards/observer", headers=auth_header(4, "teacher"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == "teacher"
    assert {student["student_id"] for student in payload["students"]} == {2, 3}
    assert payload["students_count"] == 2


def test_student_and_admin_cannot_read_observer_dashboard(client):
    student_response = client.get("/learn/dashboards/observer", headers=auth_header(2, "student"))
    admin_response = client.get("/learn/dashboards/observer", headers=auth_header(1, "admin"))

    assert student_response.status_code == 403
    assert admin_response.status_code == 403


def test_teacher_without_assignments_sees_empty_cohort_and_cannot_query_student(client, db_session):
    user = User(username="observer_teacher", password_hash="unused", role=Role.TEACHER, is_active=True)
    db_session.add(user)
    db_session.flush()
    teacher = Teacher(user_id=user.id, teacher_id="TCH-OBSERVER", name="Observer Teacher")
    db_session.add(teacher)
    db_session.commit()

    headers = auth_header(user.id, "teacher")
    overview = client.get("/learn/dashboards/observer", headers=headers)
    guessed_student = client.get("/learn/dashboards/progress?student_id=2", headers=headers)

    assert overview.status_code == 200
    assert overview.json()["students"] == []
    assert guessed_student.status_code == 403
