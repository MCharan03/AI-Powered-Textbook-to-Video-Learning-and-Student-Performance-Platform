from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import List, Optional, Any, Dict
from datetime import datetime


# ==================================================
# AUTH & USER SCHEMAS
# ==================================================
class LoginIn(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    identifier: Optional[str] = None
    role: Optional[str] = None
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    username: Optional[str] = None
    name: str


class UserCreate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    password: str
    role: str
    student_id: Optional[str] = None
    parent_id: Optional[str] = None
    teacher_id: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    linked_student_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    username: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_active: bool = True
    student_id: Optional[str] = None
    parent_id: Optional[str] = None
    teacher_id: Optional[str] = None
    linked_student_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


from typing import Generic, TypeVar

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

# ==================================================
# STUDENT, PARENT, TEACHER SCHEMAS
# ==================================================
class StudentCreate(BaseModel):
    student_id: str
    name: str
    dob: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    section: Optional[str] = None
    roll_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    model_config = ConfigDict(populate_by_name=True)


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    section: Optional[str] = None
    roll_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    model_config = ConfigDict(populate_by_name=True)


class ParentLinkOut(BaseModel):
    id: int  # student_parent link id
    parent_id: str
    parent_db_id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    relationship: str
    created_at: Optional[datetime] = None


class TeacherLinkOut(BaseModel):
    id: int  # teacher_student link id
    teacher_id: str
    teacher_db_id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[datetime] = None


class SubjectLinkOut(BaseModel):
    id: int  # student_subject link id
    subject_id: int
    name: str
    class_: Optional[str] = Field(None, alias="class")
    assigned_at: Optional[datetime] = None
    model_config = ConfigDict(populate_by_name=True)


class StudentOut(BaseModel):
    id: int
    user_id: int
    student_id: str
    name: str
    dob: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    section: Optional[str] = None
    roll_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    assigned_subjects: List[str] = []
    assigned_teachers: List[str] = []
    parents_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class StudentDetailOut(StudentOut):
    parents: List[ParentLinkOut] = []
    teachers: List[TeacherLinkOut] = []
    subjects: List[SubjectLinkOut] = []
    recent_activity: List[Dict[str, Any]] = []


class StudentLinkOut(BaseModel):
    id: int  # link id
    student_id: str
    student_db_id: int
    name: str
    class_: Optional[str] = Field(None, alias="class")
    section: Optional[str] = None
    relationship: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(populate_by_name=True)


class ParentCreate(BaseModel):
    parent_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class ParentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class ParentOut(BaseModel):
    id: int
    user_id: int
    parent_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    linked_students_count: int = 0
    linked_students_summary: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ParentDetailOut(ParentOut):
    linked_students: List[StudentLinkOut] = []


class TeacherCreate(BaseModel):
    teacher_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class TeacherOut(BaseModel):
    id: int
    user_id: int
    teacher_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    assigned_students_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TeacherDetailOut(TeacherOut):
    assigned_students: List[StudentLinkOut] = []


# ==================================================
# RELATIONSHIP ASSIGNMENT SCHEMAS
# ==================================================
class StudentParentLinkIn(BaseModel):
    parent_id: Any  # string parent_id (e.g. PAR-CMRIT001) or int id
    relationship: str  # Father, Mother, Guardian


class TeacherStudentLinkIn(BaseModel):
    student_id: Any  # string student_id (e.g. CMRIT26ECE001) or int id


class StudentSubjectLinkIn(BaseModel):
    subject_id: int


# ==================================================
# SUBJECT & CONTENT HIERARCHY SCHEMAS
# ==================================================
class SubjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    model_config = ConfigDict(populate_by_name=True)


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    model_config = ConfigDict(populate_by_name=True)


class ChapterOut(BaseModel):
    id: int
    subject_id: int
    chapter_number: int
    title: str
    description: Optional[str] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    status: Optional[str] = None
    confidence_score: Optional[float] = None
    topics_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SubjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    created_by: Optional[int] = None
    chapters_count: int = 0
    students_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class SubjectDetailOut(SubjectOut):
    chapters: List[ChapterOut] = []


class ChapterCreate(BaseModel):
    chapter_number: int = 1
    title: str
    description: Optional[str] = None


class ChapterUpdate(BaseModel):
    chapter_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None


class SubtopicCreate(BaseModel):
    sequence_number: int = 1
    title: str
    description: Optional[str] = None


class SubtopicUpdate(BaseModel):
    sequence_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None


class SubtopicOut(BaseModel):
    id: int
    topic_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    sequence_number: int = 1
    order_idx: int = 0
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    status: Optional[str] = None
    confidence_score: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TopicCreate(BaseModel):
    sequence_number: int = 1
    title: str
    description: Optional[str] = None


class TopicUpdate(BaseModel):
    sequence_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None


class TopicOut(BaseModel):
    id: int
    chapter_id: int
    sequence_number: int
    title: str
    description: Optional[str] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    status: Optional[str] = None
    confidence_score: Optional[float] = None
    subtopics_count: int = 0
    videos_count: int = 0
    quizzes_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TopicDetailOut(TopicOut):
    subtopics: List[SubtopicOut] = []
    videos: List[Any] = []
    quizzes: List[Any] = []


class ChapterDetailOut(ChapterOut):
    topics: List[TopicOut] = []


class TopicHierarchyOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    sequence_number: int = 1
    order_idx: int = 0
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    status: Optional[str] = None
    confidence_score: Optional[float] = None
    subtopics: List[SubtopicOut] = []
    model_config = ConfigDict(from_attributes=True)


class ChapterHierarchyOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    chapter_number: int = 1
    order_idx: int = 0
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    status: Optional[str] = None
    confidence_score: Optional[float] = None
    topics: List[TopicHierarchyOut] = []
    model_config = ConfigDict(from_attributes=True)


class HierarchyOut(BaseModel):
    textbook_id: int
    title: str
    status: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    chapters: List[ChapterHierarchyOut] = []


# ==================================================
# TEXTBOOK & PIPELINE SCHEMAS
# ==================================================
class TextbookOut(BaseModel):
    id: int
    title: str
    filename: Optional[str] = None
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    storage_key: Optional[str] = None
    status: str
    stage: int = 0
    subject_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TextbookListItemOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    original_filename: Optional[str] = None
    storage_key: Optional[str] = None
    status: str
    current_stage: Optional[str] = None
    progress: float = 0.0
    error_message: Optional[str] = None
    uploaded_by: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    chapters_count: int = 0
    topics_count: int = 0
    subtopics_count: int = 0
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TextbookDetailOut(TextbookListItemOut):
    stages_log: List[Any] = []


class ChapterPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    chapter_number: Optional[int] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None


class TopicPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sequence_number: Optional[int] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None


class SubtopicPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sequence_number: Optional[int] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None


class RegenerationRequest(BaseModel):
    target: str = "all"  # all, chapters, topics, subtopics


class RegenerationComparisonOut(BaseModel):
    textbook_id: int
    target: str
    current_curriculum: List[Any] = []
    draft_curriculum: List[Any] = []
    comparison: Optional[Dict[str, Any]] = None
    message: str


class PipelineTriggerOut(BaseModel):
    task_id: str
    textbook_id: int
    status: str
    message: str


class PipelineStatusOut(BaseModel):
    textbook_id: int
    status: str
    stage: int
    current_stage: Optional[str] = None
    progress: float = 0.0
    error_message: Optional[str] = None
    stages_log: List[Any] = []


class ProcessingJobOut(BaseModel):
    id: int
    textbook_id: Optional[int] = None
    job_type: str
    status: str
    progress: float
    current_stage: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ==================================================
# VIDEO & PROGRESS SCHEMAS
# ==================================================
class VideoOut(BaseModel):
    id: int
    title: str
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    subtopic_id: Optional[int] = None
    video_url: Optional[str] = None
    storage_key: Optional[str] = None
    duration_seconds: int = 330
    script_text: Optional[str] = None
    status: Optional[str] = None
    review_status: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    description: Optional[str] = None
    learning_objective: Optional[str] = None
    content_outline: Optional[List[str]] = None
    actual_duration_seconds: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


class VideoPlanOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subtopic_id: Optional[int] = None
    subtopic_title: Optional[str] = None
    sequence_number: int = 1
    duration_seconds: int = 330
    estimated_duration_seconds: Optional[int] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    learning_objective: Optional[str] = None
    content_outline: Optional[List[str]] = None
    status: str = "REVIEW"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class VideoPlanPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sequence_number: Optional[int] = None
    estimated_duration_seconds: Optional[int] = None
    duration_seconds: Optional[int] = None
    source_start_page: Optional[int] = None
    source_end_page: Optional[int] = None
    learning_objective: Optional[str] = None
    content_outline: Optional[List[str]] = None


class VideoPlanRegenerationOut(BaseModel):
    topic_id: int
    topic_title: str
    has_existing_plans: bool
    current_plans: List[Any] = []
    new_plans: List[Any] = []
    comparison: Dict[str, Any] = {}
    message: str


class VideoPlanGenerateRequest(BaseModel):
    force_regenerate: bool = False


# ==================================================
# BUILD 05: SCRIPT GENERATION SCHEMAS
# ==================================================
class ScriptSection(BaseModel):
    section_id: int
    type: str  # INTRO, OBJECTIVE, CONCEPT, DEFINITION, DETAILED_EXPLANATION, EXAMPLE, FORMULA, APPLICATION, SUMMARY, CLOSING
    title: str
    narration: str
    source_pages: List[int] = []
    visual_type: str = "DIAGRAM"  # TITLE_CARD, DIAGRAM, FORMULA_CARD, CODE_SNIPPET, ANIMATION, SUMMARY_CHIPS
    visual_description: Optional[str] = None
    on_screen_text: Optional[str] = None
    formula: Optional[str] = None
    diagram_description: Optional[str] = None
    animation_hint: Optional[str] = None


class ScriptQualityBreakdown(BaseModel):
    objective_coverage: float = 100.0
    outline_coverage: float = 100.0
    duration_alignment: float = 100.0
    source_grounding: float = 100.0
    structural_completeness: float = 100.0


class ScriptOut(BaseModel):
    id: int
    video_id: int
    version_number: int = 1
    title: str
    script_status: str = "SCRIPT_REVIEW"  # SCRIPT_GENERATION_QUEUED, GENERATING, SCRIPT_REVIEW, NEEDS_REVIEW, SCRIPT_APPROVED, READY_FOR_VIDEO_GENERATION
    generation_engine: str = "deterministic"
    quality_score: float = 100.0
    quality_breakdown: Optional[Dict[str, Any]] = None
    word_count: int = 0
    target_words: int = 0
    estimated_duration_seconds: int = 330
    source_page_start: Optional[int] = None
    source_page_end: Optional[int] = None
    sections: List[ScriptSection] = []
    narration_text: Optional[str] = None
    warnings: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ScriptPatch(BaseModel):
    title: Optional[str] = None
    narration_text: Optional[str] = None
    sections: Optional[List[ScriptSection]] = None
    quality_score: Optional[float] = None
    script_status: Optional[str] = None


class ScriptRegenerationPreview(BaseModel):
    video_id: int
    video_title: str
    has_existing_script: bool
    current_script: Optional[ScriptOut] = None
    new_script: ScriptOut
    comparison: Dict[str, Any] = {}
    message: str


class ScriptGenerateRequest(BaseModel):
    force_regenerate: bool = False
    engine: Optional[str] = None


# ==================================================
# BUILD 06: SCENE & VIDEO RENDERING SCHEMAS
# ==================================================
class SceneDefinition(BaseModel):
    scene_number: int
    section_type: str  # INTRO, OBJECTIVE, CONCEPT, DEFINITIONS, FORMULA, DETAILED_EXPLANATION, EXAMPLE, APPLICATION, SUMMARY
    title: str
    narration_text: str
    visual_type: str  # TITLE_CARD, TEXT, SUMMARY_CHIPS, DIAGRAM, FORMULA_CARD, CODE_SNIPPET, EXAMPLE, FLOW_DIAGRAM
    visual_description: Optional[str] = None
    on_screen_text: Optional[str] = None
    formula: Optional[str] = None
    animation_hint: Optional[str] = None
    source_pages: List[int] = []
    estimated_duration_seconds: float = 30.0
    start_time_seconds: float = 0.0
    end_time_seconds: float = 30.0


class SceneOut(SceneDefinition):
    pass


class VideoRenderOut(BaseModel):
    id: int
    video_id: int
    version_number: int = 1
    title: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    chapter_title: Optional[str] = None
    topic_title: Optional[str] = None
    subtopic_title: Optional[str] = None
    approved_duration_seconds: int = 330
    actual_duration_seconds: Optional[float] = None
    render_status: str = "NOT_STARTED"  # NOT_STARTED, AUDIO_GENERATING, AUDIO_READY, RENDERING, RENDERED, FAILED
    status: str = "REVIEW"  # REVIEW, APPROVED, PUBLISHED, FAILED
    script_status: Optional[str] = None
    tts_engine: Optional[str] = None
    tts_provider: Optional[str] = None
    voice_quality: Optional[str] = None
    audio_quality: Optional[str] = None
    speaking_rate: Optional[str] = None
    render_engine: Optional[str] = None
    voice: Optional[str] = None
    video_url: Optional[str] = None
    video_storage_key: Optional[str] = None
    audio_storage_key: Optional[str] = None
    thumbnail_url: Optional[str] = None
    thumbnail_storage_key: Optional[str] = None
    captions_storage_key: Optional[str] = None
    captions_url: Optional[str] = None
    captions_srt: Optional[str] = None
    scenes: List[SceneOut] = []
    source_page_start: Optional[int] = None
    source_page_end: Optional[int] = None
    render_error: Optional[str] = None
    job_id: Optional[int] = None
    video_plan_status: Optional[str] = None
    rendered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class VideoGenerationStatusOut(BaseModel):
    video_id: int
    video_title: str
    job_id: Optional[int] = None
    job_status: str = "COMPLETED"
    current_stage: str = "COMPLETED"
    progress: float = 100.0
    render_status: str = "RENDERED"
    video_status: str = "REVIEW"
    actual_duration_seconds: Optional[float] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    error_message: Optional[str] = None


class VideoGenerateRequest(BaseModel):
    force: bool = False
    tts_engine: Optional[str] = None
    voice: Optional[str] = None


class VideoRegenerateRequest(BaseModel):
    force: bool = True
    regenerate_audio_only: bool = False
    regenerate_video_only: bool = False
    tts_engine: Optional[str] = None
    voice: Optional[str] = None


class VideoApproveRequest(BaseModel):
    notes: Optional[str] = None


class VideoPublishRequest(BaseModel):
    publish: bool = True


class ProgressIn(BaseModel):
    progress_pct: Optional[float] = None
    watch_percentage: Optional[float] = None
    last_position_seconds: Optional[float] = None
    completed: Optional[bool] = None


class ProgressOut(BaseModel):
    video_id: int
    user_id: int
    progress_pct: float
    last_position_seconds: float = 0.0
    completed: bool


# ==================================================
# QUIZ & ATTEMPT SCHEMAS
# ==================================================
class QuestionOut(BaseModel):
    id: int
    stem: Optional[str] = ""
    question_text: Optional[str] = None
    options: List[Any] = []
    objective: Optional[str] = None
    adaptive: bool = False
    weak_concept: Optional[str] = None
    question_type: str = "MCQ"
    difficulty: str = "MEDIUM"
    bloom_level: Optional[str] = "UNDERSTAND"
    source_reference: Optional[str] = None
    source_pages: List[int] = []
    order_index: int = 0
    model_config = ConfigDict(from_attributes=True)


class QuizOut(BaseModel):
    id: int
    title: str
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    description: Optional[str] = None
    quiz_type: str = "TOPIC"
    passing_score: float = 80.0
    attempt_number: int = 1
    parent_quiz_id: Optional[int] = None
    is_adaptive: bool = False
    review_status: str
    status: Optional[str] = None
    questions: List[QuestionOut] = []
    model_config = ConfigDict(from_attributes=True)


class AdminQuestionOut(BaseModel):
    id: int
    quiz_id: int
    question_text: str
    stem: str
    options: List[Any] = []
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: str = "MEDIUM"
    bloom_level: str = "UNDERSTAND"
    objective: Optional[str] = None
    adaptive: bool = False
    weak_concept: Optional[str] = None
    source_reference: Optional[str] = None
    source_pages: List[int] = []
    order_index: int = 0
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class AdminQuizOut(BaseModel):
    id: int
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subtopic_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    quiz_type: str = "TOPIC"
    passing_score: float = 80.0
    attempt_number: int = 1
    parent_quiz_id: Optional[int] = None
    is_adaptive: bool = False
    status: str = "REVIEW"
    review_status: str
    generation_engine: Optional[str] = "deterministic"
    question_count: int = 0
    questions: List[AdminQuestionOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class QuizGenerateRequest(BaseModel):
    question_count: Optional[int] = 10
    passing_score: Optional[float] = 80.0
    engine: Optional[str] = "deterministic"
    subtopic_id: Optional[int] = None


class QuizPatchRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    passing_score: Optional[float] = None
    status: Optional[str] = None


class QuestionPatchRequest(BaseModel):
    question_text: Optional[str] = None
    options: Optional[List[Any]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    bloom_level: Optional[str] = None
    weak_concept: Optional[str] = None


class QuestionCreateRequest(BaseModel):
    question_text: str
    options: List[Any]
    correct_answer: str
    explanation: str
    difficulty: str = "MEDIUM"
    bloom_level: str = "UNDERSTAND"
    weak_concept: Optional[str] = None
    source_reference: Optional[str] = None


class AttemptIn(BaseModel):
    answers: Dict[str, Any]  # {str(question_id): chosen_option_idx_or_letter}


class AttemptOut(BaseModel):
    id: int
    quiz_id: int
    user_id: int
    score: float
    percentage: float = 0.0
    passed: bool
    weak_concepts: List[str] = []
    created_at: Optional[datetime] = None


class QuestionResultOut(BaseModel):
    question_id: int
    question_text: str
    selected_answer: Any
    correct_answer: str
    is_correct: bool
    explanation: Optional[str] = None
    weak_concept: Optional[str] = None
    difficulty: str
    bloom_level: str


class StudentQuizResultOut(BaseModel):
    id: int
    attempt_id: int
    quiz_id: int
    student_id: int
    user_id: int
    score: float
    total_questions: int
    percentage: float
    passed: bool
    passing_score: float = 80.0
    mastery_level: Optional[str] = None
    weak_concepts: List[str] = []
    recommendation: str = ""
    adaptive_recommended: bool = False
    question_results: List[QuestionResultOut] = []
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class StudentTopicPerformanceOut(BaseModel):
    student_id: int
    topic_id: int
    topic_title: Optional[str] = None
    attempts: int
    best_score: float
    latest_score: float
    mastery_level: str
    last_attempted_at: Optional[datetime] = None


class AdaptiveQuizOut(BaseModel):
    session_id: str
    topic_id: Optional[int] = None
    identified_weak_concepts: List[str] = []
    questions: List[QuestionOut] = []


# ==================================================
# REVIEW & SETTINGS SCHEMAS
# ==================================================
class ReviewItemOut(BaseModel):
    id: int
    type: str  # video | quiz
    item_id: int
    topic_id: Optional[int] = None
    title: str
    topic_title: Optional[str] = None
    review_status: str
    status: Optional[str] = None
    subject_name: Optional[str] = None
    chapter_title: Optional[str] = None
    subtopic_title: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class ReviewDetailOut(BaseModel):
    id: int
    type: str  # video | quiz
    item_id: int
    title: str
    topic_title: Optional[str] = None
    review_status: str
    status: Optional[str] = None
    subject_name: Optional[str] = None
    chapter_title: Optional[str] = None
    subtopic_title: Optional[str] = None
    script_text: Optional[str] = None
    video_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    questions: Optional[List[Any]] = None
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class ApprovalIn(BaseModel):
    decision: str = "approve"  # approve | reject
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


# ==================================================
# ASSIGNMENT SCHEMAS
# ==================================================
class AssignmentCreate(BaseModel):
    subject_id: int
    chapter_id: Optional[int] = None
    topic_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class AssignmentOut(BaseModel):
    id: int
    teacher_id: int
    subject_id: int
    chapter_id: Optional[int] = None
    topic_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class StudentAssignmentSubmit(BaseModel):
    submission_url: str


class StudentAssignmentOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    status: str
    submission_url: Optional[str] = None
    score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ==================================================
# DASHBOARD PROGRESS SUMMARY
# ==================================================
class StudentResumeLearning(BaseModel):
    video_id: int
    video_title: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    duration_seconds: int = 330
    duration_minutes_formatted: Optional[str] = None
    progress_percentage: float = 0.0
    completed: bool = False
    video_url: Optional[str] = None
    description: Optional[str] = None
    learning_objective: Optional[str] = None


class StudentModuleCard(BaseModel):
    id: int
    title: str
    type: str  # 'video' or 'quiz'
    subject_name: str
    chapter_title: str
    topic_title: str
    topic_id: int
    item_id: int  # video_id or quiz_id
    duration_seconds: Optional[int] = None
    question_count: Optional[int] = None
    status: str
    action_label: str
    action_route: str


class StudentProgressSummary(BaseModel):
    student_id: int
    student_name: str
    completed_videos_count: int
    total_videos_count: int
    quizzes_taken_count: int
    average_quiz_score: float
    mastery_scores: Dict[str, float] = {}
    weak_concepts: List[str] = []
    assigned_subjects: List[str] = []
    resume_learning: Optional[StudentResumeLearning] = None
    modules: List[StudentModuleCard] = []
    quizzes: List[StudentModuleCard] = []


class DashboardTrendPoint(BaseModel):
    month: str
    average_score: float
    assessments_count: int


class DashboardTopicMastery(BaseModel):
    topic: str
    score: float
    mastery_level: str


class ObserverStudentAnalytics(BaseModel):
    student_id: int
    student_name: str
    student_code: str
    class_name: Optional[str] = None
    section: Optional[str] = None
    mastery_percentage: float
    average_quiz_score: float
    topics_completed: int
    total_topics: int
    videos_completed: int
    total_videos: int
    quizzes_taken: int
    weak_concepts: List[str] = []
    topic_mastery: List[DashboardTopicMastery] = []
    score_trend: List[DashboardTrendPoint] = []


class ObserverDashboardSummary(BaseModel):
    role: str
    students_count: int
    average_mastery_percentage: float
    average_quiz_score: float
    video_completion_percentage: float
    students_needing_attention: int
    score_trend: List[DashboardTrendPoint] = []
    students: List[ObserverStudentAnalytics] = []


# ==================================================
# BUILD 8.1 — PARENT CHILD PROGRESS SCHEMAS
# ==================================================
class ParentChildInfo(BaseModel):
    id: int
    user_id: int
    student_id: str
    name: str
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    email: Optional[str] = None


class ParentSubjectProgress(BaseModel):
    subject_id: int
    subject_name: str
    progress_percentage: float


class ParentVideoItem(BaseModel):
    video_id: int
    title: str
    topic_title: str
    subject_name: str
    status: str  # COMPLETED, IN_PROGRESS, NOT_STARTED


class ParentQuizItem(BaseModel):
    quiz_id: int
    topic_title: str
    subject_name: str
    latest_score: float
    best_score: float
    average_score: float
    passed: bool
    mastery_level: str


class ParentTopicMasteryItem(BaseModel):
    topic_id: int
    topic_title: str
    subject_name: str
    score: float
    mastery_level: str  # MASTERED, IN_PROGRESS, NEEDS_PRACTICE, NOT_STARTED


class ParentAssignmentItem(BaseModel):
    assignment_id: int
    title: str
    subject_name: str
    chapter_title: Optional[str] = None
    topic_title: Optional[str] = None
    teacher_name: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str  # PENDING, IN_PROGRESS, SUBMITTED, LATE, GRADED, OVERDUE
    score: Optional[float] = None
    total_points: float = 100.0
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None


class ParentActivityItem(BaseModel):
    id: str
    type: str  # video, quiz, assignment
    description: str
    timestamp: datetime
    score: Optional[float] = None
    status: Optional[str] = None


class ParentChildProgressResponse(BaseModel):
    child: ParentChildInfo
    overall_progress: float
    videos_completed: int
    total_videos: int
    average_quiz_score: float
    topic_mastery_percentage: float
    assignments_completed: int
    total_assignments: int
    subjects: List[ParentSubjectProgress] = []
    videos: List[ParentVideoItem] = []
    quizzes: List[ParentQuizItem] = []
    topic_mastery: List[ParentTopicMasteryItem] = []
    weak_topics: List[str] = []
    assignments: List[ParentAssignmentItem] = []
    recent_activity: List[ParentActivityItem] = []


# ==================================================
# BUILD 09: ASSIGNMENT ENGINE SCHEMAS
# ==================================================
class TeacherAssignedStudentOut(BaseModel):
    id: int
    student_id: str
    name: str
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    email: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class AssignmentCreateIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    description: Optional[str] = None
    subject_id: int
    chapter_id: int
    topic_id: Optional[int] = None
    due_date: datetime
    total_points: float = Field(default=100.0, ge=1.0)
    student_ids: List[int] = Field(..., min_length=1)
    attachment_url: Optional[str] = None


class AssignmentUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=500)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    total_points: Optional[float] = Field(None, ge=1.0)
    attachment_url: Optional[str] = None
    student_ids: Optional[List[int]] = None


class AssignmentGradeIn(BaseModel):
    student_id: int
    score: float = Field(..., ge=0.0)
    feedback: Optional[str] = None


class StudentSubmissionOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    student_name: str
    student_code: str
    status: str
    submission_text: Optional[str] = None
    submission_url: Optional[str] = None
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    max_score: float = 100.0
    feedback: Optional[str] = None
    graded_at: Optional[datetime] = None
    is_late: bool = False
    model_config = ConfigDict(from_attributes=True)


class AssignmentOut(BaseModel):
    id: int
    teacher_id: int
    teacher_name: Optional[str] = None
    subject_id: int
    subject_name: Optional[str] = None
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    total_points: float = 100.0
    attachment_url: Optional[str] = None
    status: str = "PUBLISHED"
    created_at: datetime
    updated_at: datetime
    assigned_count: int = 0
    submitted_count: int = 0
    graded_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class StudentAssignmentSubmitIn(BaseModel):
    submission_text: Optional[str] = None
    submission_url: Optional[str] = None


class StudentAssignmentListItemOut(BaseModel):
    id: int
    assignment_id: int
    title: str
    description: Optional[str] = None
    subject_id: int
    subject_name: str
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    teacher_name: str
    due_date: Optional[datetime] = None
    total_points: float = 100.0
    attachment_url: Optional[str] = None
    status: str
    score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    is_overdue: bool = False
    model_config = ConfigDict(from_attributes=True)


class StudentAssignmentDetailOut(BaseModel):
    id: int
    assignment_id: int
    title: str
    description: Optional[str] = None
    subject_id: int
    subject_name: str
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    teacher_name: str
    due_date: Optional[datetime] = None
    total_points: float = 100.0
    attachment_url: Optional[str] = None
    status: str
    submission_text: Optional[str] = None
    submission_url: Optional[str] = None
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    graded_at: Optional[datetime] = None
    is_overdue: bool = False
    model_config = ConfigDict(from_attributes=True)


class TeacherAssignmentSummaryOut(BaseModel):
    total_assignments: int = 0
    pending_submissions: int = 0
    submitted: int = 0
    to_be_graded: int = 0
    graded: int = 0


class StudentAssignmentSummaryOut(BaseModel):
    pending_assignments: int = 0
    in_progress: int = 0
    submitted: int = 0
    overdue: int = 0
    graded: int = 0


class ParentAssignmentSummaryOut(BaseModel):
    pending: int = 0
    submitted: int = 0
    overdue: int = 0
    graded: int = 0


class ParentAssignmentDetailOut(BaseModel):
    id: int
    assignment_id: int
    child_id: int
    child_name: str
    title: str
    description: Optional[str] = None
    subject_name: str
    chapter_title: Optional[str] = None
    topic_title: Optional[str] = None
    teacher_name: str
    due_date: Optional[datetime] = None
    status: str
    score: Optional[float] = None
    total_points: float = 100.0
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None
    is_overdue: bool = False
    model_config = ConfigDict(from_attributes=True)

