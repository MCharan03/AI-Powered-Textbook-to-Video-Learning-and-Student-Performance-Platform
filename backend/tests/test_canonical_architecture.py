import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.exc import IntegrityError
from app.models.models import (
    User, Student, Parent, Teacher, StudentParent, TeacherStudent,
    Subject, StudentSubject, Chapter, Topic, Subtopic, Video,
    Quiz, Question, QuizAttempt, StudentVideoProgress,
    StudentTopicPerformance, Assignment, StudentAssignment,
    ProcessingJob, Role, VideoStatus, MasteryLevel, QuestionType
)
from app.core.security import hash_pw, create_token, verify_pw
from conftest import make_auth_header


# ============================================================================
# 1. User Creation
# ============================================================================
def test_01_user_creation(db_session):
    u = User(
        username="unique_user_01",
        password_hash=hash_pw("Password123!"),
        role=Role.STUDENT,
        is_active=True
    )
    db_session.add(u)
    db_session.commit()
    assert u.id is not None
    assert u.username == "unique_user_01"
    assert verify_pw("Password123!", u.password_hash)

    # Unique constraint test
    duplicate_u = User(
        username="unique_user_01",
        password_hash=hash_pw("Another123!"),
        role=Role.STUDENT
    )
    db_session.add(duplicate_u)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 2. Student Creation
# ============================================================================
def test_02_student_creation(db_session):
    u = User(username="cmrit_stu_01", password_hash=hash_pw("Pass123!"), role=Role.STUDENT)
    db_session.add(u)
    db_session.flush()

    student = Student(
        user_id=u.id,
        student_id="CMRIT26ECE099",
        name="Rohit Student",
        class_="ECE 4th Year",
        section="B",
        roll_number="99",
        email="rohit@cmrit.ac.in",
        phone="+91-9876543210"
    )
    db_session.add(student)
    db_session.commit()

    assert student.id is not None
    assert student.student_id == "CMRIT26ECE099"
    assert student.user.username == "cmrit_stu_01"

    # Duplicate student_id should raise IntegrityError
    u2 = User(username="cmrit_stu_dup", password_hash=hash_pw("Pass123!"), role=Role.STUDENT)
    db_session.add(u2)
    db_session.flush()

    dup_student = Student(
        user_id=u2.id,
        student_id="CMRIT26ECE099",
        name="Duplicate Student"
    )
    db_session.add(dup_student)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 3. Parent Creation
# ============================================================================
def test_03_parent_creation(db_session):
    u = User(username="parent_user_01", password_hash=hash_pw("Pass123!"), role=Role.PARENT)
    db_session.add(u)
    db_session.flush()

    parent = Parent(
        user_id=u.id,
        parent_id="PAR-CMRIT999",
        name="Sunita Sharma",
        email="sunita@example.com",
        phone="+91-9876543211"
    )
    db_session.add(parent)
    db_session.commit()

    assert parent.id is not None
    assert parent.parent_id == "PAR-CMRIT999"
    assert parent.user.username == "parent_user_01"


# ============================================================================
# 4. Teacher Creation
# ============================================================================
def test_04_teacher_creation(db_session):
    u = User(username="teacher_user_01", password_hash=hash_pw("Pass123!"), role=Role.TEACHER)
    db_session.add(u)
    db_session.flush()

    teacher = Teacher(
        user_id=u.id,
        teacher_id="TCH-CMRIT555",
        name="Prof. Sharma",
        email="sharma@cmrit.ac.in",
        phone="+91-9876543212"
    )
    db_session.add(teacher)
    db_session.commit()

    assert teacher.id is not None
    assert teacher.teacher_id == "TCH-CMRIT555"
    assert teacher.user.username == "teacher_user_01"


