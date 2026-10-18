export type UserRole = 'admin' | 'student' | 'teacher' | 'parent';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: number;
  user_id: number;
  student_id: string;
  name: string;
  dob?: string;
  class?: string;
  section?: string;
  roll_number?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  assigned_subjects: string[];
  assigned_teachers: string[];
  parents_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ParentLink {
  id: number;
  parent_id: string;
  parent_db_id: number;
  name: string;
  email?: string;
  phone?: string;
  relationship: string;
  created_at?: string;
}

export interface TeacherLink {
  id: number;
  teacher_id: string;
  teacher_db_id: number;
  name: string;
  email?: string;
  phone?: string;
  created_at?: string;
}

export interface SubjectLink {
  id: number;
  subject_id: number;
  name: string;
  class?: string;
  assigned_at?: string;
}

export interface StudentDetail extends Student {
  parents: ParentLink[];
  teachers: TeacherLink[];
  subjects: SubjectLink[];
  recent_activity: any[];
}

export interface StudentLink {
  id: number;
  student_id: string;
  student_db_id: number;
  name: string;
  class?: string;
  section?: string;
  relationship?: string;
  created_at?: string;
}

export interface Parent {
  id: number;
  user_id: number;
  parent_id: string;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  linked_students_count: number;
  linked_students_summary: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ParentDetail extends Parent {
  linked_students: StudentLink[];
}

export interface Teacher {
  id: number;
  user_id: number;
  teacher_id: string;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  assigned_students_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherDetail extends Teacher {
  assigned_students: StudentLink[];
}

export interface SubjectItem {
  id: number;
  name: string;
  description?: string;
  class?: string;
  created_by?: number;
  chapters_count: number;
  students_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChapterItem {
  id: number;
  subject_id: number;
  chapter_number: number;
  title: string;
  description?: string;
  topics_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface TopicItem {
  id: number;
  chapter_id: number;
  sequence_number: number;
  title: string;
  description?: string;
  subtopics_count: number;
  videos_count: number;
  quizzes_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubtopicItem {
  id: number;
  topic_id?: number;
  sequence_number: number;
  title: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubjectDetail extends SubjectItem {
  chapters: ChapterItem[];
}

export interface ChapterDetail extends ChapterItem {
  topics: TopicItem[];
}

export interface TopicDetail extends TopicItem {
  subtopics: SubtopicItem[];
  videos: any[];
  quizzes: any[];
}

export interface Textbook {
  id: number;
  title: string;
  description?: string;
  filename?: string;
  original_filename?: string;
  file_size?: number;
  uploaded_at?: string;
  created_at?: string;
  status: string;
  stage?: number;
  subject_id?: number;
  subject_name?: string;
  chapters_count?: number;
  topics_count?: number;
  subtopics_count?: number;
  progress?: number;
  stage_name?: string;
  error_message?: string;
}

export interface PipelineStageStatus {
  stage: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
  completed_at?: string;
}

export interface PipelineStatus {
  textbook_id: number;
  pipeline_status: 'pending' | 'running' | 'completed' | 'failed';
  stages: PipelineStageStatus[];
  error?: string;
}

export interface Subtopic {
  id: number;
  title: string;
  order?: number;
  duration_minutes?: number;
  topic_id?: number;
  description?: string;
  sequence_number?: number;
  order_idx?: number;
  source_start_page?: number;
  source_end_page?: number;
  status?: string;
  confidence_score?: number;
}

export interface Topic {
  id: number;
  title: string;
  order?: number;
  subtopics: Subtopic[];
  chapter_id?: number;
  description?: string;
  sequence_number?: number;
  order_idx?: number;
  source_start_page?: number;
  source_end_page?: number;
  status?: string;
  confidence_score?: number;
}

export interface Chapter {
  id: number;
  title: string;
  order?: number;
  topics: Topic[];
  subject_id?: number;
  description?: string;
  chapter_number?: number;
  order_idx?: number;
  source_start_page?: number;
  source_end_page?: number;
  status?: string;
  confidence_score?: number;
}

export interface TextbookHierarchy {
  textbook_id: number;
  title: string;
  status?: string;
  subject_id?: number;
  subject_name?: string;
  chapters: Chapter[];
}

export interface ProcessingJob {
  id: number;
  textbook_id: number;
  stage: string;
  progress: number;
  status: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface RegenerationComparison {
  textbook_id: number;
  status: string;
  message: string;
  comparison: {
    canonical_chapters_count: number;
    extracted_chapters_count: number;
    current_curriculum: any[];
    draft_curriculum: any[];
  };
}

export interface VideoPlan {
  id: number;
  title: string;
  description?: string;
  topic_id?: number;
  topic_title?: string;
  chapter_id?: number;
  chapter_title?: string;
  subject_id?: number;
  subject_name?: string;
  subtopic_id?: number;
  subtopic_title?: string;
  sequence_number: number;
  duration_seconds: number;
  estimated_duration_seconds?: number;
  source_start_page?: number;
  source_end_page?: number;
  learning_objective?: string;
  content_outline?: string[];
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface VideoPlanRegeneration {
  topic_id: number;
  topic_title: string;
  has_existing_plans: boolean;
  current_plans: any[];
  new_plans: any[];
  comparison: {
    current_count: number;
    new_count: number;
    current_total_duration: number;
    new_total_duration: number;
  };
  message: string;
}

export interface ScriptSection {
  section_id: number;
  type: string; // INTRO, OBJECTIVE, CONCEPT, DEFINITION, DETAILED_EXPLANATION, EXAMPLE, FORMULA, APPLICATION, SUMMARY, CLOSING
  title: string;
  narration: string;
  source_pages: number[];
  visual_type?: string; // TITLE_CARD, DIAGRAM, FORMULA_CARD, CODE_SNIPPET, ANIMATION, SUMMARY_CHIPS
  visual_description?: string;
  on_screen_text?: string;
  formula?: string;
  diagram_description?: string;
  animation_hint?: string;
}

export interface ScriptQualityBreakdown {
  objective_coverage: number;
  outline_coverage: number;
  duration_alignment: number;
  source_grounding: number;
  structural_completeness: number;
}

export interface ScriptItem {
  id: number;
  video_id: number;
  version_number: number;
  title: string;
  script_status: string; // SCRIPT_GENERATION_QUEUED, GENERATING, SCRIPT_REVIEW, NEEDS_REVIEW, SCRIPT_APPROVED, READY_FOR_VIDEO_GENERATION
  generation_engine: string;
  quality_score: number;
  quality_breakdown?: ScriptQualityBreakdown;
  word_count: number;
  target_words: number;
  estimated_duration_seconds: number;
  source_page_start?: number;
  source_page_end?: number;
  sections: ScriptSection[];
  narration_text?: string;
  warnings: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ScriptRegenerationPreview {
  video_id: number;
  video_title: string;
  has_existing_script: boolean;
  current_script?: ScriptItem;
  new_script: ScriptItem;
  comparison: {
    current_version?: number;
    new_version: number;
    current_word_count: number;
    new_word_count: number;
    current_quality_score: number;
    new_quality_score: number;
    current_section_count: number;
    new_section_count: number;
  };
  message: string;
}

export interface ReviewItem {
  id: number;
  type: 'video' | 'quiz';
  title: string;
  topic_title: string;
  status: 'pending_review' | 'approved' | 'published';
  created_at: string;
  details?: Record<string, any>;
}

export interface VideoUnit {
  id: number;
  topic_id: number;
  topic_title?: string | null;
  subject_id?: number | null;
  subject_name?: string | null;
  chapter_id?: number | null;
  chapter_title?: string | null;
  title: string;
  duration_seconds: number;
  target_duration_minutes: number;
  video_url: string;
  review_status: string;
  description?: string | null;
  learning_objective?: string | null;
  content_outline?: string[] | null;
  actual_duration_seconds?: number | null;
}

export interface Question {
  id: number;
  question_text: string;
  options: string[];
  explanation?: string;
}

export interface TopicQuiz {
  id: number;
  topic_id: number;
  title: string;
  review_status: string;
  questions: Question[];
}

export interface QuizSubmissionResult {
  attempt_id: number;
  score_percentage: number;
  passed: boolean;
  mastery_threshold: number;
  weak_concepts: string[];
  message: string;
}

export interface AdaptiveQuiz {
  session_id: string;
  topic_id: number;
  weak_concepts_targeted: string[];
  questions: Question[];
}

export interface ResumeLearningItem {
  video_id: number;
  video_title: string;
  subject_id?: number | null;
  subject_name?: string | null;
  chapter_id?: number | null;
  chapter_title?: string | null;
  topic_id?: number | null;
  topic_title?: string | null;
  duration_seconds: number;
  duration_minutes_formatted?: string | null;
  progress_percentage: number;
  completed: boolean;
  video_url?: string | null;
  description?: string | null;
  learning_objective?: string | null;
}

export interface StudentModuleItem {
  id: number;
  title: string;
  type: 'video' | 'quiz' | string;
  subject_name: string;
  chapter_title: string;
  topic_title: string;
  topic_id: number;
  item_id: number;
  duration_seconds?: number | null;
  question_count?: number | null;
  status: string;
  action_label: string;
  action_route: string;
}

export interface ProgressSummary {
  student_id: number;
  student_name: string;
  topics_completed: number;
  total_topics: number;
  overall_mastery_percentage: number;
  weak_concepts: string[];
  recent_activity: {
    video_units_watched: number;
    quizzes_attempted: number;
  };
  assigned_subjects?: string[];
  resume_learning?: ResumeLearningItem | null;
  modules?: StudentModuleItem[];
  quizzes?: StudentModuleItem[];
}

export interface DashboardTrendPoint {
  month: string;
  average_score: number;
  assessments_count: number;
}

export interface DashboardTopicMastery {
  topic: string;
  score: number;
  mastery_level: string;
}

export interface ObserverStudentAnalytics {
  student_id: number;
  student_name: string;
  student_code: string;
  class_name?: string | null;
  section?: string | null;
  mastery_percentage: number;
  average_quiz_score: number;
  topics_completed: number;
  total_topics: number;
  videos_completed: number;
  total_videos: number;
  quizzes_taken: number;
  weak_concepts: string[];
  topic_mastery: DashboardTopicMastery[];
  score_trend: DashboardTrendPoint[];
}

export interface ObserverDashboardSummary {
  role: 'parent' | 'teacher';
  students_count: number;
  average_mastery_percentage: number;
  average_quiz_score: number;
  video_completion_percentage: number;
  students_needing_attention: number;
  score_trend: DashboardTrendPoint[];
  students: ObserverStudentAnalytics[];
}

export interface ThresholdSettings {
  mastery_threshold_percentage: number;
  adaptive_question_count: number;
  target_video_duration_minutes: number;
}

export interface SceneItem {
  scene_number: number;
  section_type: string;
  title: string;
  narration_text: string;
  visual_type: string;
  visual_description?: string;
  on_screen_text?: string;
  formula?: string;
  animation_hint?: string;
  source_pages: number[];
  estimated_duration_seconds: number;
  start_time_seconds: number;
  end_time_seconds: number;
}

export interface VideoRenderDetails {
  id: number;
  video_id: number;
  version_number: number;
  title: string;
  subject_id?: number;
  subject_name?: string;
  chapter_title?: string;
  topic_title?: string;
  subtopic_title?: string;
  approved_duration_seconds: number;
  actual_duration_seconds?: number;
  render_status: string; // NOT_STARTED, AUDIO_GENERATING, AUDIO_READY, RENDERING, RENDERED, FAILED
  status: string; // REVIEW, APPROVED, PUBLISHED, FAILED
  script_status?: string;
  tts_engine?: string;
  tts_provider?: string;
  voice_quality?: string;
  audio_quality?: string;
  speaking_rate?: string;
  render_engine?: string;
  voice?: string;
  video_url?: string;
  video_storage_key?: string;
  audio_storage_key?: string;
  thumbnail_url?: string;
  thumbnail_storage_key?: string;
  captions_storage_key?: string;
  captions_srt?: string;
  scenes: SceneItem[];
  source_page_start?: number;
  source_page_end?: number;
  render_error?: string;
  job_id?: number;
  rendered_at?: string;
  created_at?: string;
}

export interface VideoGenerationStatus {
  video_id: number;
  video_title: string;
  job_id?: number;
  job_status: string;
  current_stage: string;
  progress: number;
  render_status: string;
  video_status: string;
  actual_duration_seconds?: number;
  video_url?: string;
  thumbnail_url?: string;
  error_message?: string;
}

// BUILD 07: INTERACTIVE QUIZZES & STUDENT MASTERY TYPES
export interface AdminQuestionItem {
  id: number;
  quiz_id: number;
  question_text: string;
  stem?: string;
  options: any[];
  correct_answer: string;
  explanation: string;
  difficulty: string; // EASY, MEDIUM, HARD
  bloom_level: string; // REMEMBER, UNDERSTAND, APPLY, ANALYZE
  source_reference?: string;
  source_pages?: number[];
  order_index?: number;
  weak_concept?: string;
  created_at?: string;
}

export interface AdminQuizItem {
  id: number;
  title: string;
  description?: string;
  topic_id?: number;
  topic_title?: string;
  subtopic_id?: number;
  subtopic_title?: string;
  chapter_id?: number;
  chapter_title?: string;
  subject_id?: number;
  subject_name?: string;
  quiz_type: string;
  passing_score: number;
  attempt_number: number;
  parent_quiz_id?: number;
  is_adaptive: boolean;
  status: string; // DRAFT, REVIEW, PUBLISHED, ARCHIVED
  review_status: string;
  generation_engine?: string;
  question_count: number;
  questions?: AdminQuestionItem[];
  created_at?: string;
  updated_at?: string;
}

export interface QuizGenerateRequest {
  question_count?: number;
  passing_score?: number;
  engine?: string;
  subtopic_id?: number;
}

export interface QuestionResultItem {
  question_id: number;
  question_text: string;
  selected_answer: any;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  weak_concept?: string;
  difficulty: string;
  bloom_level?: string;
}

export interface DetailedQuizResult {
  id: number;
  attempt_id: number;
  quiz_id: number;
  student_id: number;
  user_id: number;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  passing_score: number;
  mastery_level: string;
  weak_concepts: string[];
  recommendation: string;
  adaptive_recommended: boolean;
  question_results: QuestionResultItem[];
  submitted_at: string;
  created_at?: string;
}

export interface StudentTopicPerformance {
  student_id: number;
  topic_id: number;
  topic_title?: string;
  subject_name?: string;
  attempts: number;
  best_score: number;
  latest_score: number;
  mastery_level: string; // NOT_STARTED, IN_PROGRESS, NEEDS_PRACTICE, MASTERED
  last_attempted_at?: string;
}

export interface ParentChildInfo {
  id: number;
  user_id: number;
  student_id: string;
  name: string;
  class_name?: string;
  section?: string;
  roll_number?: string;
  email?: string;
}

export interface ParentSubjectProgress {
  subject_id: number;
  subject_name: string;
  progress_percentage: number;
}

export interface ParentVideoItem {
  video_id: number;
  title: string;
  topic_title: string;
  subject_name: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' | string;
}

export interface ParentQuizItem {
  quiz_id: number;
  topic_title: string;
  subject_name: string;
  latest_score: number;
  best_score: number;
  average_score: number;
  passed: boolean;
  mastery_level: string;
}

export interface ParentTopicMasteryItem {
  topic_id: number;
  topic_title: string;
  subject_name: string;
  score: number;
  mastery_level: string;
}

export interface ParentAssignmentItem {
  assignment_id: number;
  title: string;
  subject_name: string;
  chapter_title?: string;
  topic_title?: string;
  teacher_name?: string;
  due_date?: string;
  status: string;
  score?: number;
  total_points?: number;
  feedback?: string;
  submitted_at?: string;
}

// BUILD 09: ASSIGNMENT ENGINE TYPES
export interface TeacherAssignedStudent {
  id: number;
  user_id: number;
  student_id: string;
  name: string;
  class_name?: string;
  section?: string;
  roll_number?: string;
  email?: string;
}

export interface AssignmentCreatePayload {
  title: string;
  description: string;
  subject_id: number;
  chapter_id: number;
  topic_id?: number | null;
  due_date: string;
  total_points?: number;
  attachment_url?: string | null;
  student_ids: number[];
}

export interface AssignmentUpdatePayload {
  title?: string;
  description?: string;
  due_date?: string;
  total_points?: number;
  attachment_url?: string | null;
  student_ids?: number[];
}

export interface AssignmentGradePayload {
  student_id: number;
  score: number;
  feedback?: string;
}

export interface AssignmentSubmissionItem {
  student_id: number;
  user_id: number;
  student_code: string;
  student_name: string;
  class_name?: string;
  section?: string;
  status: string; // NOT_SUBMITTED, PENDING, IN_PROGRESS, SUBMITTED, LATE, GRADED
  submission_text?: string | null;
  file_url?: string | null;
  submitted_at?: string | null;
  score?: number | null;
  max_score: number;
  feedback?: string | null;
  graded_at?: string | null;
}

export interface TeacherAssignmentItem {
  id: number;
  title: string;
  description: string;
  subject_id: number;
  subject_name: string;
  chapter_id: number;
  chapter_title: string;
  topic_id?: number | null;
  topic_title?: string | null;
  teacher_id: number;
  teacher_name: string;
  due_date: string;
  total_points: number;
  attachment_url?: string | null;
  status: string;
  assigned_students_count: number;
  submissions_count: number;
  graded_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherAssignmentDetail extends TeacherAssignmentItem {
  submissions: AssignmentSubmissionItem[];
}

export interface StudentAssignmentListItem {
  id: number;
  assignment_id: number;
  title: string;
  description: string;
  subject_name: string;
  chapter_title: string;
  topic_title?: string | null;
  teacher_name: string;
  due_date: string;
  total_points: number;
  attachment_url?: string | null;
  status: string; // PENDING, IN_PROGRESS, SUBMITTED, LATE, GRADED
  submitted_at?: string | null;
  score?: number | null;
  has_submission: boolean;
  graded_at?: string | null;
  feedback?: string | null;
}

export interface StudentAssignmentDetail extends StudentAssignmentListItem {
  submission_text?: string | null;
  file_url?: string | null;
}

export interface TeacherAssignmentSummary {
  total_assignments: number;
  pending_submissions: number;
  submitted: number;
  to_be_graded: number;
  graded: number;
}

export interface StudentAssignmentSummary {
  pending: number;
  in_progress: number;
  submitted: number;
  overdue: number;
  graded: number;
}

export interface ParentAssignmentSummary {
  pending: number;
  submitted: number;
  overdue: number;
  graded: number;
}


export interface ParentActivityItem {
  id: string;
  type: 'video' | 'quiz' | 'assignment' | string;
  description: string;
  timestamp: string;
  score?: number;
  status?: string;
}

export interface ParentChildProgressResponse {
  child: ParentChildInfo;
  overall_progress: number;
  videos_completed: number;
  total_videos: number;
  average_quiz_score: number;
  topic_mastery_percentage: number;
  assignments_completed: number;
  total_assignments: number;
  subjects: ParentSubjectProgress[];
  videos: ParentVideoItem[];
  quizzes: ParentQuizItem[];
  topic_mastery: ParentTopicMasteryItem[];
  weak_topics: string[];
  assignments: ParentAssignmentItem[];
  recent_activity: ParentActivityItem[];
}


