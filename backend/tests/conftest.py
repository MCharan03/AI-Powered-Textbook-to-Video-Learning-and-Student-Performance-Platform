import pytest
import os
import re
import shutil
import threading
from typing import Set

# Default tests to deterministic script engine unless explicitly testing Gemini
os.environ.setdefault("SCRIPT_GENERATION_ENGINE", "deterministic")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db, SessionLocal
from app.main import app
from app.models.models import (
    User, Role, SystemSettings, Student, Parent, Teacher,
    StudentParent, TeacherStudent, Subject, StudentSubject,
    Textbook, Video
)
from app.core.security import hash_pw, create_token
from app.core.storage import LocalStorageProvider
from app.services.video_rendering import TTSAudioCache, VideoGenerationService


# ==============================================================================
# TEST ARTIFACT ISOLATION & SAFETY GATES
# ==============================================================================

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_ROOT = os.path.join(REPO_ROOT, "backend")

ALLOWED_TEST_DIRS = [
    os.path.abspath(os.path.join(BACKEND_ROOT, "uploads")),
    os.path.abspath(os.path.join(REPO_ROOT, "uploads")),
    os.path.abspath(os.path.join(BACKEND_ROOT, "static", "videos")),
    os.path.abspath(os.path.join(BACKEND_ROOT, "tests")),
]

IMMUTABLE_PROTECTED_FILES = {
    "Work_Energy_Vdo_test.pdf",
    "complete_science_textbook.pdf",
    "cleanup_audit_log.json",
    "qa_audit_report.json",
    "app.db",
    "app.db-wal",
    "app.db-shm",
    "PHASE_2A_REPORT.md",
    "phase_2a_gemini_script_generation_report.md",
    ".gitkeep",
    ".gitignore",
    ".DS_Store",
}

# Snapshot files that existed before test session started
SESSION_PRE_EXISTING_FILES: Set[str] = set()
for d in [
    os.path.join(BACKEND_ROOT, "uploads"),
    os.path.join(REPO_ROOT, "uploads"),
    os.path.join(BACKEND_ROOT, "static", "videos"),
    os.path.dirname(__file__),
]:
    if os.path.exists(d):
        for root, _, files in os.walk(d):
            if "__pycache__" in root or ".pytest_cache" in root:
                continue
            for f in files:
                SESSION_PRE_EXISTING_FILES.add(os.path.abspath(os.path.join(root, f)))

# Pre-load storage keys referenced in application database (app.db)
APP_DB_STORAGE_KEYS: Set[str] = set()
try:
    _app_db_session = SessionLocal()
    for _tb in _app_db_session.query(Textbook).all():
        if _tb.storage_key:
            APP_DB_STORAGE_KEYS.add(_tb.storage_key)
            APP_DB_STORAGE_KEYS.add(os.path.basename(_tb.storage_key))
    for _v in _app_db_session.query(Video).all():
        for _k in [_v.storage_key, _v.video_storage_key, _v.thumbnail_storage_key, _v.audio_storage_key, _v.captions_storage_key]:
            if _k:
                APP_DB_STORAGE_KEYS.add(_k)
                APP_DB_STORAGE_KEYS.add(os.path.basename(_k))
    _app_db_session.close()
except Exception:
    pass


# Thread-safe in-process test artifact registry
_active_test_artifacts: Set[str] = set()
_registry_lock = threading.Lock()


def register_test_artifact(path: str):
    """Explicitly registers an artifact created by the active test process."""
    if path:
        abs_p = os.path.abspath(path)
        with _registry_lock:
            _active_test_artifacts.add(abs_p)


# Instrument LocalStorageProvider.save_file to track file writes created by tests
_orig_save_file = LocalStorageProvider.save_file
def _instrumented_save_file(self, content: bytes, filename: str, folder: str = "uploads") -> str:
    storage_key = _orig_save_file(self, content, filename, folder)
    target_dir = os.path.join(self.base_dir, folder) if folder != "uploads" else self.base_dir
    file_path = os.path.join(target_dir, os.path.basename(storage_key))
    register_test_artifact(file_path)
    return storage_key

LocalStorageProvider.save_file = _instrumented_save_file


# Instrument TTSAudioCache.put to track audio cache files created by tests
_orig_tts_put = TTSAudioCache.put
def _instrumented_tts_put(self, cache_key: str, result, *args, **kwargs):
    _orig_tts_put(self, cache_key, result, *args, **kwargs)
    register_test_artifact(os.path.join(self.cache_dir, f"{cache_key}.wav"))
    register_test_artifact(os.path.join(self.cache_dir, f"{cache_key}.json"))