# ============================================================================
# 5. Student-Parent Many-to-Many Relationship
# ============================================================================
def test_05_student_parent_many_to_many(db_session):
    # Setup 2 Students and 2 Parents
    u_s1 = User(username="m2m_s1", password_hash=hash_pw("P"), role=Role.STUDENT)
    u_s2 = User(username="m2m_s2", password_hash=hash_pw("P"), role=Role.STUDENT)
    u_p1 = User(username="m2m_p1", password_hash=hash_pw("P"), role=Role.PARENT)
    u_p2 = User(username="m2m_p2", password_hash=hash_pw("P"), role=Role.PARENT)
    db_session.add_all([u_s1, u_s2, u_p1, u_p2])
    db_session.flush()

    s1 = Student(user_id=u_s1.id, student_id="M2M-S1", name="Student One")
    s2 = Student(user_id=u_s2.id, student_id="M2M-S2", name="Student Two")
    p1 = Parent(user_id=u_p1.id, parent_id="M2M-P1", name="Parent One")
    p2 = Parent(user_id=u_p2.id, parent_id="M2M-P2", name="Parent Two")
    db_session.add_all([s1, s2, p1, p2])
    db_session.flush()

    # Link: Student 1 -> Parent 1 (Mother), Parent 2 (Father)
    link1 = StudentParent(student_id=s1.id, parent_id=p1.id, relationship="Mother")
    link2 = StudentParent(student_id=s1.id, parent_id=p2.id, relationship="Father")
    # Link: Student 2 -> Parent 1 (Guardian)
    link3 = StudentParent(student_id=s2.id, parent_id=p1.id, relationship="Guardian")
    db_session.add_all([link1, link2, link3])
    db_session.commit()

    # Verify student 1 has 2 parents
    s1_parents = db_session.query(StudentParent).filter(StudentParent.student_id == s1.id).all()
    assert len(s1_parents) == 2

    # Verify parent 1 has 2 students
    p1_students = db_session.query(StudentParent).filter(StudentParent.parent_id == p1.id).all()
    assert len(p1_students) == 2

    # Verify unique constraint prevents duplicate (s1, p1)
    duplicate_link = StudentParent(student_id=s1.id, parent_id=p1.id, relationship="Mother")
    db_session.add(duplicate_link)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 6. Teacher-Student Relationship
