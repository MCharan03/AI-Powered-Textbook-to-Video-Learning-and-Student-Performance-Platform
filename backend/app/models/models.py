import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey,
    Enum, Boolean, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship as orm_relationship
from ..core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ==================================================
# ENUMS
# ==================================================
class Role(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class VideoStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    REVIEW = "REVIEW"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"


# Backward compatibility aliases for ReviewStatus and PipelineStatus
class ReviewStatus(str, enum.Enum):
    pending_review = "pending_review"
    published = "published"
    rejected = "rejected"


class PipelineStatus(str, enum.Enum):
    uploaded = "uploaded"
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    review = "review"
    approved = "approved"
    published = "published"


class MasteryLevel(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    NEEDS_PRACTICE = "NEEDS_PRACTICE"
    MASTERED = "MASTERED"


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    TRUE_FALSE = "TRUE_FALSE"
    SHORT_ANSWER = "SHORT_ANSWER"


# ==================================================
# 1. CORE USER ARCHITECTURE
# ==================================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Optional fields for profile display & backward compatibility
    name = Column(String(200), nullable=True)
    email = Column(String(320), unique=True, index=True, nullable=True)

    # Legacy field placeholder (for backwards compatibility)
    linked_student_id = Column(Integer, nullable=True)

    # Role profile associations (1-to-1)
    student = orm_relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")
    parent = orm_relationship("Parent", back_populates="user", uselist=False, cascade="all, delete-orphan")
    teacher = orm_relationship("Teacher", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # Author/Uploader associations
    textbooks_uploaded = orm_relationship("Textbook", back_populates="uploader")
    subjects_created = orm_relationship("Subject", back_populates="creator")

    @property
    def hashed_password(self) -> str:
        return self.password_hash

    @hashed_password.setter
    def hashed_password(self, val: str):
        self.password_hash = val

    @property
    def display_name(self) -> str:
        if self.student and self.student.name:
            return self.student.name
        if self.teacher and self.teacher.name:
            return self.teacher.name
        if self.parent and self.parent.name:
            return self.parent.name
        return self.name or self.username


# ==================================================
# 2. STUDENTS
# ==================================================
class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    student_id = Column(String(100), unique=True, nullable=False, index=True)  # e.g. CMRIT26ECE001
    name = Column(String(200), nullable=False)
    dob = Column(String(50), nullable=True)
    class_ = Column("class", String(100), nullable=True)
    section = Column(String(50), nullable=True)
    roll_number = Column(String(50), nullable=True)
    email = Column(String(320), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = orm_relationship("User", back_populates="student")
    parent_associations = orm_relationship("StudentParent", back_populates="student", cascade="all, delete-orphan")
    teacher_associations = orm_relationship("TeacherStudent", back_populates="student", cascade="all, delete-orphan")
    subject_associations = orm_relationship("StudentSubject", back_populates="student", cascade="all, delete-orphan")
    video_progress = orm_relationship("StudentVideoProgress", back_populates="student", cascade="all, delete-orphan")
    quiz_attempts = orm_relationship("QuizAttempt", back_populates="student", cascade="all, delete-orphan")
    topic_performances = orm_relationship("StudentTopicPerformance", back_populates="student", cascade="all, delete-orphan")
    assignments = orm_relationship("StudentAssignment", back_populates="student", cascade="all, delete-orphan")


# ==================================================
# 3. PARENTS
# ==================================================
class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    parent_id = Column(String(100), unique=True, nullable=False, index=True)  # e.g. PAR-CMRIT001
    name = Column(String(200), nullable=False)
    email = Column(String(320), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = orm_relationship("User", back_populates="parent")
    student_associations = orm_relationship("StudentParent", back_populates="parent", cascade="all, delete-orphan")


# ==================================================
# 4. STUDENT-PARENT RELATIONSHIP
# ==================================================
class StudentParent(Base):
    __tablename__ = "student_parents"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("parents.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship = Column(String(50), nullable=False)  # Father, Mother, Guardian
    created_at = Column(DateTime, default=utcnow, nullable=False)

    student = orm_relationship("Student", back_populates="parent_associations")
    parent = orm_relationship("Parent", back_populates="student_associations")

    __table_args__ = (
        UniqueConstraint("student_id", "parent_id", name="uq_student_parent"),
    )


# ==================================================
# 5. TEACHERS
# ==================================================
class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    teacher_id = Column(String(100), unique=True, nullable=False, index=True)  # e.g. TCH-CMRIT001
    name = Column(String(200), nullable=False)
    email = Column(String(320), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = orm_relationship("User", back_populates="teacher")
    student_associations = orm_relationship("TeacherStudent", back_populates="teacher", cascade="all, delete-orphan")
    assignments = orm_relationship("Assignment", back_populates="teacher")


# ==================================================
# 6. SUBJECTS
# ==================================================
class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    class_ = Column("class", String(100), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    creator = orm_relationship("User", back_populates="subjects_created")
    chapters = orm_relationship("Chapter", back_populates="subject", cascade="all, delete-orphan")
    textbooks = orm_relationship("Textbook", back_populates="subject")
    student_associations = orm_relationship("StudentSubject", back_populates="subject", cascade="all, delete-orphan")
    assignments = orm_relationship("Assignment", back_populates="subject")


# ==================================================
# 7. CHAPTERS
# ==================================================
class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id", ondelete="SET NULL"), nullable=True)
    chapter_number = Column(Integer, default=1, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    status = Column(String(50), default="APPROVED", nullable=False)
    confidence_score = Column(Float, default=1.0, nullable=True)
    order_idx = Column(Integer, default=0)  # Legacy compatibility
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    subject = orm_relationship("Subject", back_populates="chapters")
    textbook = orm_relationship("Textbook", back_populates="chapters")
    topics = orm_relationship("Topic", back_populates="chapter", cascade="all, delete-orphan")
    assignments = orm_relationship("Assignment", back_populates="chapter")


# ==================================================
# 8. TOPICS
# ==================================================
class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    sequence_number = Column(Integer, default=1, nullable=False)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    status = Column(String(50), default="APPROVED", nullable=False)
    confidence_score = Column(Float, default=1.0, nullable=True)
    order_idx = Column(Integer, default=0)  # Legacy compatibility
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    chapter = orm_relationship("Chapter", back_populates="topics")
    subtopics = orm_relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan")
    videos = orm_relationship("Video", back_populates="topic", cascade="all, delete-orphan")
    quizzes = orm_relationship("Quiz", back_populates="topic", cascade="all, delete-orphan")
    topic_performances = orm_relationship("StudentTopicPerformance", back_populates="topic", cascade="all, delete-orphan")
    assignments = orm_relationship("Assignment", back_populates="topic")

    # Legacy 1-to-1 convenience accessors
    @property
    def video_unit(self):
        return self.videos[0] if self.videos else None

    @property
    def quiz(self):
        return self.quizzes[0] if self.quizzes else None


# ==================================================
# 9. SUBTOPICS
# ==================================================
class Subtopic(Base):
    __tablename__ = "subtopics"

    id = Column(Integer, primary_key=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    sequence_number = Column(Integer, default=1, nullable=False)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    status = Column(String(50), default="APPROVED", nullable=False)
    confidence_score = Column(Float, default=1.0, nullable=True)
    content_excerpt = Column(Text, nullable=True)  # Legacy compatibility
    order_idx = Column(Integer, default=0)         # Legacy compatibility
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    topic = orm_relationship("Topic", back_populates="subtopics")
    videos = orm_relationship("Video", back_populates="subtopic")


# ==================================================
# 10. VIDEOS
# ==================================================
class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True)
    subtopic_id = Column(Integer, ForeignKey("subtopics.id", ondelete="SET NULL"), nullable=True, index=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    sequence_number = Column(Integer, default=1, nullable=False)
    duration_seconds = Column(Integer, default=330, nullable=False)  # ~5.5 min
    estimated_duration_seconds = Column(Integer, default=330, nullable=True)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    learning_objective = Column(Text, nullable=True)
    content_outline = Column(JSON, default=list, nullable=True)
    script = Column(Text, nullable=True)
    script_status = Column(String(50), default=None, nullable=True)  # SCRIPT_GENERATION_QUEUED, GENERATING, SCRIPT_REVIEW, NEEDS_REVIEW, SCRIPT_APPROVED, READY_FOR_VIDEO_GENERATION
    script_data = Column(JSON, nullable=True)
    storage_key = Column(String(1000), nullable=True)
    audio_storage_key = Column(String(1000), nullable=True)
    video_storage_key = Column(String(1000), nullable=True)
    thumbnail_storage_key = Column(String(1000), nullable=True)
    captions_storage_key = Column(String(1000), nullable=True)
    render_status = Column(String(50), default="NOT_STARTED", nullable=True)  # NOT_STARTED, AUDIO_GENERATING, AUDIO_READY, RENDERING, RENDERED, FAILED
    render_engine = Column(String(100), default="ffmpeg", nullable=True)
    tts_engine = Column(String(100), default="deterministic", nullable=True)
    voice = Column(String(100), nullable=True)
    actual_duration_seconds = Column(Float, nullable=True)
    render_error = Column(Text, nullable=True)
    rendered_at = Column(DateTime, nullable=True)
    scenes_data = Column(JSON, nullable=True)
    status = Column(String(50), default="REVIEW", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    topic = orm_relationship("Topic", back_populates="videos")
    subtopic = orm_relationship("Subtopic", back_populates="videos")
    textbook = orm_relationship("Textbook", back_populates="videos")
    progress_records = orm_relationship("StudentVideoProgress", back_populates="video", cascade="all, delete-orphan")
    script_versions = orm_relationship("VideoScriptVersion", back_populates="video", cascade="all, delete-orphan", order_by="VideoScriptVersion.version_number.desc()")
    render_versions = orm_relationship("VideoRenderVersion", back_populates="video", cascade="all, delete-orphan", order_by="VideoRenderVersion.version_number.desc()")

    # Legacy attribute compatibility
    @property
    def script_text(self) -> str:
        return self.script or ""

    @script_text.setter
    def script_text(self, val: str):
        self.script = val

    @property
    def video_url(self) -> str:
        return self.video_storage_key or self.storage_key or ""

    @video_url.setter
    def video_url(self, val: str):
        self.storage_key = val
        self.video_storage_key = val

    @property
    def review_status(self) -> ReviewStatus:
        s = (self.status or "").lower()
        if s in ["published"]:
            return ReviewStatus.published
        if s in ["failed", "rejected"]:
            return ReviewStatus.rejected
        return ReviewStatus.pending_review

    @review_status.setter
    def review_status(self, val):
        if hasattr(val, "value"):
            val_str = val.value
        else:
            val_str = str(val)
        if val_str == "published":
            self.status = VideoStatus.PUBLISHED.value
        elif val_str == "rejected":
            self.status = VideoStatus.FAILED.value
        else:
            self.status = VideoStatus.REVIEW.value


# Alias for legacy references
VideoUnit = Video


# ==================================================
# 10b. VIDEO SCRIPT VERSIONS (BUILD 05)
# ==================================================
class VideoScriptVersion(Base):
    __tablename__ = "video_script_versions"

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="SCRIPT_REVIEW", nullable=False)  # SCRIPT_REVIEW, SCRIPT_APPROVED, NEEDS_REVIEW, ARCHIVED
    generation_engine = Column(String(100), default="deterministic", nullable=False)
    quality_score = Column(Float, default=100.0, nullable=True)
    word_count = Column(Integer, default=0, nullable=False)
    target_words = Column(Integer, default=0, nullable=False)
    script_content = Column(JSON, nullable=False)  # sections, quality_breakdown, warnings
    narration_text = Column(Text, nullable=True)
    source_page_start = Column(Integer, nullable=True)
    source_page_end = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    video = orm_relationship("Video", back_populates="script_versions")


# ==================================================
# 10c. VIDEO RENDER VERSIONS (BUILD 06)
# ==================================================
class VideoRenderVersion(Base):
    __tablename__ = "video_render_versions"

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="REVIEW", nullable=False)  # REVIEW, APPROVED, PUBLISHED, SUPERSEDED, FAILED
    render_engine = Column(String(100), default="ffmpeg", nullable=False)
    tts_engine = Column(String(100), default="deterministic", nullable=False)
    voice = Column(String(100), nullable=True)
    actual_duration_seconds = Column(Float, nullable=True)
    video_storage_key = Column(String(1000), nullable=True)
    audio_storage_key = Column(String(1000), nullable=True)
    thumbnail_storage_key = Column(String(1000), nullable=True)
    captions_storage_key = Column(String(1000), nullable=True)
    scenes_data = Column(JSON, nullable=True)
    render_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    video = orm_relationship("Video", back_populates="render_versions")


# ==================================================
# 11. STUDENT VIDEO PROGRESS
# ==================================================
class StudentVideoProgress(Base):
    __tablename__ = "student_video_progress"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    watch_percentage = Column(Float, default=0.0, nullable=False)
    last_position_seconds = Column(Float, default=0.0, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    student = orm_relationship("Student", back_populates="video_progress")
    video = orm_relationship("Video", back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint("student_id", "video_id", name="uq_student_video"),
    )

    # Legacy attribute compatibility
    @property
    def progress_pct(self) -> float:
        return self.watch_percentage

    @progress_pct.setter
    def progress_pct(self, val: float):
        self.watch_percentage = val

    @property
    def user_id(self) -> int:
        return self.student.user_id if self.student else 0


# Alias for legacy references
VideoProgress = StudentVideoProgress


# ==================================================
# 12. QUIZZES
# ==================================================
class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True)
    subtopic_id = Column(Integer, ForeignKey("subtopics.id", ondelete="SET NULL"), nullable=True, index=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    quiz_type = Column(String(50), default="TOPIC", nullable=False)
    passing_score = Column(Float, default=80.0, nullable=False)
    attempt_number = Column(Integer, default=1, nullable=False)
    parent_quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True)
    is_adaptive = Column(Boolean, default=False, nullable=False)
    status = Column(String(50), default="REVIEW", nullable=False)
    generation_engine = Column(String(100), default="deterministic", nullable=True)
    question_count = Column(Integer, default=10, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    topic = orm_relationship("Topic", back_populates="quizzes")
    subtopic = orm_relationship("Subtopic")
    textbook = orm_relationship("Textbook", back_populates="quizzes")
    questions = orm_relationship("Question", back_populates="quiz", cascade="all, delete-orphan", order_by="Question.id.asc()")
    attempts = orm_relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan", order_by="QuizAttempt.submitted_at.desc()")
    parent_quiz = orm_relationship("Quiz", remote_side=[id], backref="child_quizzes")

    @property
    def review_status(self) -> ReviewStatus:
        s = (self.status or "").lower()
        if s in ["published"]:
            return ReviewStatus.published
        if s in ["failed", "rejected"]:
            return ReviewStatus.rejected
        return ReviewStatus.pending_review

    @review_status.setter
    def review_status(self, val):
        if hasattr(val, "value"):
            val_str = val.value
        else:
            val_str = str(val)
        if val_str == "published":
            self.status = "PUBLISHED"
        elif val_str == "rejected":
            self.status = "REJECTED"
        else:
            self.status = "REVIEW"


# ==================================================
# 13. QUESTIONS
# ==================================================
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default=QuestionType.MCQ.value, nullable=False)
    difficulty = Column(String(50), default="MEDIUM", nullable=False)
    bloom_level = Column(String(50), default="UNDERSTAND", nullable=True)
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    options = Column(JSON, nullable=True)  # List of options for MCQ e.g. ["A", "B", "C", "D"] or [{"id": "A", "text": "..."}]
    objective = Column(String(500), nullable=True)
    adaptive = Column(Boolean, default=False)
    weak_concept = Column(String(200), nullable=True)
    source_reference = Column(String(500), nullable=True)
    source_pages = Column(JSON, default=list, nullable=True)
    order_index = Column(Integer, default=0, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    quiz = orm_relationship("Quiz", back_populates="questions")

    # Legacy attribute compatibility
    @property
    def stem(self) -> str:
        return self.question_text

    @stem.setter
    def stem(self, val: str):
        self.question_text = val

    @property
    def correct_idx(self) -> int:
        try:
            return int(self.correct_answer)
        except (ValueError, TypeError):
            if self.options and self.correct_answer in self.options:
                return self.options.index(self.correct_answer)
            return 0

    @correct_idx.setter
    def correct_idx(self, val: int):
        self.correct_answer = str(val)


# ==================================================
# 14. QUIZ ATTEMPTS
# ==================================================
class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    total_questions = Column(Integer, default=0, nullable=False)
    percentage = Column(Float, default=0.0, nullable=False)
    passed = Column(Boolean, default=False, nullable=False)
    answers = Column(JSON, nullable=True)  # {question_id: chosen_answer}
    question_results = Column(JSON, default=list, nullable=True)
    weak_concepts = Column(JSON, default=list)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    submitted_at = Column(DateTime, default=utcnow, nullable=False)

    quiz = orm_relationship("Quiz", back_populates="attempts")
    student = orm_relationship("Student", back_populates="quiz_attempts")

    @property
    def created_at(self) -> datetime:
        return self.submitted_at

    @property
    def user_id(self) -> int:
        return self.student.user_id if self.student else 0


# ==================================================
# 15. STUDENT TOPIC PERFORMANCE
# ==================================================
class StudentTopicPerformance(Base):
    __tablename__ = "student_topic_performance"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    best_score = Column(Float, default=0.0, nullable=False)
    latest_score = Column(Float, default=0.0, nullable=False)
    mastery_level = Column(String(50), default=MasteryLevel.NOT_STARTED.value, nullable=False)
    last_attempted_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    student = orm_relationship("Student", back_populates="topic_performances")
    topic = orm_relationship("Topic", back_populates="topic_performances")

    __table_args__ = (
        UniqueConstraint("student_id", "topic_id", name="uq_student_topic_perf"),
    )


# ==================================================
# 16. ASSIGNMENTS
# ==================================================
class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    total_points = Column(Float, default=100.0, nullable=False)
    attachment_url = Column(String(1000), nullable=True)
    status = Column(String(50), default="PUBLISHED", nullable=False)  # DRAFT, PUBLISHED, ARCHIVED
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    teacher = orm_relationship("Teacher", back_populates="assignments")
    subject = orm_relationship("Subject", back_populates="assignments")
    chapter = orm_relationship("Chapter", back_populates="assignments")
    topic = orm_relationship("Topic", back_populates="assignments")
    student_assignments = orm_relationship("StudentAssignment", back_populates="assignment", cascade="all, delete-orphan")


# ==================================================
# 17. STUDENT ASSIGNMENTS
# ==================================================
class StudentAssignment(Base):
    __tablename__ = "student_assignments"

    id = Column(Integer, primary_key=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, IN_PROGRESS, SUBMITTED, LATE, GRADED
    submission_text = Column(Text, nullable=True)
    submission_url = Column(String(1000), nullable=True)
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    graded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    assignment = orm_relationship("Assignment", back_populates="student_assignments")
    student = orm_relationship("Student", back_populates="assignments")

    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_student_assignment"),
    )


# ==================================================
# 18. TEACHER-STUDENT RELATIONSHIP
# ==================================================
class TeacherStudent(Base):
    __tablename__ = "teacher_students"

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    teacher = orm_relationship("Teacher", back_populates="student_associations")
    student = orm_relationship("Student", back_populates="teacher_associations")

    __table_args__ = (
        UniqueConstraint("teacher_id", "student_id", name="uq_teacher_student"),
    )


# ==================================================
# 19. STUDENT-SUBJECT RELATIONSHIP
# ==================================================
class StudentSubject(Base):
    __tablename__ = "student_subjects"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, default=utcnow, nullable=False)

    student = orm_relationship("Student", back_populates="subject_associations")
    subject = orm_relationship("Subject", back_populates="student_associations")

    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", name="uq_student_subject"),
    )


# ==================================================
# 20. PROCESSING JOBS
# ==================================================
class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id", ondelete="SET NULL"), nullable=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True)
    job_type = Column(String(100), default="INGESTION", nullable=False)
    status = Column(String(50), default=JobStatus.QUEUED.value, nullable=False)
    progress = Column(Float, default=0.0, nullable=False)
    current_stage = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    textbook = orm_relationship("Textbook", back_populates="processing_jobs")
    chapter = orm_relationship("Chapter")
    topic = orm_relationship("Topic")
    video = orm_relationship("Video")


# ==================================================
# 21. TEXTBOOKS
# ==================================================
class Textbook(Base):
    __tablename__ = "textbooks"

    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    original_filename = Column(String(500), nullable=True)
    storage_key = Column(String(1000), nullable=True)
    status = Column(Enum(PipelineStatus), default=PipelineStatus.uploaded, nullable=False)

    # Legacy fields
    filename = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)
    file_size = Column(Integer, nullable=True)
    stage = Column(Integer, default=0)
    stages_log = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def __init__(self, *args, **kwargs):
        if "filename" in kwargs and "original_filename" not in kwargs:
            kwargs["original_filename"] = kwargs["filename"]
        elif "original_filename" in kwargs and "filename" not in kwargs:
            kwargs["filename"] = kwargs["original_filename"]
        super().__init__(*args, **kwargs)

    subject = orm_relationship("Subject", back_populates="textbooks")
    uploader = orm_relationship("User", back_populates="textbooks_uploaded")
    chapters = orm_relationship("Chapter", back_populates="textbook", cascade="all, delete-orphan")
    chapters_extract = orm_relationship("ChapterExtract", back_populates="textbook", cascade="all, delete-orphan")
    videos = orm_relationship("Video", back_populates="textbook", cascade="all, delete-orphan")
    quizzes = orm_relationship("Quiz", back_populates="textbook", cascade="all, delete-orphan")
    processing_jobs = orm_relationship("ProcessingJob", back_populates="textbook")

    # Legacy relationship alias
    @property
    def video_units(self):
        return self.videos


# ==================================================
# 22. CURRICULUM EXTRACTION MODELS (RAW AI EXTRACTION)
# ==================================================
class ChapterExtract(Base):
    __tablename__ = "chapters_extract"

    id = Column(Integer, primary_key=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_number = Column(Integer, default=1, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    confidence_score = Column(Float, default=1.0, nullable=True)
    status = Column(String(50), default="DRAFT", nullable=False)  # DRAFT, REVIEW, APPROVED, REPLACED
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    textbook = orm_relationship("Textbook", back_populates="chapters_extract")
    topics_extract = orm_relationship("TopicExtract", back_populates="chapter_extract", cascade="all, delete-orphan")


class TopicExtract(Base):
    __tablename__ = "topics_extract"

    id = Column(Integer, primary_key=True)
    chapter_extract_id = Column(Integer, ForeignKey("chapters_extract.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_number = Column(Integer, default=1, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    confidence_score = Column(Float, default=1.0, nullable=True)
    status = Column(String(50), default="DRAFT", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    chapter_extract = orm_relationship("ChapterExtract", back_populates="topics_extract")
    subtopics_extract = orm_relationship("SubtopicExtract", back_populates="topic_extract", cascade="all, delete-orphan")


class SubtopicExtract(Base):
    __tablename__ = "subtopics_extract"

    id = Column(Integer, primary_key=True)
    topic_extract_id = Column(Integer, ForeignKey("topics_extract.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_number = Column(Integer, default=1, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source_start_page = Column(Integer, nullable=True)
    source_end_page = Column(Integer, nullable=True)
    confidence_score = Column(Float, default=1.0, nullable=True)
    status = Column(String(50), default="DRAFT", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    topic_extract = orm_relationship("TopicExtract", back_populates="subtopics_extract")


# ==================================================
# SYSTEM SETTINGS
# ==================================================
class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)
    mastery_threshold = Column(Float, default=80.0, nullable=False)
    adaptive_per_weak = Column(Integer, default=3, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
