import uuid
import pytest
from app.core.security import create_token
from app.models.models import User, Student, Parent, StudentParent, Role, Teacher, TeacherStudent


def auth_header(user_id: int, role: str):
    token = create_token(sub=str(user_id), role=role)
    return {"Authorization": f"Bearer {token}"}


# 1. Parent can see linked child
def test_parent_can_see_linked_child(client, db_session):
    # In conftest: User id 5 is Parent 1, linked to Student 1 (Alice)
    headers = auth_header(5, "parent")

    # Call /learn/parent/children
    res = client.get("/learn/parent/children", headers=headers)
    assert res.status_code == 200
    children = res.json()
    assert len(children) >= 1
    child_ids = [c["id"] for c in children]
    assert 1 in child_ids

    # Call /learn/parent/progress/1
    res_prog = client.get("/learn/parent/progress/1", headers=headers)
    assert res_prog.status_code == 200
    data = res_prog.json()
    assert data["child"]["id"] == 1
    assert data["child"]["student_id"] == "CMRIT26ECE001"
    assert "overall_progress" in data
    assert "videos_completed" in data
    assert "average_quiz_score" in data
    assert "topic_mastery" in data
    assert "assignments" in data


# 2. Parent cannot see unlinked child
def test_parent_cannot_see_unlinked_child(client, db_session):
    # Parent 1 (User id 5) is NOT linked to Student 2 (Bob, id 2)
    headers = auth_header(5, "parent")

    res = client.get("/learn/parent/children", headers=headers)
    assert res.status_code == 200
    children = res.json()
    child_ids = [c["id"] for c in children]
    assert 2 not in child_ids


# 3. Parent receives 403 for unauthorized student
def test_parent_receives_403_for_unauthorized_student(client, db_session):
    # Parent 1 requests Student 2 (Bob, id 2) -> 403 Forbidden
    headers = auth_header(5, "parent")

    res = client.get("/learn/parent/progress/2", headers=headers)
    assert res.status_code == 403
    assert "not linked" in res.json()["detail"].lower()


# 4. Parent with multiple children sees only those children
def test_parent_with_multiple_children_sees_only_those_children(client, db_session):
    uid = uuid.uuid4().hex[:6]
    p_user = User(username=f"parent_multi_{uid}", password_hash="dummy", role=Role.PARENT, is_active=True)
    db_session.add(p_user)
    db_session.flush()
    parent = Parent(user_id=p_user.id, parent_id=f"PAR-M-{uid}", name="Multi Parent")
    db_session.add(parent)
    db_session.flush()

    # Link both Student 1 and Student 2 to this parent
    db_session.add(StudentParent(student_id=1, parent_id=parent.id, relationship="Mother"))
    db_session.add(StudentParent(student_id=2, parent_id=parent.id, relationship="Mother"))
    db_session.commit()

    headers = auth_header(p_user.id, "parent")
    res = client.get("/learn/parent/children", headers=headers)
    assert res.status_code == 200
    child_ids = {c["id"] for c in res.json()}
    assert child_ids == {1, 2}

    # Can access both children's progress
    assert client.get("/learn/parent/progress/1", headers=headers).status_code == 200
    assert client.get("/learn/parent/progress/2", headers=headers).status_code == 200


# 5. Parent A cannot see Parent B's child
def test_parent_a_cannot_see_parent_b_child(client, db_session):
    uid = uuid.uuid4().hex[:6]
    p_b_user = User(username=f"par_b_{uid}", password_hash="dummy", role=Role.PARENT, is_active=True)
    db_session.add(p_b_user)
    db_session.flush()
    parent_b = Parent(user_id=p_b_user.id, parent_id=f"PAR-B-{uid}", name="Parent B")
    db_session.add(parent_b)
    db_session.flush()

    s_c_user = User(username=f"stu_c_{uid}", password_hash="dummy", role=Role.STUDENT, is_active=True)
    db_session.add(s_c_user)
    db_session.flush()
    child_3 = Student(user_id=s_c_user.id, student_id=f"STU-C-{uid}", name="Child Three", class_="3rd Year", section="A")
    db_session.add(child_3)
    db_session.flush()

    db_session.add(StudentParent(student_id=child_3.id, parent_id=parent_b.id, relationship="Mother"))
    db_session.commit()

    # Parent 1 (User id 5) tries to access Child 3
    headers_p1 = auth_header(5, "parent")
    res = client.get(f"/learn/parent/progress/{child_3.id}", headers=headers_p1)
    assert res.status_code == 403