# ============================================================================
def test_06_teacher_student_relationship(db_session):
    u_t = User(username="ts_teacher", password_hash=hash_pw("P"), role=Role.TEACHER)
    u_s = User(username="ts_student", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add_all([u_t, u_s])
    db_session.flush()

    t = Teacher(user_id=u_t.id, teacher_id="TS-T01", name="Teacher TS")
    s = Student(user_id=u_s.id, student_id="TS-S01", name="Student TS")
    db_session.add_all([t, s])
    db_session.flush()

    ts = TeacherStudent(teacher_id=t.id, student_id=s.id)
    db_session.add(ts)
    db_session.commit()

    assert ts.id is not None

    # Unique constraint test
    dup_ts = TeacherStudent(teacher_id=t.id, student_id=s.id)
    db_session.add(dup_ts)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 7. Student-Subject Relationship
# ============================================================================
def test_07_student_subject_relationship(db_session):
    u_s = User(username="ss_student", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add(u_s)
    db_session.flush()
    s = Student(user_id=u_s.id, student_id="SS-S01", name="Student SS")
    subj = Subject(name="Microprocessors", class_="Semester 4")
    db_session.add_all([s, subj])
    db_session.flush()

    ss = StudentSubject(student_id=s.id, subject_id=subj.id)
    db_session.add(ss)
    db_session.commit()
    assert ss.id is not None

    # Unique constraint test
    dup_ss = StudentSubject(student_id=s.id, subject_id=subj.id)
    db_session.add(dup_ss)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 8. Subject -> Chapter -> Topic -> Subtopic Hierarchy
# ============================================================================
def test_08_content_hierarchy(db_session):
    subj = Subject(name="Operating Systems", description="Processes, threads, memory")
    db_session.add(subj)
    db_session.flush()

    ch1 = Chapter(subject_id=subj.id, chapter_number=1, title="Processes and Threads")
    db_session.add(ch1)
    db_session.flush()

    top1 = Topic(chapter_id=ch1.id, sequence_number=1, title="Process Scheduling Algorithms")
    db_session.add(top1)
    db_session.flush()

    sub1 = Subtopic(topic_id=top1.id, sequence_number=1, title="Round Robin Scheduling")
    sub2 = Subtopic(topic_id=top1.id, sequence_number=2, title="Priority Scheduling")
    db_session.add_all([sub1, sub2])
    db_session.commit()

    # Verify hierarchy traversal
    assert len(subj.chapters) >= 1
    assert subj.chapters[0].topics[0].title == "Process Scheduling Algorithms"
    assert len(subj.chapters[0].topics[0].subtopics) == 2


# ============================================================================
# 9. Dynamic Video Relationships (No hardcoded video counts)
# ============================================================================
def test_09_dynamic_video_relationships(db_session):
    subj = Subject(name="Database Management Systems")
    db_session.add(subj)
    db_session.flush()

    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Relational Model")
    db_session.add(ch)
    db_session.flush()

    topic1 = Topic(chapter_id=ch.id, sequence_number=1, title="SQL Joins")
    topic2 = Topic(chapter_id=ch.id, sequence_number=2, title="Normalization")
    topic3 = Topic(chapter_id=ch.id, sequence_number=3, title="Transactions")
    db_session.add_all([topic1, topic2, topic3])
    db_session.flush()

    # Topic 1 has 2 videos
    for i in range(2):
        db_session.add(Video(topic_id=topic1.id, sequence_number=i+1, title=f"Joins Part {i+1}"))

    # Topic 2 has 4 videos
    for i in range(4):
        db_session.add(Video(topic_id=topic2.id, sequence_number=i+1, title=f"Norm Part {i+1}"))

    # Topic 3 has 1 video
    db_session.add(Video(topic_id=topic3.id, sequence_number=1, title="ACID Properties"))
    db_session.commit()

    # Verify dynamic counts without any hardcoded number_of_videos column
    assert len(topic1.videos) == 2
    assert len(topic2.videos) == 4
    assert len(topic3.videos) == 1
    assert not hasattr(Chapter, "number_of_videos")
    assert not hasattr(Topic, "number_of_videos")


# ============================================================================
# 10. Student Video Progress & Resume Position
# ============================================================================
def test_10_student_video_progress(db_session):
    u_s = User(username="vid_prog_student", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add(u_s)
    db_session.flush()
    s = Student(user_id=u_s.id, student_id="VP-S01", name="VP Student")

    subj = Subject(name="Software Engineering")
    db_session.add_all([s, subj])
    db_session.flush()

    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Agile Methodology")
    db_session.add(ch)
    db_session.flush()

    top = Topic(chapter_id=ch.id, sequence_number=1, title="Scrum Framework")
    db_session.add(top)
    db_session.flush()

    v = Video(topic_id=top.id, title="Sprint Planning Lesson", duration_seconds=330)
    db_session.add(v)
    db_session.flush()

    vp = StudentVideoProgress(
        student_id=s.id,
        video_id=v.id,
        watch_percentage=75.5,
        last_position_seconds=249.0,
        completed=False
    )
    db_session.add(vp)
    db_session.commit()

    assert vp.watch_percentage == 75.5
    assert vp.last_position_seconds == 249.0
    assert vp.completed is False

    # Unique constraint test
    dup_vp = StudentVideoProgress(student_id=s.id, video_id=v.id)
    db_session.add(dup_vp)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 11. Quiz Creation
# ============================================================================
def test_11_quiz_creation(db_session):
    subj = Subject(name="Algorithms")
    db_session.add(subj)
    db_session.flush()
    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Sorting")
    db_session.add(ch)
    db_session.flush()
    top = Topic(chapter_id=ch.id, sequence_number=1, title="QuickSort")
    db_session.add(top)
    db_session.flush()

    quiz = Quiz(
        topic_id=top.id,
        title="QuickSort Diagnostic Assessment",
        description="Assesses pivot selection and partition logic",
        quiz_type="TOPIC",
        passing_score=80.0,
        attempt_number=1,
        is_adaptive=False,
        status="PUBLISHED"
    )
    db_session.add(quiz)
    db_session.commit()

    assert quiz.id is not None
    assert quiz.passing_score == 80.0
    assert quiz.attempt_number == 1


# ============================================================================
# 12. Questions (MCQ, True/False, Short Answer Extensibility)
# ============================================================================
def test_12_questions(db_session):
    subj = Subject(name="Web Technologies")
    db_session.add(subj)
    db_session.flush()
    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Protocols")
    db_session.add(ch)
    db_session.flush()
    top = Topic(chapter_id=ch.id, sequence_number=1, title="HTTP/HTTPS")
    db_session.add(top)
    db_session.flush()
    quiz = Quiz(topic_id=top.id, title="HTTP Quiz")
    db_session.add(quiz)
    db_session.flush()

    # MCQ
    q_mcq = Question(
        quiz_id=quiz.id,
        question_text="Which status code represents 'Not Found'?",
        question_type=QuestionType.MCQ.value,
        difficulty="EASY",
        options=["200", "400", "404", "500"],
        correct_answer="2",
        explanation="404 indicates resource not found."
    )
    # TRUE_FALSE
    q_tf = Question(
        quiz_id=quiz.id,
        question_text="HTTPS encrypts communication using TLS.",
        question_type=QuestionType.TRUE_FALSE.value,
        difficulty="EASY",
        options=["True", "False"],
        correct_answer="0",
        explanation="HTTPS utilizes TLS encryption."
    )
    # SHORT_ANSWER
    q_sa = Question(
        quiz_id=quiz.id,
        question_text="Name the standard HTTP method used to retrieve resources.",
        question_type=QuestionType.SHORT_ANSWER.value,
        difficulty="MEDIUM",
        correct_answer="GET",
        explanation="GET retrieves the specified URI resource."
    )
    db_session.add_all([q_mcq, q_tf, q_sa])
    db_session.commit()

    assert q_mcq.id is not None
    assert q_tf.id is not None
    assert q_sa.id is not None


# ============================================================================
# 13. Quiz Attempts
# ============================================================================
def test_13_quiz_attempts(db_session):
    u = User(username="attempt_student", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add(u)
    db_session.flush()
    stu = Student(user_id=u.id, student_id="ATT-001", name="Attempt Stu")
    subj = Subject(name="Linear Algebra")
    db_session.add_all([stu, subj])
    db_session.flush()

    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Matrices")
    db_session.add(ch)
    db_session.flush()
    top = Topic(chapter_id=ch.id, sequence_number=1, title="Eigenvalues")
    db_session.add(top)
    db_session.flush()
    quiz = Quiz(topic_id=top.id, title="Matrix Algebra Quiz")
    db_session.add(quiz)
    db_session.flush()

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_id=stu.id,
        score=90.0,
        total_questions=10,
        percentage=90.0,
        passed=True,
        answers={"1": 0, "2": 1},
        weak_concepts=[]
    )
    db_session.add(attempt)
    db_session.commit()

    assert attempt.id is not None
    assert attempt.score == 90.0
    assert attempt.passed is True


# ============================================================================
# 14. Adaptive Quiz Parent_Quiz_ID Relationship
# ============================================================================
def test_14_adaptive_quiz_chain(db_session):
    subj = Subject(name="Discrete Mathematics")
    db_session.add(subj)
    db_session.flush()
    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Graph Theory")
    db_session.add(ch)
    db_session.flush()
    top = Topic(chapter_id=ch.id, sequence_number=1, title="Trees and Traversal")
    db_session.add(top)
    db_session.flush()

    # Quiz 1
    q1 = Quiz(topic_id=top.id, title="Graph Theory Diagnostic", attempt_number=1, is_adaptive=False)
    db_session.add(q1)
    db_session.flush()

    # Quiz 2 referencing Quiz 1
    q2 = Quiz(topic_id=top.id, title="Adaptive Remediation 1", attempt_number=2, parent_quiz_id=q1.id, is_adaptive=True)
    db_session.add(q2)
    db_session.flush()

    # Quiz 3 referencing Quiz 2
    q3 = Quiz(topic_id=top.id, title="Adaptive Remediation 2", attempt_number=3, parent_quiz_id=q2.id, is_adaptive=True)
    db_session.add(q3)
    db_session.commit()

    assert q2.parent_quiz.id == q1.id
    assert q3.parent_quiz.id == q2.id
    assert q1.child_quizzes[0].id == q2.id
    assert q2.child_quizzes[0].id == q3.id


# ============================================================================
# 15. Student Topic Performance
# ============================================================================
def test_15_student_topic_performance(db_session):
    u = User(username="perf_student", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add(u)
    db_session.flush()
    stu = Student(user_id=u.id, student_id="PERF-001", name="Perf Stu")
    subj = Subject(name="Data Engineering")
    db_session.add_all([stu, subj])
    db_session.flush()
    ch = Chapter(subject_id=subj.id, chapter_number=1, title="Pipelines")
    db_session.add(ch)
    db_session.flush()
    top = Topic(chapter_id=ch.id, sequence_number=1, title="Kafka Streams")
    db_session.add(top)
    db_session.flush()

    perf = StudentTopicPerformance(
        student_id=stu.id,
        topic_id=top.id,
        attempts=3,
        best_score=92.0,
        latest_score=92.0,
        mastery_level=MasteryLevel.MASTERED.value,
        last_attempted_at=datetime.now(timezone.utc)
    )
    db_session.add(perf)
    db_session.commit()

    assert perf.mastery_level == MasteryLevel.MASTERED.value
    assert perf.best_score == 92.0

    # Unique constraint test
    dup = StudentTopicPerformance(student_id=stu.id, topic_id=top.id, attempts=1)
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 16. Assignment Creation
# ============================================================================
def test_16_assignment_creation(db_session):
    u = User(username="assign_teacher", password_hash=hash_pw("P"), role=Role.TEACHER)
    db_session.add(u)
    db_session.flush()
    t = Teacher(user_id=u.id, teacher_id="ASN-T01", name="Teacher Assign")
    subj = Subject(name="Compiler Design")
    db_session.add_all([t, subj])
    db_session.flush()

    assign = Assignment(
        teacher_id=t.id,
        subject_id=subj.id,
        title="Lexical Analyzer Implementation",
        description="Write a Flex scanner for ANSI C tokens",
        due_date=datetime.now(timezone.utc) + timedelta(days=14)
    )
    db_session.add(assign)
    db_session.commit()

    assert assign.id is not None
    assert assign.teacher_id == t.id


# ============================================================================
# 17. Student Assignment
# ============================================================================
def test_17_student_assignment(db_session):
    u_t = User(username="sa_teacher", password_hash=hash_pw("P"), role=Role.TEACHER)
    u_s = User(username="sa_student", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add_all([u_t, u_s])
    db_session.flush()
    t = Teacher(user_id=u_t.id, teacher_id="SA-T01", name="Teacher SA")
    s = Student(user_id=u_s.id, student_id="SA-S01", name="Student SA")
    subj = Subject(name="Networks")
    db_session.add_all([t, s, subj])
    db_session.flush()

    asn = Assignment(teacher_id=t.id, subject_id=subj.id, title="Packet Sniffer Lab")
    db_session.add(asn)
    db_session.flush()

    sa = StudentAssignment(
        assignment_id=asn.id,
        student_id=s.id,
        status="SUBMITTED",
        submission_url="https://github.com/student/sniffer",
        score=98.5,
        submitted_at=datetime.now(timezone.utc)
    )
    db_session.add(sa)
    db_session.commit()

    assert sa.id is not None
    assert sa.score == 98.5

    # Unique constraint test
    dup = StudentAssignment(assignment_id=asn.id, student_id=s.id)
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ============================================================================
# 18. RBAC
# ============================================================================
def test_18_rbac(client):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    teacher_h = make_auth_header(4, "teacher")
    parent_h = make_auth_header(5, "parent")

    # Admin access allowed
    assert client.get("/admin/users", headers=admin_h).status_code == 200

    # Non-admin rejected from admin endpoints
    assert client.get("/admin/users", headers=student_h).status_code == 403
    assert client.get("/admin/users", headers=teacher_h).status_code == 403
    assert client.get("/admin/users", headers=parent_h).status_code == 403


# ============================================================================
# 19. JWT Authentication (Resolving Across Roles)
# ============================================================================
def test_19_jwt_authentication(client):
    # 1. Admin login by email/username
    res_admin = client.post("/auth/login", json={"email": "admin@example.com", "password": "AdminPass123!"})
    assert res_admin.status_code == 200
    assert res_admin.json()["role"] == "admin"

    # 2. Student login by student_id
    res_stu = client.post("/auth/login", json={"username": "CMRIT26ECE001", "password": "StudentPass123!"})
    assert res_stu.status_code == 200
    assert res_stu.json()["role"] == "student"

    # 3. Parent login by parent_id
    res_par = client.post("/auth/login", json={"username": "PAR-CMRIT001", "password": "ParentPass123!"})
    assert res_par.status_code == 200
    assert res_par.json()["role"] == "parent"

    # 4. Teacher login by teacher_id
    res_tch = client.post("/auth/login", json={"username": "TCH001", "password": "TeacherPass123!"})
    assert res_tch.status_code == 200
    assert res_tch.json()["role"] == "teacher"

    # 5. Invalid credentials rejected
    res_fail = client.post("/auth/login", json={"username": "admin", "password": "WrongPassword"})
    assert res_fail.status_code == 401


# ============================================================================
# 20. Student Can Only Access Assigned Subjects
# ============================================================================
def test_20_student_can_only_access_assigned_subjects(client, db_session):
    student_headers = make_auth_header(2, "student")  # Alice (Student 1)

    # Create unassigned subject B with video
    subj_b = Subject(name="Unassigned Bio-Medical Subject")
    db_session.add(subj_b)
    db_session.flush()

    ch = Chapter(subject_id=subj_b.id, chapter_number=1, title="Bio Instruments")
    db_session.add(ch)
    db_session.flush()

    top = Topic(chapter_id=ch.id, sequence_number=1, title="ECG Machine Circuitry")
    db_session.add(top)
    db_session.flush()

    vid = Video(topic_id=top.id, title="ECG Hardware Lesson", status=VideoStatus.PUBLISHED.value)
    db_session.add(vid)
    db_session.commit()

    # Attempting to access published video from unassigned subject B must return 403
    res = client.get(f"/learn/videos/{vid.id}", headers=student_headers)
    assert res.status_code == 403
    assert "Student is not assigned to this subject" in res.json()["detail"]


# ============================================================================
# 21. Parent Can Only Access Linked Student Data
# ============================================================================
def test_21_parent_can_only_access_linked_student_data(client, db_session):
    # In conftest: Parent Dave (user_id=5) is linked ONLY to Student Alice (user_id=2).
    # Student Bob has user_id=3.
    parent_headers = make_auth_header(5, "parent")

    # Accessing linked child Alice succeeds
    res_alice = client.get("/learn/dashboards/progress?student_id=2", headers=parent_headers)
    assert res_alice.status_code == 200
    assert res_alice.json()["student_id"] == 2

    # Accessing unlinked student Bob must return 403 Forbidden
    res_bob = client.get("/learn/dashboards/progress?student_id=3", headers=parent_headers)
    assert res_bob.status_code == 403
    assert "Parent is not linked to this student" in res_bob.json()["detail"]


# ============================================================================
# 22. Teacher Can Only Access Assigned Student Data
# ============================================================================
def test_22_teacher_can_only_access_assigned_student_data(client, db_session):
    # Create Teacher Z and Student X not assigned to Teacher Z
    u_tz = User(username="teacher_z", password_hash=hash_pw("P"), role=Role.TEACHER)
    u_sx = User(username="student_x", password_hash=hash_pw("P"), role=Role.STUDENT)
    db_session.add_all([u_tz, u_sx])
    db_session.flush()

    tz = Teacher(user_id=u_tz.id, teacher_id="TZ-001", name="Teacher Z")
    sx = Student(user_id=u_sx.id, student_id="SX-001", name="Student X")
    # Also assign Alice to Teacher Z so Teacher Z has an explicit assignment list
    student1 = db_session.get(Student, 1)
    db_session.add_all([tz, sx])
    db_session.flush()
    db_session.add(TeacherStudent(teacher_id=tz.id, student_id=student1.id))
    db_session.commit()

    tz_headers = make_auth_header(u_tz.id, "teacher")

    # Teacher Z accessing assigned student Alice succeeds
    res_alice = client.get("/learn/dashboards/progress?student_id=2", headers=tz_headers)
    assert res_alice.status_code == 200

    # Teacher Z accessing unassigned student X must return 403 Forbidden
    res_unassigned = client.get(f"/learn/dashboards/progress?student_id={u_sx.id}", headers=tz_headers)
    assert res_unassigned.status_code == 403
    assert "Teacher is not assigned to this student" in res_unassigned.json()["detail"]
