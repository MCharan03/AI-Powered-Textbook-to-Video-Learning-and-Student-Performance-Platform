export type UserRole = 'admin' | 'student' | 'teacher' | 'parent';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Textbook {
  id: number;
  title: string;
  filename: string;
  uploaded_at: string;
  status: string;
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
  order: number;
  duration_minutes: number;
}

export interface Topic {
  id: number;
  title: string;
  order: number;
  subtopics: Subtopic[];
}

export interface Chapter {
  id: number;
  title: string;
  order: number;
  topics: Topic[];
}

export interface TextbookHierarchy {
  textbook_id: number;
  title: string;
  chapters: Chapter[];
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
  title: string;
  duration_seconds: number;
  target_duration_minutes: number;
  video_url: string;
  review_status: string;
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
}

export interface ThresholdSettings {
  mastery_threshold_percentage: number;
  adaptive_question_count: number;
  target_video_duration_minutes: number;
}
