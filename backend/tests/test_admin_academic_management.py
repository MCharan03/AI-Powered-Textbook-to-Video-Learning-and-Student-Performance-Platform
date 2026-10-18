import pytest
from app.models.models import User, Student, Parent, Teacher, Subject, Chapter, Topic, Subtopic, Role
from tests.conftest import make_auth_header


@pytest.fixture
def auth_headers():
    return {
        "admin": make_auth_header(1, "admin"),
        "student": make_auth_header(2, "student"),
        "teacher": make_auth_header(4, "teacher"),
        "parent": make_auth_header(5, "parent"),
    }


# ============================================================================
# 1. Student CRUD & Server-side Search / Pagination
# ============================================================================
def test_admin_student_crud_and_search_pagination(client, auth_headers):
    admin_h = auth_headers["admin"]

    # 1. Create Student
    student_payload = {
        "student_id": "TEST_STU_101",
        "name": "David Miller",
        "dob": "2005-04-12",
        "class": "12th Grade",
        "section": "A",
        "roll_number": "42",
        "email": "david.miller@example.com",
        "phone": "+1-555-0199",
        "password": "DavidSecretPass123!"
    }
    res_create = client.post("/admin/students", headers=admin_h, json=student_payload)
    assert res_create.status_code == 201
    created = res_create.json()
    assert created["student_id"] == "TEST_STU_101"
    assert created["name"] == "David Miller"
    assert created["is_active"] is True
    assert "password" not in created
    assert "password_hash" not in created
    stu_id = created["id"]

    # Student can log in with student_id + password
    res_login = client.post("/auth/login", json={"username": "TEST_STU_101", "password": "DavidSecretPass123!"})
    assert res_login.status_code == 200
    assert res_login.json()["role"] == "student"

    # 2. Duplicate student_id rejection
    res_dup = client.post("/admin/students", headers=admin_h, json=student_payload)
    assert res_dup.status_code == 400
    assert "already registered" in res_dup.json()["detail"]

    # 3. Get Student Detail
    res_get = client.get(f"/admin/students/{stu_id}", headers=admin_h)
    assert res_get.status_code == 200
    detail = res_get.json()
    assert detail["id"] == stu_id
    assert detail["student_id"] == "TEST_STU_101"
    assert "parents" in detail
    assert "teachers" in detail
    assert "subjects" in detail

    # 4. Filter & Search Students (Server-side)
    res_search = client.get("/admin/students?student_id=TEST_STU_101", headers=admin_h)
    assert res_search.status_code == 200
    paged = res_search.json()
    assert paged["total"] >= 1
    assert any(s["student_id"] == "TEST_STU_101" for s in paged["items"])

    res_search_class = client.get("/admin/students?class=12th Grade&section=A", headers=admin_h)
    assert res_search_class.status_code == 200
    assert any(s["student_id"] == "TEST_STU_101" for s in res_search_class.json()["items"])

    # 5. Pagination structure verification
    res_page = client.get("/admin/students?page=1&page_size=2", headers=admin_h)
    assert res_page.status_code == 200
    pdata = res_page.json()
    assert pdata["page"] == 1
    assert pdata["page_size"] == 2
    assert pdata["total"] >= 1
    assert pdata["total_pages"] >= 1
    assert len(pdata["items"]) <= 2

    # 6. Update Student
    res_update = client.put(f"/admin/students/{stu_id}", headers=admin_h, json={
        "name": "David M. Miller Jr.",
        "section": "B",
        "roll_number": "43"
    })
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "David M. Miller Jr."
    assert res_update.json()["section"] == "B"

    # 7. Soft Delete (Deactivate)
    res_del = client.delete(f"/admin/students/{stu_id}", headers=admin_h)
    assert res_del.status_code == 200
    assert res_del.json()["is_active"] is False

    # Login fails for deactivated account
    res_login_deact = client.post("/auth/login", json={"username": "TEST_STU_101", "password": "DavidSecretPass123!"})
    assert res_login_deact.status_code == 401
    assert "inactive" in res_login_deact.json()["detail"].lower()


