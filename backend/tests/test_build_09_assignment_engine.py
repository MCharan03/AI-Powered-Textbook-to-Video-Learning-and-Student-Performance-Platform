import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import Base, get_db
from app.models.models import (
    User, Role, Teacher, Student, Parent, Subject, Chapter, Topic,
    TeacherStudent, StudentParent, Assignment, StudentAssignment
)
from app.core.security import create_token, hash_pw




@pytest.fixture(scope="module")
def setup_assignment_data(TestingSession):
    db: Session = TestingSession()

    # Create two teachers: Carol (id=4, Teacher id=1) and Eve (new teacher)
    teacher2_user = User(
        username="teacher2",
        name="Teacher Eve",
        email="eve@example.com",
        password_hash=hash_pw("TeacherPass123!"),
        role=Role.TEACHER,
        is_active=True
    )
    db.add(teacher2_user)
    db.flush()

    teacher2 = Teacher(
        user_id=teacher2_user.id,
        teacher_id="TCH002",
        name="Teacher Eve",
        email="eve@example.com"
    )
    db.add(teacher2)
    db.flush()

    # Create extra student Charlie (assigned only to Teacher Eve)
    charlie_user = User(
        username="charlie",
        name="Student Charlie",
        email="charlie@example.com",
        password_hash=hash_pw("StudentPass123!"),
        role=Role.STUDENT,
        is_active=True
    )
    db.add(charlie_user)
    db.flush()

    student3 = Student(
        user_id=charlie_user.id,
        student_id="CMRIT26ECE003",
        name="Student Charlie",
        email="charlie@example.com"
    )
    db.add(student3)
    db.flush()

    # Link Charlie to Teacher Eve only
    db.add(TeacherStudent(teacher_id=teacher2.id, student_id=student3.id))

    # Create second subject & chapters/topics to test hierarchy validations
    subject_cs = Subject(name="Computer Science", created_by=1)
    subject_chem = Subject(name="Chemistry", created_by=1)
    db.add_all([subject_cs, subject_chem])
    db.flush()

    chapter_arrays = Chapter(
        subject_id=subject_cs.id,
        chapter_number=1,
        title="Arrays & Pointers",
        status="APPROVED"
    )
    chapter_reactions = Chapter(
        subject_id=subject_chem.id,
        chapter_number=1,
        title="Chemical Reactions",
        status="APPROVED"
    )
    db.add_all([chapter_arrays, chapter_reactions])
    db.flush()

    topic_indexing = Topic(
        chapter_id=chapter_arrays.id,
        sequence_number=1,
        title="Zero-Based Indexing",
        status="APPROVED"
    )
    topic_acids = Topic(
        chapter_id=chapter_reactions.id,
        sequence_number=1,
        title="Acids and Bases",
        status="APPROVED"
    )
    db.add_all([topic_indexing, topic_acids])

    # Parent 2: Grace, linked only to Charlie
    parent2_user = User(
        username="parent2",
        name="Parent Grace",
        email="grace@example.com",
        password_hash=hash_pw("ParentPass123!"),
        role=Role.PARENT,
        is_active=True
    )
    db.add(parent2_user)
    db.flush()

    parent2 = Parent(
        user_id=parent2_user.id,
        parent_id="PAR-CMRIT002",
        name="Parent Grace",
        email="grace@example.com"
    )
    db.add(parent2)
    db.flush()
    db.add(StudentParent(student_id=student3.id, parent_id=parent2.id, relationship="Mother"))

    db.commit()

    tokens = {
        "admin": create_token(1, "admin"),
        "teacher1": create_token(4, "teacher"),       # Carol (teacher_id=1)
        "teacher2": create_token(teacher2_user.id, "teacher"), # Eve (teacher_id=2)
        "student1": create_token(2, "student"),       # Alice (student_id=1, assigned to Carol)
        "student2": create_token(3, "student"),       # Bob (student_id=2, assigned to Carol)
        "student3": create_token(charlie_user.id, "student"), # Charlie (student_id=3, assigned to Eve)
        "parent1": create_token(5, "parent"),         # Dave (linked to Alice)
        "parent2": create_token(parent2_user.id, "parent"), # Grace (linked to Charlie)
    }

    data_ids = {
        "subject_cs": subject_cs.id,
        "subject_chem": subject_chem.id,
        "chapter_arrays": chapter_arrays.id,
        "chapter_reactions": chapter_reactions.id,
        "topic_indexing": topic_indexing.id,
        "topic_acids": topic_acids.id,
        "student1_id": 1,
        "student2_id": 2,
        "student3_id": student3.id,
    }

    db.close()
    return tokens, data_ids


