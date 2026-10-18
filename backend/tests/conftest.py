import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.models import (
    User, Role, SystemSettings, Student, Parent, Teacher,
    StudentParent, TeacherStudent, Subject, StudentSubject
)
from app.core.security import hash_pw, create_token

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_shared.db")


@pytest.fixture(scope="session")
def engine():
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass
    db_engine = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=db_engine)
    yield db_engine
    db_engine.dispose()
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass


@pytest.fixture(scope="session")
def TestingSession(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_shared_database(engine, TestingSession):
    db = TestingSession()
    # System Settings
    db.add(SystemSettings(mastery_threshold=80.0, adaptive_per_weak=3))

    # Standard Accounts
    admin_user = User(
        id=1,
        username="admin",
        name="Admin User",
        email="admin@example.com",
        password_hash=hash_pw("AdminPass123!"),
        role=Role.ADMIN,
        is_active=True
    )
    student_user = User(
        id=2,
        username="alice",
        name="Student Alice",
        email="alice@example.com",
        password_hash=hash_pw("StudentPass123!"),
        role=Role.STUDENT,
        is_active=True
    )
    student2_user = User(
        id=3,
        username="bob",
        name="Student Bob",
        email="bob@example.com",
        password_hash=hash_pw("StudentPass123!"),
        role=Role.STUDENT,
        is_active=True
    )
    teacher_user = User(
        id=4,
        username="teacher",
        name="Teacher Carol",
        email="teacher@example.com",
        password_hash=hash_pw("TeacherPass123!"),
        role=Role.TEACHER,
        is_active=True
    )
    parent_user = User(
        id=5,
        username="parent",
        name="Parent Dave",
        email="parent@example.com",
        password_hash=hash_pw("ParentPass123!"),
        role=Role.PARENT,
        is_active=True,
        linked_student_id=2
    )

    db.add_all([admin_user, student_user, student2_user, teacher_user, parent_user])
    db.flush()

    # Associated Profiles
    student1 = Student(
        id=1,
        user_id=2,
        student_id="CMRIT26ECE001",
        name="Student Alice",
        email="alice@example.com"
    )
    student2 = Student(
        id=2,
        user_id=3,
        student_id="CMRIT26ECE002",
        name="Student Bob",
        email="bob@example.com"
    )
    parent1 = Parent(
        id=1,
        user_id=5,
        parent_id="PAR-CMRIT001",
        name="Parent Dave",
        email="parent@example.com"
    )
    teacher1 = Teacher(
        id=1,
        user_id=4,
        teacher_id="TCH001",
        name="Teacher Carol",
        email="teacher@example.com"
    )
    db.add_all([student1, student2, parent1, teacher1])
    db.flush()

    # Linkages
    db.add(StudentParent(student_id=student1.id, parent_id=parent1.id, relationship="Father"))
    db.add(TeacherStudent(teacher_id=teacher1.id, student_id=student1.id))
    db.add(TeacherStudent(teacher_id=teacher1.id, student_id=student2.id))

    subject1 = Subject(id=1, name="Core Engineering", created_by=1)
    db.add(subject1)
    db.flush()

    db.add(StudentSubject(student_id=student1.id, subject_id=subject1.id))
    db.add(StudentSubject(student_id=student2.id, subject_id=subject1.id))

    db.commit()
    db.close()


@pytest.fixture(scope="session")
def client(TestingSession):
    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def db_session(TestingSession):
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def make_auth_header(uid: int, role: str):
    token = create_token(sub=str(uid), role=role)
    return {"Authorization": f"Bearer {token}"}