# ============================================================================
# 2. Parent CRUD & Multiple Parents per Student
# ============================================================================
def test_admin_parent_crud_and_student_linking(client, auth_headers):
    admin_h = auth_headers["admin"]

    # 1. Create Student for linking
    res_stu = client.post("/admin/students", headers=admin_h, json={
        "student_id": "STU_FAMILY_01",
        "name": "Emma Watson",
        "class": "10th",
        "password": "EmmaPass123!"
    })
    stu_id = res_stu.json()["id"]

    # 2. Create Father
    res_father = client.post("/admin/parents", headers=admin_h, json={
        "parent_id": "PAR_FATHER_01",
        "name": "John Watson",
        "email": "john.watson@example.com",
        "phone": "+1-555-0301",
        "password": "FatherPass123!"
    })
    assert res_father.status_code == 201
    father_id = res_father.json()["id"]

    # 3. Create Mother
    res_mother = client.post("/admin/parents", headers=admin_h, json={
        "parent_id": "PAR_MOTHER_01",
        "name": "Mary Watson",
        "email": "mary.watson@example.com",
        "phone": "+1-555-0302",
        "password": "MotherPass123!"
    })
    assert res_mother.status_code == 201
    mother_id = res_mother.json()["id"]

    # Parent login verification
    res_login_par = client.post("/auth/login", json={"username": "PAR_FATHER_01", "password": "FatherPass123!"})
    assert res_login_par.status_code == 200
    assert res_login_par.json()["role"] == "parent"

    # 4. Link Student -> Father
    res_link_f = client.post(f"/admin/students/{stu_id}/parents", headers=admin_h, json={
        "parent_id": father_id,
        "relationship": "Father"
    })
    assert res_link_f.status_code == 201
    assert res_link_f.json()["relationship"] == "Father"

    # 5. Link Student -> Mother (Multiple parents per student)
    res_link_m = client.post(f"/admin/students/{stu_id}/parents", headers=admin_h, json={
        "parent_id": "PAR_MOTHER_01",  # Test using string parent_id
        "relationship": "Mother"
    })
    assert res_link_m.status_code == 201
    assert res_link_m.json()["relationship"] == "Mother"

    # 6. Prevent Duplicate Student-Parent Link
    res_dup_link = client.post(f"/admin/students/{stu_id}/parents", headers=admin_h, json={
        "parent_id": father_id,
        "relationship": "Father"
    })
    assert res_dup_link.status_code == 400
    assert "already linked" in res_dup_link.json()["detail"]

    # 7. Verify Student parents list has both Father and Mother
    res_parents_list = client.get(f"/admin/students/{stu_id}/parents", headers=admin_h)
    assert res_parents_list.status_code == 200
    linked = res_parents_list.json()
    assert len(linked) == 2
    relationships = {p["relationship"] for p in linked}
    assert "Father" in relationships
    assert "Mother" in relationships

    # 8. Parent linked to multiple students
    res_stu2 = client.post("/admin/students", headers=admin_h, json={
        "student_id": "STU_FAMILY_02",
        "name": "Leo Watson",
        "class": "8th",
        "password": "LeoPass123!"
    })
    stu2_id = res_stu2.json()["id"]

    res_link_sibling = client.post(f"/admin/students/{stu2_id}/parents", headers=admin_h, json={
        "parent_id": father_id,
        "relationship": "Father"
    })
    assert res_link_sibling.status_code == 201

    # Verify father's detail shows both children
    res_par_detail = client.get(f"/admin/parents/{father_id}", headers=admin_h)
    assert res_par_detail.status_code == 200
    assert res_par_detail.json()["linked_students_count"] == 2

    # 9. Unlink Parent
    res_unlink = client.delete(f"/admin/students/{stu_id}/parents/{father_id}", headers=admin_h)
    assert res_unlink.status_code == 200
    res_parents_after = client.get(f"/admin/students/{stu_id}/parents", headers=admin_h)
    assert len(res_parents_after.json()) == 1