TTSAudioCache.put = _instrumented_tts_put


# Instrument VideoGenerationService.run_rendering_pipeline to track video output directories
_orig_run_pipeline = VideoGenerationService.run_rendering_pipeline
def _instrumented_run_pipeline(self, *args, **kwargs):
    res_video = _orig_run_pipeline(self, *args, **kwargs)
    if res_video and hasattr(res_video, "id"):
        local_uploads_dir = getattr(self.storage, "base_dir", os.path.join(os.getcwd(), "uploads"))
        target_video_dir = os.path.join(local_uploads_dir, "videos", str(res_video.id))
        register_test_artifact(target_video_dir)
    return res_video

VideoGenerationService.run_rendering_pipeline = _instrumented_run_pipeline


# Instrument VideoGenerationService.start_video_generation
_orig_start_video = VideoGenerationService.start_video_generation
def _instrumented_start_video(self, *args, **kwargs):
    res_video = _orig_start_video(self, *args, **kwargs)
    if res_video and hasattr(res_video, "id"):
        local_uploads_dir = getattr(self.storage, "base_dir", os.path.join(os.getcwd(), "uploads"))
        target_video_dir = os.path.join(local_uploads_dir, "videos", str(res_video.id))
        register_test_artifact(target_video_dir)
    return res_video

VideoGenerationService.start_video_generation = _instrumented_start_video


# Instrument VideoGenerationService.publish_video to track published video copy
_orig_publish_video = VideoGenerationService.publish_video
def _instrumented_publish_video(self, *args, **kwargs):
    res_video = _orig_publish_video(self, *args, **kwargs)
    video_id = args[0] if args else kwargs.get("video_id")
    if video_id:
        base_dir = getattr(self.storage, "base_dir", os.path.join(os.getcwd(), "uploads"))
        dest_file = os.path.join(base_dir, "videos", str(video_id), f"video_{video_id}.mp4")
        register_test_artifact(dest_file)
    return res_video

VideoGenerationService.publish_video = _instrumented_publish_video


def matches_test_pattern(abs_path: str) -> bool:
    """Verifies that the file/directory strictly matches known test artifact patterns."""
    base = os.path.basename(abs_path)
    # 1. UUID-prefixed test upload or media asset
    if re.match(r"^[0-9a-f]{32}_.*\.(pdf|mp4|wav|srt|jpg|jpeg|png|json)$", base, re.IGNORECASE):
        return True
    # 2. TTS audio cache file
    if re.match(r"^[0-9a-f]{64}\.(wav|json)$", base, re.IGNORECASE):
        return True
    # 3. Test video media or captions
    if base in ["_delivery_probe.mp4", "captions_test.srt"]:
        return True
    if re.match(r"^video_\d+.*(\.mp4|\.wav|\.srt|\.jpg|\.png)$", base, re.IGNORECASE):
        return True
    if re.match(r"^scene_\d+.*(\.png|\.jpg|\.wav)$", base, re.IGNORECASE):
        return True
    # 4. Any file or directory inside a video folder (videos/<id>/...)
    parts = abs_path.split(os.sep)
    if "videos" in parts:
        v_idx = parts.index("videos")
        if len(parts) > v_idx + 1:
            vid_part = parts[v_idx + 1]
            if vid_part.isdigit() or vid_part in ["9999", "8888", "7777", "5555"]:
                return True
    return False


def is_referenced_in_live_app_db(abs_path: str) -> bool:
    """
    Dynamically queries the application database (app.db) immediately before deletion
    to ensure the candidate artifact is not actively referenced by any Textbook or Video record.
    Fails closed: if the database query fails or encounters an exception, returns True
    (indicating the file MUST be considered referenced/protected and NOT deleted).
    """
    abs_p = os.path.abspath(abs_path)
    base = os.path.basename(abs_p)
    try:
        db = SessionLocal()
        try:
            # Check all active Textbook storage references
            for tb in db.query(Textbook).all():
                if tb.storage_key:
                    tb_ref = tb.storage_key.strip()
                    if tb_ref == abs_p or tb_ref == base or os.path.basename(tb_ref) == base:
                        return True
                    if os.path.abspath(tb_ref) == abs_p:
                        return True

            # Check all active Video storage references
            for v in db.query(Video).all():
                for k in [v.storage_key, v.video_storage_key, v.thumbnail_storage_key, v.audio_storage_key, v.captions_storage_key]:
                    if k:
                        v_ref = k.strip()
                        if v_ref == abs_p or v_ref == base or os.path.basename(v_ref) == base:
                            return True
                        if os.path.abspath(v_ref) == abs_p:
                            return True
                        if os.path.isdir(abs_p) and (v_ref.startswith(abs_p) or os.path.abspath(v_ref).startswith(abs_p)):
                            return True
        finally:
            db.close()
    except Exception:
        # FAIL CLOSED: If the database query fails for any reason, treat candidate as protected
        return True

    return False


