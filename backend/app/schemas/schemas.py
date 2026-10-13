from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    linked_student_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    linked_student_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class TextbookOut(BaseModel):
    id: int
    title: str
    filename: str
    file_size: Optional[int] = None
    status: str
    stage: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class PipelineTriggerOut(BaseModel):
    task_id: str
    textbook_id: int
    status: str
    message: str

class PipelineStatusOut(BaseModel):
    textbook_id: int
    status: str
    stage: int
    stages_log: List[Any] = []

class SubtopicOut(BaseModel):
    id: int
    title: str
    order_idx: int
    model_config = ConfigDict(from_attributes=True)

class TopicHierarchyOut(BaseModel):
    id: int
    title: str
    order_idx: int
    subtopics: List[SubtopicOut] = []
    model_config = ConfigDict(from_attributes=True)

class ChapterHierarchyOut(BaseModel):
    id: int
    title: str
    order_idx: int
    topics: List[TopicHierarchyOut] = []
    model_config = ConfigDict(from_attributes=True)

class HierarchyOut(BaseModel):
    textbook_id: int
    title: str
    chapters: List[ChapterHierarchyOut] = []

class ReviewItemOut(BaseModel):
    id: int
    type: str  # video | quiz
    item_id: int
    title: str
    topic_title: Optional[str] = None
    review_status: str
    created_at: Optional[datetime] = None

class ReviewDetailOut(BaseModel):
    id: int
    type: str  # video | quiz
    item_id: int
    title: str
    topic_title: Optional[str] = None
    review_status: str
    script_text: Optional[str] = None
    video_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    questions: Optional[List[Any]] = None
    created_at: Optional[datetime] = None

class ApprovalIn(BaseModel):
    decision: str = "approve"  # approve | reject [NEEDS CONFIRMATION]
    notes: Optional[str] = None

class ApprovalOut(BaseModel):
    id: int
    type: str
    item_id: int
    status: str
    approved_at: Optional[datetime] = None

class SettingsOut(BaseModel):
    mastery_threshold: float
    adaptive_per_weak: int
    model_config = ConfigDict(from_attributes=True)

class SettingsIn(BaseModel):
    mastery_threshold: float
    adaptive_per_weak: int

class VideoOut(BaseModel):
    id: int
    title: str
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    video_url: Optional[str] = None
    duration_seconds: int
    script_text: Optional[str] = None
    review_status: str

class ProgressIn(BaseModel):
    progress_pct: float
    completed: Optional[bool] = None

class ProgressOut(BaseModel):
    video_id: int
    user_id: int
    progress_pct: float
    completed: bool

class QuestionOut(BaseModel):
    id: int
    stem: str
    options: List[str]
    objective: Optional[str] = None
    adaptive: bool = False
    weak_concept: Optional[str] = None

class QuizOut(BaseModel):
    id: int
    title: str
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    review_status: str
    questions: List[QuestionOut] = []

class AttemptIn(BaseModel):
    answers: Dict[str, int]  # {str(question_id): chosen_option_idx}

class AttemptOut(BaseModel):
    id: int
    quiz_id: int
    user_id: int
    score: float
    passed: bool
    weak_concepts: List[str] = []
    created_at: Optional[datetime] = None

class AdaptiveQuizOut(BaseModel):
    session_id: str
    topic_id: Optional[int] = None
    identified_weak_concepts: List[str] = []
    questions: List[QuestionOut] = []

class StudentProgressSummary(BaseModel):
    student_id: int
    student_name: str
    completed_videos_count: int
    total_videos_count: int
    quizzes_taken_count: int
    average_quiz_score: float
    mastery_scores: Dict[str, float] = {}
    weak_concepts: List[str] = []
