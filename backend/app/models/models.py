import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum, Boolean, JSON
from sqlalchemy.orm import relationship
from ..core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Role(str, enum.Enum):
    ADMIN = "admin"
    STUDENT = "student"
    PARENT = "parent"
    TEACHER = "teacher"

class PipelineStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class ReviewStatus(str, enum.Enum):
    pending_review = "pending_review"
    published = "published"
    rejected = "rejected"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(320), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(Role), nullable=False)
    linked_student_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # parent/teacher linkage [NEEDS CONFIRMATION] placeholder
    created_at = Column(DateTime, default=utcnow)

class Textbook(Base):
    __tablename__ = "textbooks"
    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=True)
    file_size = Column(Integer, nullable=True)
    status = Column(Enum(PipelineStatus), default=PipelineStatus.uploaded)
    stage = Column(Integer, default=0)  # 0..6
    created_at = Column(DateTime, default=utcnow)
    stages_log = Column(JSON, default=list)  # list of {stage, status, ts}

    chapters = relationship("Chapter", back_populates="textbook", cascade="all, delete-orphan")
    video_units = relationship("VideoUnit", back_populates="textbook", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="textbook", cascade="all, delete-orphan")

class Chapter(Base):
    __tablename__ = "chapters"
    id = Column(Integer, primary_key=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id"), nullable=False)
    title = Column(String(500), nullable=False)
    order_idx = Column(Integer, default=0)
    textbook = relationship("Textbook", back_populates="chapters")
    topics = relationship("Topic", back_populates="chapter", cascade="all, delete-orphan")

class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    title = Column(String(500), nullable=False)
    order_idx = Column(Integer, default=0)
    chapter = relationship("Chapter", back_populates="topics")
    subtopics = relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan")
    video_unit = relationship("VideoUnit", back_populates="topic", uselist=False, cascade="all, delete-orphan")
    quiz = relationship("Quiz", back_populates="topic", uselist=False, cascade="all, delete-orphan")

class Subtopic(Base):
    __tablename__ = "subtopics"
    id = Column(Integer, primary_key=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    title = Column(String(500), nullable=False)
    content_excerpt = Column(Text, nullable=True)
    order_idx = Column(Integer, default=0)
    topic = relationship("Topic", back_populates="subtopics")

class VideoUnit(Base):
    __tablename__ = "video_units"
    id = Column(Integer, primary_key=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    title = Column(String(500), nullable=False)
    script_text = Column(Text, nullable=True)
    video_url = Column(String(1000), nullable=True)  # pre-rendered asset ref
    duration_seconds = Column(Integer, default=330)  # ~5.5 min
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.pending_review)
    created_at = Column(DateTime, default=utcnow)
    textbook = relationship("Textbook", back_populates="video_units")
    topic = relationship("Topic", back_populates="video_unit")

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    title = Column(String(500), nullable=False)
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.pending_review)
    created_at = Column(DateTime, default=utcnow)
    textbook = relationship("Textbook", back_populates="quizzes")
    topic = relationship("Topic", back_populates="quiz")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    stem = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # ["A","B","C","D"]
    correct_idx = Column(Integer, nullable=False)
    objective = Column(String(500), nullable=True)
    adaptive = Column(Boolean, default=False)
    weak_concept = Column(String(200), nullable=True)
    quiz = relationship("Quiz", back_populates="questions")

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    answers = Column(JSON, nullable=False)  # {question_id: chosen_idx}
    score = Column(Float, nullable=False)
    weak_concepts = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow)

class VideoProgress(Base):
    __tablename__ = "video_progress"
    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("video_units.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    progress_pct = Column(Float, default=0)
    completed = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True)
    mastery_threshold = Column(Float, default=80.0)
    adaptive_per_weak = Column(Integer, default=3)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