# ============================================================================
# 3. Teacher CRUD & Student Assignment
# ============================================================================
def test_admin_teacher_crud_and_student_assignment(client, auth_headers):
    admin_h = auth_headers["admin"]

    # 1. Create Teacher
    res_tch = client.post("/admin/teachers", headers=admin_h, json={
        "teacher_id": "TCH_MATH_01",
        "name": "Prof. Alan Turing",
        "email": "alan.turing@example.com",
        "phone": "+1-555-0400",
        "password": "TuringPass123!"
    })
    assert res_tch.status_code == 201
    tch_id = res_tch.json()["id"]

    # Teacher login verification
    res_login_tch = client.post("/auth/login", json={"username": "TCH_MATH_01", "password": "TuringPass123!"})
    assert res_login_tch.status_code == 200
    assert res_login_tch.json()["role"] == "teacher"

    # 2. Create Students to assign
    res_s1 = client.post("/admin/students", headers=admin_h, json={
        "student_id": "STU_TCH_01", "name": "Student Alpha", "password": "P123!"
    })
    res_s2 = client.post("/admin/students", headers=admin_h, json={
        "student_id": "STU_TCH_02", "name": "Student Beta", "password": "P123!"
    })
    s1_id = res_s1.json()["id"]
    s2_id = res_s2.json()["id"]

    # 3. Assign students to teacher
    res_as1 = client.post(f"/admin/teachers/{tch_id}/students", headers=admin_h, json={"student_id": s1_id})
    assert res_as1.status_code == 201

    res_as2 = client.post(f"/admin/teachers/{tch_id}/students", headers=admin_h, json={"student_id": "STU_TCH_02"})
    assert res_as2.status_code == 201

    # 4. Duplicate assignment rejection
    res_dup = client.post(f"/admin/teachers/{tch_id}/students", headers=admin_h, json={"student_id": s1_id})
    assert res_dup.status_code == 400
    assert "already assigned" in res_dup.json()["detail"]

    # 5. List teacher's students
    res_list = client.get(f"/admin/teachers/{tch_id}/students", headers=admin_h)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 2

    # 6. Unassign student
    res_unassign = client.delete(f"/admin/teachers/{tch_id}/students/{s1_id}", headers=admin_h)
    assert res_unassign.status_code == 200
    assert len(client.get(f"/admin/teachers/{tch_id}/students", headers=admin_h).json()) == 1


# ============================================================================
# 4. Subject, Student-Subject Assignment, Chapter, Topic, Subtopic Hierarchy
# ============================================================================
def test_admin_academic_curriculum_hierarchy_crud(client, auth_headers):
    admin_h = auth_headers["admin"]

    # 1. Create Subject
    res_subj = client.post("/admin/subjects", headers=admin_h, json={
        "name": "Advanced Physics",
        "description": "Classical and Quantum Mechanics",
        "class": "11th Grade"
    })
    assert res_subj.status_code == 201
    subj = res_subj.json()
    assert subj["name"] == "Advanced Physics"
    assert subj["created_by"] == 1  # Automatically set to authenticated Admin
    subj_id = subj["id"]

    # 2. Assign Subject to Student
    res_stu = client.post("/admin/students", headers=admin_h, json={
        "student_id": "STU_PHYS_01", "name": "Physics Scholar", "password": "P123!"
    })
    stu_id = res_stu.json()["id"]

    res_assign_subj = client.post(f"/admin/students/{stu_id}/subjects", headers=admin_h, json={"subject_id": subj_id})
    assert res_assign_subj.status_code == 201
    assert res_assign_subj.json()["name"] == "Advanced Physics"

    # Duplicate subject assignment rejection
    res_dup_subj = client.post(f"/admin/students/{stu_id}/subjects", headers=admin_h, json={"subject_id": subj_id})
    assert res_dup_subj.status_code == 400

    # 3. Create Chapters
    res_ch1 = client.post(f"/admin/subjects/{subj_id}/chapters", headers=admin_h, json={
        "chapter_number": 1,
        "title": "Units and Measurements",
        "description": "Dimensional analysis and errors"
    })
    assert res_ch1.status_code == 201
    ch1_id = res_ch1.json()["id"]

    res_ch2 = client.post(f"/admin/subjects/{subj_id}/chapters", headers=admin_h, json={
        "chapter_number": 2,
        "title": "Motion in a Straight Line",
        "description": "Kinematics and velocity"
    })
    assert res_ch2.status_code == 201
    ch2_id = res_ch2.json()["id"]

    # 4. Create Topics under Chapter 1
    res_top1 = client.post(f"/admin/chapters/{ch1_id}/topics", headers=admin_h, json={
        "sequence_number": 1,
        "title": "SI Units and Standards",
        "description": "Base and derived units"
    })
    assert res_top1.status_code == 201
    top1_id = res_top1.json()["id"]

    res_top2 = client.post(f"/admin/chapters/{ch1_id}/topics", headers=admin_h, json={
        "sequence_number": 2,
        "title": "Dimensional Analysis",
        "description": "Applications of dimensions"
    })
    assert res_top2.status_code == 201

    # 5. Create Subtopics under Topic 1
    res_subtop1 = client.post(f"/admin/topics/{top1_id}/subtopics", headers=admin_h, json={
        "sequence_number": 1,
        "title": "Fundamental Base Quantities",
        "description": "Length, mass, time, current"
    })
    assert res_subtop1.status_code == 201
    subtop1_id = res_subtop1.json()["id"]

    res_subtop2 = client.post(f"/admin/topics/{top1_id}/subtopics", headers=admin_h, json={
        "sequence_number": 2,
        "title": "Derived Units and Conversion",
        "description": "Force, energy, pressure"
    })
    assert res_subtop2.status_code == 201

    # 6. Verify Subject Detail includes Chapters
    res_subj_detail = client.get(f"/admin/subjects/{subj_id}", headers=admin_h)
    assert res_subj_detail.status_code == 200
    subj_data = res_subj_detail.json()
    assert subj_data["chapters_count"] == 2
    assert len(subj_data["chapters"]) == 2

    # 7. Verify Chapter Detail includes Topics
    res_ch_detail = client.get(f"/admin/chapters/{ch1_id}", headers=admin_h)
    assert res_ch_detail.status_code == 200
    ch_data = res_ch_detail.json()
    assert ch_data["topics_count"] == 2
    assert len(ch_data["topics"]) == 2

    # 8. Verify Topic Detail includes Subtopics
    res_top_detail = client.get(f"/admin/topics/{top1_id}", headers=admin_h)
    assert res_top_detail.status_code == 200
    top_data = res_top_detail.json()
    assert top_data["subtopics_count"] == 2
    assert len(top_data["subtopics"]) == 2

    # 9. Update Subtopic
    res_upd_subtop = client.put(f"/admin/subtopics/{subtop1_id}", headers=admin_h, json={
        "title": "Fundamental Base Units (SI 2026)"
    })
    assert res_upd_subtop.status_code == 200
    assert res_upd_subtop.json()["title"] == "Fundamental Base Units (SI 2026)"

    # 10. Delete Subtopic
    res_del_subtop = client.delete(f"/admin/subtopics/{subtop1_id}", headers=admin_h)
    assert res_del_subtop.status_code == 200
    assert client.get(f"/admin/subtopics/{subtop1_id}", headers=admin_h).status_code == 404


