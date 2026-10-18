from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal, Base, engine
from app.models.models import (
    User, Student, Parent, Teacher, StudentParent, TeacherStudent,
    Subject, StudentSubject, Chapter, Topic, Subtopic, Video,
    Quiz, Question, QuizAttempt, StudentVideoProgress,
    StudentTopicPerformance, Assignment, StudentAssignment,
    SystemSettings, Role, VideoStatus, MasteryLevel
)
from app.core.security import hash_pw


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("Initializing canonical seed data...")

    # 1. System Settings
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(mastery_threshold=80.0, adaptive_per_weak=3)
        db.add(settings)
        db.commit()

    # 2. Users and Profiles
    # Admin
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            name="System Administrator",
            email="admin@example.com",
            password_hash=hash_pw("AdminPass123!"),
            role=Role.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        db.flush()

    # Teacher
    teacher_user = db.query(User).filter(User.username == "teacher").first()
    if not teacher_user:
        teacher_user = User(
            username="teacher",
            name="Teacher Morgan",
            email="teacher@example.com",
            password_hash=hash_pw("TeacherPass123!"),
            role=Role.TEACHER,
            is_active=True
        )
        db.add(teacher_user)
        db.flush()

    teacher = db.query(Teacher).filter(Teacher.user_id == teacher_user.id).first()
    if not teacher:
        teacher = Teacher(
            user_id=teacher_user.id,
            teacher_id="TCH001",
            name="Teacher Morgan",
            email="teacher@example.com",
            phone="+1-555-0101"
        )
        db.add(teacher)
        db.flush()

    # Student 1
    s1_user = db.query(User).filter(User.username == "student1").first()
    if not s1_user:
        # Also check fallback email for existing test compatibility
        s1_user = db.query(User).filter(User.email == "student@example.com").first()
    if not s1_user:
        s1_user = User(
            username="student1",
            name="Alex Student",
            email="student@example.com",
            password_hash=hash_pw("StudentPass123!"),
            role=Role.STUDENT,
            is_active=True
        )
        db.add(s1_user)
        db.flush()

    student1 = db.query(Student).filter(Student.user_id == s1_user.id).first()
    if not student1:
        student1 = Student(
            user_id=s1_user.id,
            student_id="CMRIT26ECE001",
            name="Alex Student",
            class_="ECE 3rd Year",
            section="A",
            roll_number="01",
            email="student@example.com",
            phone="+1-555-0201"
        )
        db.add(student1)
        db.flush()

    # Student 2
    s2_user = db.query(User).filter(User.username == "student2").first()
    if not s2_user:
        s2_user = db.query(User).filter(User.email == "bob@example.com").first()
    if not s2_user:
        s2_user = User(
            username="student2",
            name="Bob Student",
            email="bob@example.com",
            password_hash=hash_pw("StudentPass123!"),
            role=Role.STUDENT,
            is_active=True
        )
        db.add(s2_user)
        db.flush()

    student2 = db.query(Student).filter(Student.user_id == s2_user.id).first()
    if not student2:
        student2 = Student(
            user_id=s2_user.id,
            student_id="CMRIT26ECE002",
            name="Bob Student",
            class_="ECE 3rd Year",
            section="A",
            roll_number="02",
            email="bob@example.com",
            phone="+1-555-0202"
        )
        db.add(student2)
        db.flush()

    # Parent 1
    p1_user = db.query(User).filter(User.username == "parent1").first()
    if not p1_user:
        p1_user = db.query(User).filter(User.email == "parent@example.com").first()
    if not p1_user:
        p1_user = User(
            username="parent1",
            name="Parent Jordan",
            email="parent@example.com",
            password_hash=hash_pw("ParentPass123!"),
            role=Role.PARENT,
            is_active=True
        )
        db.add(p1_user)
        db.flush()

    parent1 = db.query(Parent).filter(Parent.user_id == p1_user.id).first()
    if not parent1:
        parent1 = Parent(
            user_id=p1_user.id,
            parent_id="PAR-CMRIT001",
            name="Parent Jordan",
            email="parent@example.com",
            phone="+1-555-0301"
        )
        db.add(parent1)
        db.flush()

    # Parent 2
    p2_user = db.query(User).filter(User.username == "parent2").first()
    if not p2_user:
        p2_user = User(
            username="parent2",
            name="Parent Taylor",
            email="parent2@example.com",
            password_hash=hash_pw("ParentPass123!"),
            role=Role.PARENT,
            is_active=True
        )
        db.add(p2_user)
        db.flush()

    parent2 = db.query(Parent).filter(Parent.user_id == p2_user.id).first()
    if not parent2:
        parent2 = Parent(
            user_id=p2_user.id,
            parent_id="PAR-CMRIT002",
            name="Parent Taylor",
            email="parent2@example.com",
            phone="+1-555-0302"
        )
        db.add(parent2)
        db.flush()

    # 3. Student-Parent Relationships:
    # Student 1 -> Parent 1 (Mother), Parent 2 (Father)
    # Student 2 -> Parent 1 (Guardian)
    for stu_id, par_id, rel in [
        (student1.id, parent1.id, "Mother"),
        (student1.id, parent2.id, "Father"),
        (student2.id, parent1.id, "Guardian")
    ]:
        if not db.query(StudentParent).filter(
            StudentParent.student_id == stu_id,
            StudentParent.parent_id == par_id
        ).first():
            db.add(StudentParent(student_id=stu_id, parent_id=par_id, relationship=rel))

    # 4. Teacher-Student Relationships
    # Teacher -> Student 1, Student 2
    for stu_id in [student1.id, student2.id]:
        if not db.query(TeacherStudent).filter(
            TeacherStudent.teacher_id == teacher.id,
            TeacherStudent.student_id == stu_id
        ).first():
            db.add(TeacherStudent(teacher_id=teacher.id, student_id=stu_id))

    # 5. Subject
    subject = db.query(Subject).first()
    if not subject:
        subject = Subject(
            name="Computer Science & Engineering",
            description="Fundamental and advanced concepts in computer engineering",
            class_="Semester 3",
            created_by=admin_user.id
        )
        db.add(subject)
        db.flush()

    # 6. Student-Subject Relationships (Assign Subject to Student 1 & 2)
    for stu_id in [student1.id, student2.id]:
        if not db.query(StudentSubject).filter(
            StudentSubject.student_id == stu_id,
            StudentSubject.subject_id == subject.id
        ).first():
            db.add(StudentSubject(student_id=stu_id, subject_id=subject.id))

    # 7. Chapters & Topics Hierarchy
    # Chapter 1
    ch1 = db.query(Chapter).filter(Chapter.subject_id == subject.id, Chapter.chapter_number == 1).first()
    if not ch1:
        ch1 = Chapter(
            subject_id=subject.id,
            chapter_number=1,
            title="Data Structures & Algorithms",
            description="Core linear and non-linear data structures"
        )
        db.add(ch1)
        db.flush()

    # Chapter 2
    ch2 = db.query(Chapter).filter(Chapter.subject_id == subject.id, Chapter.chapter_number == 2).first()
    if not ch2:
        ch2 = Chapter(
            subject_id=subject.id,
            chapter_number=2,
            title="Object-Oriented Programming",
            description="Principles of encapsulation, inheritance, and polymorphism"
        )
        db.add(ch2)
        db.flush()

    # Topic A: Arrays (Chapter 1)
    topic_a = db.query(Topic).filter(Topic.chapter_id == ch1.id, Topic.title.like("%Arrays%")).first()
    if not topic_a:
        topic_a = Topic(
            chapter_id=ch1.id,
            title="Arrays and Dynamic Sizing",
            description="Contiguous memory layout and amortized time bounds",
            sequence_number=1
        )
        db.add(topic_a)
        db.flush()

    # Topic B: Linked Lists (Chapter 1)
    topic_b = db.query(Topic).filter(Topic.chapter_id == ch1.id, Topic.title.like("%Linked Lists%")).first()
    if not topic_b:
        topic_b = Topic(
            chapter_id=ch1.id,
            title="Linked Lists and Pointer Manipulation",
            description="Singly, doubly, and circular linked nodes",
            sequence_number=2
        )
        db.add(topic_b)
        db.flush()

    # Topic C: Classes & Objects (Chapter 2)
    topic_c = db.query(Topic).filter(Topic.chapter_id == ch2.id, Topic.title.like("%Classes%")).first()
    if not topic_c:
        topic_c = Topic(
            chapter_id=ch2.id,
            title="Classes, Objects and Encapsulation",
            description="Constructors, access specifiers, and object lifecycles",
            sequence_number=1
        )
        db.add(topic_c)
        db.flush()

    # Subtopics
    for top, titles in [
        (topic_a, ["Static Arrays", "Dynamic Arrays & Resizing"]),
        (topic_b, ["Node Structure", "Insertion & Deletion", "Reversal Techniques"]),
        (topic_c, ["Object Instantiation", "Encapsulation & Data Hiding"])
    ]:
        for idx, st_title in enumerate(titles):
            if not db.query(Subtopic).filter(Subtopic.topic_id == top.id, Subtopic.title == st_title).first():
                db.add(Subtopic(
                    topic_id=top.id,
                    title=st_title,
                    sequence_number=idx + 1,
                    description=f"Overview of {st_title}"
                ))

    db.flush()

    # 8. Dynamic Videos per Topic:
    # Topic A -> 2 videos
    # Topic B -> 4 videos
    # Topic C -> 1 video
    # Proves video count is dynamic!
    video_configs = [
        (topic_a, 2, "Array Foundations"),
        (topic_b, 4, "Linked List Mastery"),
        (topic_c, 1, "OOP Class Architecture")
    ]

    for top, count, base_name in video_configs:
        current_videos = db.query(Video).filter(Video.topic_id == top.id).count()
        if current_videos < count:
            for v_idx in range(current_videos, count):
                v_title = f"{base_name} - Module {v_idx + 1}" if count > 1 else base_name
                db.add(Video(
                    topic_id=top.id,
                    title=v_title,
                    description=f"Curriculum video for {v_title}",
                    sequence_number=v_idx + 1,
                    duration_seconds=330,  # ~5.5 min
                    script=f"Educational narration for {v_title}",
                    storage_key=f"/static/videos/seed_{top.id}_{v_idx+1}.mp4",
                    status=VideoStatus.REVIEW.value,
                    render_status="NOT_STARTED"
                ))

    db.flush()

    # 9. Quizzes, Questions, and Adaptive Chain:
    # Quiz 1 for Topic A (attempt_number=1)
    quiz1 = db.query(Quiz).filter(Quiz.topic_id == topic_a.id, Quiz.attempt_number == 1).first()
    if not quiz1:
        quiz1 = Quiz(
            topic_id=topic_a.id,
            title="Arrays Diagnostic Assessment",
            description="Foundations of dynamic arrays and indexing",
            quiz_type="TOPIC",
            passing_score=80.0,
            attempt_number=1,
            is_adaptive=False,
            status="PUBLISHED"
        )
        db.add(quiz1)
        db.flush()

        # Questions for Quiz 1
        q1 = Question(
            quiz_id=quiz1.id,
            question_text="What is the time complexity of random access in an array?",
            options=["O(1)", "O(n)", "O(log n)", "O(n^2)"],
            correct_answer="0",
            objective="Array Indexing",
            explanation="Array elements occupy contiguous memory cells allowing direct indexing in O(1) time.",
            difficulty="EASY"
        )
        q2 = Question(
            quiz_id=quiz1.id,
            question_text="What happens when a dynamic array capacity is exceeded upon appending?",
            options=[
                "Silent truncation of data",
                "Array allocates a larger block (typically 2x) and copies elements",
                "Immediate compile error",
                "Pointer conversion to linked list"
            ],
            correct_answer="1",
            objective="Dynamic Array Resizing",
            explanation="Dynamic arrays amortize append operations by doubling capacity.",
            difficulty="MEDIUM"
        )
        db.add_all([q1, q2])
        db.flush()

    # Adaptive Quiz 2 referencing Quiz 1 via parent_quiz_id
    quiz2 = db.query(Quiz).filter(Quiz.parent_quiz_id == quiz1.id).first()
    if not quiz2:
        quiz2 = Quiz(
            topic_id=topic_a.id,
            title="Arrays Adaptive Remediation (Attempt 2)",
            description="Adaptive follow-up targeting array memory allocation",
            quiz_type="ADAPTIVE",
            passing_score=80.0,
            attempt_number=2,
            parent_quiz_id=quiz1.id,
            is_adaptive=True,
            status="PUBLISHED"
        )
        db.add(quiz2)
        db.flush()

        aq1 = Question(
            quiz_id=quiz2.id,
            question_text="[Adaptive] Why does doubling capacity yield O(1) amortized append time?",
            options=[
                "Because copying happens rarely enough over N elements",
                "Because CPU registers avoid copying",
                "Because memory addresses are virtualized",
                "None of the above"
            ],
            correct_answer="0",
            objective="Dynamic Array Resizing",
            adaptive=True,
            weak_concept="Dynamic Array Resizing",
            difficulty="MEDIUM"
        )
        db.add(aq1)
        db.flush()

    # 10. Student Video Progress & Resume Position
    video_first = db.query(Video).filter(Video.topic_id == topic_a.id).first()
    if video_first:
        vp = db.query(StudentVideoProgress).filter(
            StudentVideoProgress.student_id == student1.id,
            StudentVideoProgress.video_id == video_first.id
        ).first()
        if not vp:
            db.add(StudentVideoProgress(
                student_id=student1.id,
                video_id=video_first.id,
                watch_percentage=65.0,
                last_position_seconds=214.5,
                completed=False
            ))

    # 11. Student Topic Performance Driving Adaptive Engine
    # Topic A: Arrays (latest_score = 40, mastery_level = NEEDS_PRACTICE)
    perf_a = db.query(StudentTopicPerformance).filter(
        StudentTopicPerformance.student_id == student1.id,
        StudentTopicPerformance.topic_id == topic_a.id
    ).first()
    if not perf_a:
        db.add(StudentTopicPerformance(
            student_id=student1.id,
            topic_id=topic_a.id,
            attempts=1,
            best_score=40.0,
            latest_score=40.0,
            mastery_level=MasteryLevel.NEEDS_PRACTICE.value,
            last_attempted_at=datetime.now(timezone.utc)
        ))

    # Topic B: Linked Lists (latest_score = 90, mastery_level = MASTERED)
    perf_b = db.query(StudentTopicPerformance).filter(
        StudentTopicPerformance.student_id == student1.id,
        StudentTopicPerformance.topic_id == topic_b.id
    ).first()
    if not perf_b:
        db.add(StudentTopicPerformance(
            student_id=student1.id,
            topic_id=topic_b.id,
            attempts=2,
            best_score=90.0,
            latest_score=90.0,
            mastery_level=MasteryLevel.MASTERED.value,
            last_attempted_at=datetime.now(timezone.utc)
        ))

    # 12. Assignments & Student Submissions
    assign1 = db.query(Assignment).filter(Assignment.teacher_id == teacher.id).first()
    if not assign1:
        assign1 = Assignment(
            teacher_id=teacher.id,
            subject_id=subject.id,
            chapter_id=ch1.id,
            topic_id=topic_a.id,
            title="Assignment 1: Array Implementation in C++",
            description="Implement a dynamically expanding vector class with bounds checking",
            due_date=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(assign1)
        db.flush()

        db.add(StudentAssignment(
            assignment_id=assign1.id,
            student_id=student1.id,
            status="SUBMITTED",
            submission_url="https://github.com/student/vector-impl",
            score=95.0,
            submitted_at=datetime.now(timezone.utc)
        ))

    db.commit()
    db.close()

    print("Canonical database seed complete:")
    print("  Admin: admin / AdminPass123!")
    print("  Teacher: teacher (TCH001) / TeacherPass123!")
    print("  Student 1: student1 (CMRIT26ECE001) / StudentPass123!")
    print("  Student 2: student2 (CMRIT26ECE002) / StudentPass123!")
    print("  Parent 1: parent1 (PAR-CMRIT001) / ParentPass123!")
    print("  Parent 2: parent2 (PAR-CMRIT002) / ParentPass123!")
    print("  Subject: Computer Science & Engineering")
    print("  Dynamic Video Counts: Topic A (2), Topic B (4), Topic C (1)")


if __name__ == "__main__":
    init_db()