# ------------------------------------------------------------------------------
# 1. Teacher can create assignment
# ------------------------------------------------------------------------------
def test_1_teacher_can_create_assignment(client, setup_assignment_data):
    tokens, ids = setup_assignment_data
    due = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    payload = {
        "title": "Array Foundations Homework",
        "description": "Implement zero-based array traversal and calculate total complexity.",
        "subject_id": ids["subject_cs"],
        "chapter_id": ids["chapter_arrays"],
        "topic_id": ids["topic_indexing"],
        "due_date": due,
        "total_points": 100.0,
        "student_ids": [ids["student1_id"], ids["student2_id"]]
    }

    resp = client.post(
        "/api/teacher/assignments",
        json=payload,
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["title"] == "Array Foundations Homework"
    assert data["assigned_count"] == 2
    assert data["submitted_count"] == 0
    assert data["graded_count"] == 0


# ------------------------------------------------------------------------------
# 2. Teacher cannot assign to a student who is not assigned to that teacher
# ------------------------------------------------------------------------------
def test_2_teacher_cannot_assign_unassigned_student(client, setup_assignment_data):
    tokens, ids = setup_assignment_data
    due = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

    # Teacher 1 (Carol) tries to assign to Charlie (student3, who belongs only to Teacher Eve)
    payload = {
        "title": "Unauthorized Assignment",
        "description": "This should fail.",
        "subject_id": ids["subject_cs"],
        "chapter_id": ids["chapter_arrays"],
        "due_date": due,
        "total_points": 50.0,
        "student_ids": [ids["student3_id"]]  # Charlie
    }

    resp = client.post(
        "/api/teacher/assignments",
        json=payload,
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp.status_code == 403
    assert "not assigned" in resp.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 3. Teacher cannot view another teacher's assignment
# ------------------------------------------------------------------------------
def test_3_teacher_cannot_view_another_teachers_assignment(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Teacher 2 (Eve) creates an assignment for Charlie
    due = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    create_resp = client.post(
        "/api/teacher/assignments",
        json={
            "title": "Eve's Private Chemistry Lab",
            "description": "Instructions for Charlie only.",
            "subject_id": ids["subject_chem"],
            "chapter_id": ids["chapter_reactions"],
            "due_date": due,
            "total_points": 80.0,
            "student_ids": [ids["student3_id"]]
        },
        headers={"Authorization": f"Bearer {tokens['teacher2']}"}
    )
    assert create_resp.status_code == 201
    eve_assignment_id = create_resp.json()["id"]

    # Teacher 1 (Carol) tries to view Eve's assignment
    get_resp = client.get(
        f"/api/teacher/assignments/{eve_assignment_id}",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert get_resp.status_code == 403
    assert "permission" in get_resp.json()["detail"].lower() or "forbidden" in get_resp.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 4. Teacher cannot view another teacher's submissions
# ------------------------------------------------------------------------------
def test_4_teacher_cannot_view_another_teachers_submissions(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Teacher 1 creates assignment 1
    # Check that Teacher 2 cannot view Teacher 1's submissions
    t1_list = client.get(
        "/api/teacher/assignments",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    ).json()
    t1_assignment_id = t1_list[0]["id"]

    resp = client.get(
        f"/api/teacher/assignments/{t1_assignment_id}/submissions",
        headers={"Authorization": f"Bearer {tokens['teacher2']}"}
    )
    assert resp.status_code == 403


# ------------------------------------------------------------------------------
# 5. Teacher cannot grade another teacher's assignment
# ------------------------------------------------------------------------------
def test_5_teacher_cannot_grade_another_teachers_assignment(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    t1_list = client.get(
        "/api/teacher/assignments",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    ).json()
    t1_assignment_id = t1_list[0]["id"]

    # Teacher 2 attempts to grade Teacher 1's student
    resp = client.post(
        f"/api/teacher/assignments/{t1_assignment_id}/grade",
        json={
            "student_id": ids["student1_id"],
            "score": 90.0,
            "feedback": "Illegitimate grading attempt."
        },
        headers={"Authorization": f"Bearer {tokens['teacher2']}"}
    )
    assert resp.status_code == 403


# ------------------------------------------------------------------------------
# 6. Student sees only assignments assigned to them
# ------------------------------------------------------------------------------
def test_6_student_sees_only_assigned_assignments(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Student 1 (Alice) check assignments
    resp1 = client.get(
        "/api/student/assignments",
        headers={"Authorization": f"Bearer {tokens['student1']}"}
    )
    assert resp1.status_code == 200
    alice_titles = [a["title"] for a in resp1.json()]
    assert "Array Foundations Homework" in alice_titles
    assert "Eve's Private Chemistry Lab" not in alice_titles

    # Student 3 (Charlie) check assignments
    resp3 = client.get(
        "/api/student/assignments",
        headers={"Authorization": f"Bearer {tokens['student3']}"}
    )
    assert resp3.status_code == 200
    charlie_titles = [a["title"] for a in resp3.json()]
    assert "Eve's Private Chemistry Lab" in charlie_titles
    assert "Array Foundations Homework" not in charlie_titles


# ------------------------------------------------------------------------------
# 7. Student cannot open another student's assignment
# ------------------------------------------------------------------------------
def test_7_student_cannot_open_unassigned_assignment(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Find Eve's assignment id
    t2_list = client.get(
        "/api/teacher/assignments",
        headers={"Authorization": f"Bearer {tokens['teacher2']}"}
    ).json()
    eve_assignment_id = t2_list[0]["id"]

    # Student 1 (Alice) tries to open Eve's assignment (which is for Charlie only)
    resp = client.get(
        f"/api/student/assignments/{eve_assignment_id}",
        headers={"Authorization": f"Bearer {tokens['student1']}"}
    )
    assert resp.status_code == 404


# ------------------------------------------------------------------------------
# 8. Student cannot submit to another student's assignment
# ------------------------------------------------------------------------------
def test_8_student_cannot_submit_to_unassigned_assignment(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    t2_list = client.get(
        "/api/teacher/assignments",
        headers={"Authorization": f"Bearer {tokens['teacher2']}"}
    ).json()
    eve_assignment_id = t2_list[0]["id"]

    resp = client.post(
        f"/api/student/assignments/{eve_assignment_id}/submit",
        json={"submission_text": "Alice hacking into Charlie's assignment"},
        headers={"Authorization": f"Bearer {tokens['student1']}"}
    )
    assert resp.status_code == 404


# ------------------------------------------------------------------------------
# 9. Parent sees only assignments belonging to linked child
# ------------------------------------------------------------------------------
def test_9_parent_sees_only_linked_child_assignments(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Parent 1 (Dave, linked to Alice)
    resp1 = client.get(
        f"/api/parent/children/{ids['student1_id']}/assignments",
        headers={"Authorization": f"Bearer {tokens['parent1']}"}
    )
    assert resp1.status_code == 200
    dave_titles = [a["title"] for a in resp1.json()]
    assert "Array Foundations Homework" in dave_titles
    assert "Eve's Private Chemistry Lab" not in dave_titles


# ------------------------------------------------------------------------------
# 10. Parent cannot access unrelated student's assignments
# ------------------------------------------------------------------------------
def test_10_parent_cannot_access_unrelated_student_assignments(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Parent 1 (Dave) tries to access Charlie's assignments (student3)
    resp = client.get(
        f"/api/parent/children/{ids['student3_id']}/assignments",
        headers={"Authorization": f"Bearer {tokens['parent1']}"}
    )
    assert resp.status_code == 403
    assert "not linked" in resp.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 11. Parent cannot modify assignments
# ------------------------------------------------------------------------------
def test_11_parent_cannot_modify_assignments(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Parent tries to call create assignment
    resp = client.post(
        "/api/teacher/assignments",
        json={"title": "Parent rogue assignment", "subject_id": 1, "chapter_id": 1, "student_ids": [1]},
        headers={"Authorization": f"Bearer {tokens['parent1']}"}
    )
    assert resp.status_code == 403

    # Parent tries to submit assignment
    resp_sub = client.post(
        "/api/student/assignments/1/submit",
        json={"submission_text": "Parent doing homework"},
        headers={"Authorization": f"Bearer {tokens['parent1']}"}
    )
    assert resp_sub.status_code == 403


# ------------------------------------------------------------------------------
# 12. Student cannot grade assignment
# ------------------------------------------------------------------------------
def test_12_student_cannot_grade_assignment(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    t1_list = client.get(
        "/api/teacher/assignments",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    ).json()
    t1_assignment_id = t1_list[0]["id"]

    resp = client.post(
        f"/api/teacher/assignments/{t1_assignment_id}/grade",
        json={"student_id": ids["student1_id"], "score": 100.0, "feedback": "Self-grading!"},
        headers={"Authorization": f"Bearer {tokens['student1']}"}
    )
    assert resp.status_code == 403


# ------------------------------------------------------------------------------
# 13. Invalid Subject -> Chapter relationship is rejected
# ------------------------------------------------------------------------------
def test_13_invalid_subject_chapter_relationship_rejected(client, setup_assignment_data):
    tokens, ids = setup_assignment_data
    due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    # Pair Subject CS with Chapter Chemical Reactions (which belongs to Subject Chem)
    payload = {
        "title": "Mismatched Subject and Chapter",
        "subject_id": ids["subject_cs"],
        "chapter_id": ids["chapter_reactions"],  # Invalid!
        "due_date": due,
        "total_points": 100.0,
        "student_ids": [ids["student1_id"]]
    }

    resp = client.post(
        "/api/teacher/assignments",
        json=payload,
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 14. Invalid Chapter -> Topic relationship is rejected
# ------------------------------------------------------------------------------
def test_14_invalid_chapter_topic_relationship_rejected(client, setup_assignment_data):
    tokens, ids = setup_assignment_data
    due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    # Pair Chapter Arrays with Topic Acids and Bases (which belongs to Chapter Reactions)
    payload = {
        "title": "Mismatched Chapter and Topic",
        "subject_id": ids["subject_cs"],
        "chapter_id": ids["chapter_arrays"],
        "topic_id": ids["topic_acids"],  # Invalid!
        "due_date": due,
        "total_points": 100.0,
        "student_ids": [ids["student1_id"]]
    }

    resp = client.post(
        "/api/teacher/assignments",
        json=payload,
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 15. Score validation works (rejects < 0 or > max score)
# ------------------------------------------------------------------------------
def test_15_score_validation_enforces_bounds(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    t1_list = client.get(
        "/api/teacher/assignments",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    ).json()
    assign_id = t1_list[0]["id"]

    # Student 1 submits work
    client.post(
        f"/api/student/assignments/{assign_id}/submit",
        json={"submission_text": "Here is my code for array indexing."},
        headers={"Authorization": f"Bearer {tokens['student1']}"}
    )

    # Try score > total_points (100) -> 105.0
    resp_over = client.post(
        f"/api/teacher/assignments/{assign_id}/grade",
        json={"student_id": ids["student1_id"], "score": 105.0, "feedback": "Over maximum!"},
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp_over.status_code == 400
    assert "between 0.0 and 100.0" in resp_over.json()["detail"]

    # Try negative score -> -5.0
    resp_neg = client.post(
        f"/api/teacher/assignments/{assign_id}/grade",
        json={"student_id": ids["student1_id"], "score": -5.0, "feedback": "Negative score!"},
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp_neg.status_code == 422 or resp_neg.status_code == 400

    # Valid score -> 85.0
    resp_valid = client.post(
        f"/api/teacher/assignments/{assign_id}/grade",
        json={"student_id": ids["student1_id"], "score": 85.0, "feedback": "Good work on zero-based indexing."},
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["score"] == 85.0
    assert resp_valid.json()["status"] == "GRADED"


# ------------------------------------------------------------------------------
# 16. Due date and Late status works
# ------------------------------------------------------------------------------
def test_16_due_date_late_status_calculation(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Teacher 1 creates an assignment with an overdue due date (1 day ago)
    past_due = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    create_resp = client.post(
        "/api/teacher/assignments",
        json={
            "title": "Late Submission Practice",
            "description": "Submit past due date.",
            "subject_id": ids["subject_cs"],
            "chapter_id": ids["chapter_arrays"],
            "due_date": past_due,
            "total_points": 50.0,
            "student_ids": [ids["student2_id"]]
        },
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert create_resp.status_code == 201
    late_assign_id = create_resp.json()["id"]

    # Student 2 checks assignment detail -> status should show OVERDUE
    detail_resp = client.get(
        f"/api/student/assignments/{late_assign_id}",
        headers={"Authorization": f"Bearer {tokens['student2']}"}
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "OVERDUE" or detail_resp.json()["is_overdue"] is True

    # Student 2 submits -> status should become LATE
    submit_resp = client.post(
        f"/api/student/assignments/{late_assign_id}/submit",
        json={"submission_text": "Submitting my late solution."},
        headers={"Authorization": f"Bearer {tokens['student2']}"}
    )
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "LATE"

    # Teacher views submissions -> should reflect status LATE and is_late = True
    subs_resp = client.get(
        f"/api/teacher/assignments/{late_assign_id}/submissions",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    )
    assert subs_resp.status_code == 200
    sub_item = subs_resp.json()[0]
    assert sub_item["status"] == "LATE"
    assert sub_item["is_late"] is True


# ------------------------------------------------------------------------------
# 17. Dashboard summaries reflect real database numbers
# ------------------------------------------------------------------------------
def test_17_dashboard_summaries(client, setup_assignment_data):
    tokens, ids = setup_assignment_data

    # Teacher summary
    t_sum = client.get(
        "/api/teacher/assignments-summary",
        headers={"Authorization": f"Bearer {tokens['teacher1']}"}
    ).json()
    assert t_sum["total_assignments"] >= 2
    assert t_sum["graded"] >= 1

    # Student summary
    s_sum = client.get(
        "/api/student/assignments-summary",
        headers={"Authorization": f"Bearer {tokens['student1']}"}
    ).json()
    assert "pending_assignments" in s_sum
    assert s_sum["graded"] >= 1

    # Parent summary
    p_sum = client.get(
        "/api/parent/assignments-summary",
        headers={"Authorization": f"Bearer {tokens['parent1']}"}
    ).json()
    assert "pending" in p_sum
    assert p_sum["graded"] >= 1


# ------------------------------------------------------------------------------
# 18. End-to-End Acceptance Test (Requirement 20)
# ------------------------------------------------------------------------------
def test_18_full_acceptance_workflow(client, setup_assignment_data, TestingSession):
    tokens, ids = setup_assignment_data
    db: Session = TestingSession()

    # ADMIN: Create/verify Data Structures -> Arrays -> Array Basics
    subject = db.query(Subject).filter(Subject.name == "Data Structures").first()
    if not subject:
        subject = Subject(name="Data Structures", description="Core DS curriculum", created_by=1)
        db.add(subject)
        db.flush()

    chapter = db.query(Chapter).filter(Chapter.subject_id == subject.id, Chapter.title == "Arrays").first()
    if not chapter:
        chapter = Chapter(subject_id=subject.id, chapter_number=1, title="Arrays", status="APPROVED")
        db.add(chapter)
        db.flush()

    topic = db.query(Topic).filter(Topic.chapter_id == chapter.id, Topic.title == "Array Basics").first()
    if not topic:
        topic = Topic(chapter_id=chapter.id, sequence_number=1, title="Array Basics", status="APPROVED")
        db.add(topic)
        db.commit()
    else:
        db.commit()

    subject_id = subject.id
    chapter_id = chapter.id
    topic_id = topic.id
    db.close()

    teacher_headers = {"Authorization": f"Bearer {tokens['teacher1']}"}
    student_headers = {"Authorization": f"Bearer {tokens['student1']}"}
    parent_headers = {"Authorization": f"Bearer {tokens['parent1']}"}
    other_teacher_headers = {"Authorization": f"Bearer {tokens['teacher2']}"}
    other_student_headers = {"Authorization": f"Bearer {tokens['student3']}"}
    other_parent_headers = {"Authorization": f"Bearer {tokens['parent2']}"}

    # 1. TEACHER: Create Assignment "Array Implementation Practice"
    due_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    create_payload = {
        "title": "Array Implementation Practice",
        "subject_id": subject_id,
        "chapter_id": chapter_id,
        "topic_id": topic_id,
        "description": "Implement basic array operations and explain zero-based indexing.",
        "due_date": due_date,
        "total_points": 100.0,
        "student_ids": [ids["student1_id"]]  # Assign to Student A (Alice)
    }

    res = client.post("/api/teacher/assignments", json=create_payload, headers=teacher_headers)
    assert res.status_code == 201, res.text
    assignment = res.json()
    assignment_id = assignment["id"]
    assert assignment["title"] == "Array Implementation Practice"
    assert assignment["subject_name"] == "Data Structures"
    assert assignment["chapter_title"] == "Arrays"
    assert assignment["topic_title"] == "Array Basics"
    assert assignment["total_points"] == 100.0

    # 2. STUDENT: Login as Student A (Alice)
    # Verify assignment appears
    res = client.get("/api/student/assignments", headers=student_headers)
    assert res.status_code == 200
    my_assignments = res.json()
    matched = [a for a in my_assignments if a["assignment_id"] == assignment_id]
    assert len(matched) == 1
    assert matched[0]["status"] == "PENDING"
    assert matched[0]["title"] == "Array Implementation Practice"

    # Open assignment (transitions PENDING -> IN_PROGRESS)
    res = client.get(f"/api/student/assignments/{assignment_id}", headers=student_headers)
    assert res.status_code == 200
    detail = res.json()
    assert detail["status"] == "IN_PROGRESS"

    # Submit work
    submit_payload = {
        "submission_text": "Here is my array implementation with insert, delete, and zero-based indexing explanations."
    }
    res = client.post(f"/api/student/assignments/{assignment_id}/submit", json=submit_payload, headers=student_headers)
    assert res.status_code == 200
    sub_res = res.json()
    # Verify: Status = SUBMITTED
    assert sub_res["status"] == "SUBMITTED"
    assert sub_res["submitted_at"] is not None

    # 3. TEACHER: Login again, open assignment, verify Student A submission appears
    res = client.get(f"/api/teacher/assignments/{assignment_id}/submissions", headers=teacher_headers)
    assert res.status_code == 200
    submissions = res.json()
    student_sub = next((s for s in submissions if s["student_id"] == ids["student1_id"]), None)
    assert student_sub is not None
    assert student_sub["status"] == "SUBMITTED"
    assert "array implementation" in student_sub["submission_text"]

    # Grade: 85/100, Feedback: "Good work. Review zero-based indexing."
    grade_payload = {
        "student_id": ids["student1_id"],
        "score": 85.0,
        "feedback": "Good work. Review zero-based indexing."
    }
    res = client.post(f"/api/teacher/assignments/{assignment_id}/grade", json=grade_payload, headers=teacher_headers)
    assert res.status_code == 200
    graded_info = res.json()
    # Verify: Status = GRADED
    assert graded_info["status"] == "GRADED"
    assert graded_info["score"] == 85.0
    assert graded_info["feedback"] == "Good work. Review zero-based indexing."

    # 4. STUDENT: Login again, verify Score = 85/100 and Feedback visible
    res = client.get(f"/api/student/assignments/{assignment_id}", headers=student_headers)
    assert res.status_code == 200
    student_view = res.json()
    assert student_view["status"] == "GRADED"
    assert student_view["score"] == 85.0
    assert student_view["feedback"] == "Good work. Review zero-based indexing."

    # 5. PARENT: Login as the parent linked to Student A (Dave)
    # Verify assignment appears, score = 85/100, feedback visible
    res = client.get(f"/api/parent/children/{ids['student1_id']}/assignments", headers=parent_headers)
    assert res.status_code == 200
    parent_assigns = res.json()
    matched_parent = next((a for a in parent_assigns if a["assignment_id"] == assignment_id), None)
    assert matched_parent is not None
    assert matched_parent["score"] == 85.0
    assert matched_parent["total_points"] == 100.0
    assert matched_parent["status"] == "GRADED"
    assert matched_parent["feedback"] == "Good work. Review zero-based indexing."

    # Verify no unrelated student's assignment is visible to Parent A
    res_parent_unrelated = client.get(f"/api/parent/children/{ids['student3_id']}/assignments", headers=parent_headers)
    assert res_parent_unrelated.status_code == 403

    # 6. SECURITY: Attempt to access unauthorized resources
    # - Another student (Charlie) cannot access Student A's assignment
    res_sec_student = client.get(f"/api/student/assignments/{assignment_id}", headers=other_student_headers)
    assert res_sec_student.status_code in (403, 404)

    # - Another student cannot submit to Student A's assignment
    res_sec_sub = client.post(f"/api/student/assignments/{assignment_id}/submit", json={"submission_text": "Breach"}, headers=other_student_headers)
    assert res_sec_sub.status_code in (403, 404)

    # - Another teacher (Eve) cannot view Teacher A's assignment
    res_sec_teacher = client.get(f"/api/teacher/assignments/{assignment_id}", headers=other_teacher_headers)
    assert res_sec_teacher.status_code in (403, 404)

    # - Another teacher cannot view Teacher A's submissions
    res_sec_subs = client.get(f"/api/teacher/assignments/{assignment_id}/submissions", headers=other_teacher_headers)
    assert res_sec_subs.status_code in (403, 404)

    # - Another teacher cannot grade Teacher A's assignment
    res_sec_grade = client.post(f"/api/teacher/assignments/{assignment_id}/grade", json={"student_id": ids["student1_id"], "score": 100.0}, headers=other_teacher_headers)
    assert res_sec_grade.status_code in (403, 404)

    # - Another parent (Grace) cannot view Student A's assignments
    res_sec_parent = client.get(f"/api/parent/children/{ids['student1_id']}/assignments", headers=other_parent_headers)
    assert res_sec_parent.status_code in (403, 404)