# 6. Parent with zero children receives empty state
def test_parent_with_zero_children_receives_empty_state(client, db_session):
    uid = uuid.uuid4().hex[:6]
    p_empty_user = User(username=f"par_emp_{uid}", password_hash="dummy", role=Role.PARENT, is_active=True)
    db_session.add(p_empty_user)
    db_session.flush()
    p_empty = Parent(user_id=p_empty_user.id, parent_id=f"PAR-EMP-{uid}", name="Empty Parent")
    db_session.add(p_empty)
    db_session.commit()

    headers = auth_header(p_empty_user.id, "parent")
    res = client.get("/learn/parent/children", headers=headers)
    assert res.status_code == 200
    assert res.json() == []

    # Attempting progress without linked children returns 404
    res_prog = client.get("/learn/parent/progress", headers=headers)
    assert res_prog.status_code == 404

    # Parent with 0 children requesting any student ID returns 403
    res_unlinked = client.get("/learn/parent/progress/1", headers=headers)
    assert res_unlinked.status_code == 403
    assert "not linked" in res_unlinked.json()["detail"].lower()


# 7. Parent cannot access teacher analytics
def test_parent_cannot_access_teacher_analytics(client):
    headers = auth_header(5, "parent")

    res = client.get("/learn/teacher/class-performance", headers=headers)
    assert res.status_code == 403
    assert "restricted to teachers" in res.json()["detail"].lower()


# 8. Parent cannot access another parent's data or progress
def test_parent_cannot_access_another_parents_data(client):
    # Student 2 is not linked to Parent 1 (User id 5)
    headers = auth_header(5, "parent")
    res = client.get("/learn/parent/progress/2", headers=headers)
    assert res.status_code == 403
    assert "not linked" in res.json()["detail"].lower()


# 9. Parent cannot manipulate student_id to bypass authorization
def test_parent_cannot_manipulate_student_id_to_bypass_authorization(client):
    headers = auth_header(5, "parent")

    # Non-existent or spoofed ID
    res = client.get("/learn/parent/progress/99999", headers=headers)
    assert res.status_code == 403
    assert "not linked" in res.json()["detail"].lower()

    # Student 2's ID
    res2 = client.get("/learn/parent/progress/2", headers=headers)
    assert res2.status_code == 403
    assert "not linked" in res2.json()["detail"].lower()

    # Arbitrary unlinked string ID
    res3 = client.get("/learn/parent/progress/unlinked-student-99", headers=headers)
    assert res3.status_code == 403
    assert "not linked" in res3.json()["detail"].lower()


# 10. Student cannot access parent endpoints
def test_student_cannot_access_parent_endpoints(client):
    headers = auth_header(2, "student")

    res1 = client.get("/learn/parent/children", headers=headers)
    assert res1.status_code == 403

    res2 = client.get("/learn/parent/progress", headers=headers)
    assert res2.status_code == 403


# 11. Teacher authorization remains unchanged
def test_teacher_authorization_remains_unchanged(client):
    headers = auth_header(4, "teacher")

    # Teacher cannot access parent children endpoint
    res_parent = client.get("/learn/parent/children", headers=headers)
    assert res_parent.status_code == 403

    # Teacher CAN access teacher class performance
    res_teacher = client.get("/learn/teacher/class-performance", headers=headers)
    assert res_teacher.status_code == 200
    assert res_teacher.json()["role"] == "teacher"
    assert "students" in res_teacher.json()


# 12. Admin authorization remains unchanged
def test_admin_authorization_remains_unchanged(client):
    headers = auth_header(1, "admin")

    # Admin cannot access teacher/observer endpoint on learning portal
    res_t = client.get("/learn/teacher/class-performance", headers=headers)
    assert res_t.status_code == 403

    # Admin has access to admin portal endpoints
    res_admin = client.get("/admin/students", headers=headers)
    assert res_admin.status_code == 200