# ============================================================================
# 5. Strict RBAC Enforcement: Non-Admin Forbidden
# ============================================================================
def test_admin_endpoints_rbac_strict_rejection(client, auth_headers):
    # Non-admin headers
    student_h = auth_headers["student"]
    teacher_h = auth_headers["teacher"]
    parent_h = auth_headers["parent"]

    admin_endpoints = [
        ("GET", "/admin/students"),
        ("POST", "/admin/students"),
        ("GET", "/admin/parents"),
        ("POST", "/admin/parents"),
        ("GET", "/admin/teachers"),
        ("POST", "/admin/teachers"),
        ("POST", "/admin/subjects"),
        ("PUT", "/admin/subjects/1"),
        ("DELETE", "/admin/subjects/1"),
    ]

    for method, endpoint in admin_endpoints:
        for role_name, headers in [("student", student_h), ("teacher", teacher_h), ("parent", parent_h)]:
            if method == "GET":
                res = client.get(endpoint, headers=headers)
            elif method == "POST":
                res = client.post(endpoint, headers=headers, json={})
            elif method == "PUT":
                res = client.put(endpoint, headers=headers, json={})
            elif method == "DELETE":
                res = client.delete(endpoint, headers=headers)

            assert res.status_code == 403, f"{role_name} should receive 403 on {method} {endpoint}, got {res.status_code}"


# ============================================================================
# 6. Invalid Foreign Key and Resource Not Found Rejection
# ============================================================================
def test_admin_invalid_foreign_key_rejections(client, auth_headers):
    admin_h = auth_headers["admin"]

    # Non-existent student detail
    res_non_stu = client.get("/admin/students/999999", headers=admin_h)
    assert res_non_stu.status_code == 404

    # Non-existent subject detail
    res_non_subj = client.get("/admin/subjects/999999", headers=admin_h)
    assert res_non_subj.status_code == 404

    # Non-existent chapter detail
    res_non_ch = client.get("/admin/chapters/999999", headers=admin_h)
    assert res_non_ch.status_code == 404

    # Non-existent topic detail
    res_non_top = client.get("/admin/topics/999999", headers=admin_h)
    assert res_non_top.status_code == 404

    # Non-existent subtopic detail
    res_non_subtop = client.get("/admin/subtopics/999999", headers=admin_h)
    assert res_non_subtop.status_code == 404

    # Link to non-existent parent
    res_link_non_par = client.post("/admin/students/1/parents", headers=admin_h, json={
        "parent_id": 999999,
        "relationship": "Guardian"
    })
    assert res_link_non_par.status_code == 404
