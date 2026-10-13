import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.models import User, Role, SystemSettings
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
    Base.metadata.drop_all(bind=db_engine)
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
    admin_user = User(id=1, name="Admin User", email="admin@example.com", hashed_password=hash_pw("AdminPass123!"), role=Role.ADMIN)
    student_user = User(id=2, name="Student Alice", email="alice@example.com", hashed_password=hash_pw("StudentPass123!"), role=Role.STUDENT)
    student2_user = User(id=3, name="Student Bob", email="bob@example.com", hashed_password=hash_pw("StudentPass123!"), role=Role.STUDENT)
    teacher_user = User(id=4, name="Teacher Carol", email="teacher@example.com", hashed_password=hash_pw("TeacherPass123!"), role=Role.TEACHER)
    parent_user = User(id=5, name="Parent Dave", email="parent@example.com", hashed_password=hash_pw("ParentPass123!"), role=Role.PARENT, linked_student_id=2)
    
    db.add_all([admin_user, student_user, student2_user, teacher_user, parent_user])
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