# 13. Multi-parent strict isolation: Parent A -> Student A & B, Parent B -> Student C
def test_strict_multi_parent_child_isolation(client, db_session):
    uid = uuid.uuid4().hex[:6]

    # Create Student A, Student B, Student C
    user_a = User(username=f"stu_a_{uid}", password_hash="dummy", role=Role.STUDENT, is_active=True)
    user_b = User(username=f"stu_b_{uid}", password_hash="dummy", role=Role.STUDENT, is_active=True)
    user_c = User(username=f"stu_c_{uid}", password_hash="dummy", role=Role.STUDENT, is_active=True)
    db_session.add_all([user_a, user_b, user_c])
    db_session.flush()

    stu_a = Student(user_id=user_a.id, student_id=f"STU-A-{uid}", name="Student Alpha", class_="3rd Year", section="A")
    stu_b = Student(user_id=user_b.id, student_id=f"STU-B-{uid}", name="Student Beta", class_="3rd Year", section="B")
    stu_c = Student(user_id=user_c.id, student_id=f"STU-C-{uid}", name="Student Gamma", class_="3rd Year", section="C")
    db_session.add_all([stu_a, stu_b, stu_c])
    db_session.flush()

    # Create Parent A and Parent B
    p_a_user = User(username=f"par_a_{uid}", password_hash="dummy", role=Role.PARENT, is_active=True)
    p_b_user = User(username=f"par_b_{uid}", password_hash="dummy", role=Role.PARENT, is_active=True)
    db_session.add_all([p_a_user, p_b_user])
    db_session.flush()

    par_a = Parent(user_id=p_a_user.id, parent_id=f"PAR-A-{uid}", name="Parent Alpha")
    par_b = Parent(user_id=p_b_user.id, parent_id=f"PAR-B-{uid}", name="Parent Beta")
    db_session.add_all([par_a, par_b])
    db_session.flush()

    # Link:
    # Parent A -> Student A
    # Parent A -> Student B
    # Parent B -> Student C
    db_session.add(StudentParent(student_id=stu_a.id, parent_id=par_a.id, relationship="Mother"))
    db_session.add(StudentParent(student_id=stu_b.id, parent_id=par_a.id, relationship="Mother"))
    db_session.add(StudentParent(student_id=stu_c.id, parent_id=par_b.id, relationship="Father"))
    db_session.commit()

    headers_a = auth_header(p_a_user.id, "parent")
    headers_b = auth_header(p_b_user.id, "parent")

    # Parent A sees exactly Student A and Student B, NEVER Student C
    res_a = client.get("/learn/parent/children", headers=headers_a)
    assert res_a.status_code == 200
    children_a = res_a.json()
    assert len(children_a) == 2
    child_ids_a = {c["id"] for c in children_a}
    assert child_ids_a == {stu_a.id, stu_b.id}
    assert stu_c.id not in child_ids_a

    # Parent B sees exactly Student C, NEVER Student A or Student B
    res_b = client.get("/learn/parent/children", headers=headers_b)
    assert res_b.status_code == 200
    children_b = res_b.json()
    assert len(children_b) == 1
    assert children_b[0]["id"] == stu_c.id

    # Parent A can access Student A and Student B progress
    assert client.get(f"/learn/parent/progress/{stu_a.id}", headers=headers_a).status_code == 200
    assert client.get(f"/learn/parent/progress/{stu_b.id}", headers=headers_a).status_code == 200

    # Parent A CANNOT access Student C progress -> 403 Forbidden
    res_a_c = client.get(f"/learn/parent/progress/{stu_c.id}", headers=headers_a)
    assert res_a_c.status_code == 403
    assert "not linked" in res_a_c.json()["detail"].lower()

    # Parent B CANNOT access Student A or Student B progress -> 403 Forbidden
    assert client.get(f"/learn/parent/progress/{stu_a.id}", headers=headers_b).status_code == 403
    assert client.get(f"/learn/parent/progress/{stu_b.id}", headers=headers_b).status_code == 403

    # Parent B CAN access Student C progress
    assert client.get(f"/learn/parent/progress/{stu_c.id}", headers=headers_b).status_code == 200