def is_safe_to_delete_test_artifact(path: str) -> bool:
    """
    Multi-layered safety validation before deleting any artifact.
    Returns True only if the artifact is unequivocally safe to remove.
    """
    abs_p = os.path.abspath(path)
    base = os.path.basename(abs_p)

    # Gate 1: Never delete files that existed prior to test session
    if abs_p in SESSION_PRE_EXISTING_FILES:
        return False

    # Gate 2: Never delete immutable protected files & fixtures
    if base in IMMUTABLE_PROTECTED_FILES:
        return False

    # Gate 3: Never delete files in static startup cache of app.db
    if base in APP_DB_STORAGE_KEYS or abs_p in APP_DB_STORAGE_KEYS:
        return False

    # Gate 4: Candidate must match recognized test artifact pattern
    if not matches_test_pattern(abs_p):
        return False

    # Gate 5: Candidate must reside within allowed test output directories
    if not any(abs_p.startswith(ad) for ad in ALLOWED_TEST_DIRS):
        return False

    # Gate 6: Dynamic database protection - re-query the application database immediately
    # Fails closed: if database query fails or raises an exception, do not delete candidate
    if is_referenced_in_live_app_db(abs_p):
        return False

    return True


@pytest.fixture(scope="session")
def engine(tmp_path_factory):
    temp_dir = tmp_path_factory.mktemp("test_db_dir")
    db_path = str(temp_dir / "test_shared.db")
    db_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=db_engine)
    try:
        yield db_engine
    finally:
        db_engine.dispose()
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass


@pytest.fixture(autouse=True)
def auto_cleanup_test_artifacts():
    """
    Safely cleans up temporary test artifacts explicitly generated during test runs.
    Ensures cleanup happens whether the test passes, fails, or raises an exception.
    Guarantees:
    1. Only artifacts explicitly created by the current test process are eligible.
    2. Files created by other processes are completely ignored (not in registry).
    3. Immutable protected fixtures (Work_Energy_Vdo_test.pdf, etc.) are never deleted.
    4. Files registered in app.db are never deleted.
    5. Pre-existing files that existed before the test session started are never deleted.
    6. Candidate files must strictly match recognized test artifact naming patterns.
    """
    with _registry_lock:
        initial_registered = set(_active_test_artifacts)

    try:
        yield
    finally:
        with _registry_lock:
            test_created = list(_active_test_artifacts - initial_registered)
            _active_test_artifacts.difference_update(test_created)

        for target_path in test_created:
            if not os.path.exists(target_path):
                continue

            if os.path.isfile(target_path):
                if is_safe_to_delete_test_artifact(target_path):
                    try:
                        os.remove(target_path)
                    except OSError:
                        pass
            elif os.path.isdir(target_path):
                if is_safe_to_delete_test_artifact(target_path):
                    # Clean up recognized test artifacts inside the directory first
                    for root, dirs, files in os.walk(target_path, topdown=False):
                        for f in files:
                            fp = os.path.join(root, f)
                            if is_safe_to_delete_test_artifact(fp):
                                try:
                                    os.remove(fp)
                                except OSError:
                                    pass
                        for d in dirs:
                            dp = os.path.join(root, d)
                            try:
                                if os.path.exists(dp) and not os.listdir(dp):
                                    os.rmdir(dp)
                            except OSError:
                                pass
                    try:
                        if os.path.exists(target_path) and not os.listdir(target_path):
                            os.rmdir(target_path)
                    except OSError:
                        pass

        videos_root = os.path.join(BACKEND_ROOT, "uploads", "videos")
        try:
            if os.path.exists(videos_root) and not os.listdir(videos_root):
                os.rmdir(videos_root)
        except OSError:
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
