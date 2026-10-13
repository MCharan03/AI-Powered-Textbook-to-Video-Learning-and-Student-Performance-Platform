import {
  User,
  Textbook,
  PipelineStatus,
  PipelineStageStatus,
  TextbookHierarchy,
  ReviewItem,
  VideoUnit,
  TopicQuiz,
  QuizSubmissionResult,
  AdaptiveQuiz,
  ProgressSummary,
  ThresholdSettings,
} from './types';

const API_BASE = 'http://localhost:8000';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // --- Auth Endpoints ---
  async login(username: string, password: string):Promise<{ access_token: string; token_type: string }> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await this.request<{ access_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    this.setToken(res.access_token);
    return res;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // --- Admin Endpoints ---
  async uploadTextbook(file: File, title: string): Promise<Textbook> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    return this.request<Textbook>('/admin/textbooks', {
      method: 'POST',
      body: formData,
    });
  }

  async listTextbooks(): Promise<Textbook[]> {
    return this.request<Textbook[]>('/admin/textbooks');
  }

  async triggerPipeline(textbookId: number): Promise<{ task_id: string; textbook_id: number; status: string; message: string }> {
    return this.request(`/admin/textbooks/${textbookId}/pipeline`, {
      method: 'POST',
    });
  }

  async getPipelineStatus(textbookId: number): Promise<PipelineStatus> {
    const raw = await this.request<{ textbook_id: number; status: string; stage: number; stages_log: any[] }>(`/admin/textbooks/${textbookId}/status`);
    const stages: PipelineStageStatus[] = (raw.stages_log || []).map((s: any) => ({
      stage: s.stage,
      name: s.name,
      status: s.status,
      details: s.error || s.details || '',
      completed_at: s.timestamp,
    }));
    return {
      textbook_id: raw.textbook_id,
      pipeline_status: (raw.status as any) || 'pending',
      stages,
    };
  }

  async getTextbookHierarchy(textbookId: number): Promise<TextbookHierarchy> {
    return this.request<TextbookHierarchy>(`/admin/textbooks/${textbookId}/hierarchy`);
  }

  async listReviewItems(status?: string): Promise<ReviewItem[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<ReviewItem[]>(`/admin/review/items${query}`);
  }

  async getReviewItem(itemId: number, type?: string): Promise<ReviewItem> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.request<ReviewItem>(`/admin/review/items/${itemId}${query}`);
  }

  async approveReviewItem(itemId: number, type?: string, notes?: string): Promise<{ message: string; item_id: number; status: string }> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.request(`/admin/review/items/${itemId}/approval${query}`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'approve', notes }),
    });
  }

  async listUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users');
  }

  async createUser(userData: { email: string; name: string; password: string; role: string }): Promise<User> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getThresholdSettings(): Promise<ThresholdSettings> {
    const res = await this.request<{ mastery_threshold: number; adaptive_per_weak: number }>('/admin/settings/thresholds');
    return {
      mastery_threshold_percentage: res.mastery_threshold,
      adaptive_question_count: res.adaptive_per_weak,
      target_video_duration_minutes: 5.5,
    };
  }

  async updateThresholdSettings(settings: Partial<ThresholdSettings>): Promise<ThresholdSettings> {
    const payload: Record<string, any> = {};
    if (settings.mastery_threshold_percentage !== undefined) {
      payload.mastery_threshold = settings.mastery_threshold_percentage;
    }
    if (settings.adaptive_question_count !== undefined) {
      payload.adaptive_per_weak = settings.adaptive_question_count;
    }
    const res = await this.request<{ mastery_threshold: number; adaptive_per_weak: number }>('/admin/settings/thresholds', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return {
      mastery_threshold_percentage: res.mastery_threshold,
      adaptive_question_count: res.adaptive_per_weak,
      target_video_duration_minutes: 5.5,
    };
  }

  // --- Learning Endpoints ---
  async getVideoUnit(videoId: number): Promise<VideoUnit> {
    return this.request<VideoUnit>(`/learn/videos/${videoId}`);
  }

  async updateVideoProgress(videoId: number, progressPct: number, completed: boolean): Promise<{ message: string; completed: boolean }> {
    return this.request(`/learn/videos/${videoId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progress_pct: progressPct, completed }),
    });
  }

  async getTopicQuiz(topicId: number): Promise<TopicQuiz> {
    const raw = await this.request<any>(`/learn/topics/${topicId}/quiz`);
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      title: raw.title,
      review_status: raw.review_status,
      questions: (raw.questions || []).map((q: any) => ({
        id: q.id,
        question_text: q.stem || q.question_text,
        options: q.options || [],
        explanation: q.objective,
      })),
    };
  }

  async submitQuizAttempt(quizId: number, answers: Record<string, number>): Promise<QuizSubmissionResult> {
    const raw = await this.request<any>(`/learn/quizzes/${quizId}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    return {
      attempt_id: raw.id,
      score_percentage: Math.round(raw.score),
      passed: raw.passed,
      mastery_threshold: 80,
      weak_concepts: raw.weak_concepts || [],
      message: raw.passed ? 'Mastery verified' : 'Needs remediation',
    };
  }

  async getAdaptiveQuiz(topicId?: number): Promise<AdaptiveQuiz> {
    const query = topicId ? `?topic_id=${topicId}` : '';
    const raw = await this.request<any>(`/learn/quizzes/adaptive${query}`);
    return {
      session_id: raw.session_id,
      topic_id: raw.topic_id,
      weak_concepts_targeted: raw.identified_weak_concepts || [],
      questions: (raw.questions || []).map((q: any) => ({
        id: q.id,
        question_text: q.stem || q.question_text,
        options: q.options || [],
        explanation: q.objective,
      })),
    };
  }

  async getProgressSummary(studentId?: number): Promise<ProgressSummary> {
    const query = studentId ? `?student_id=${studentId}` : '';
    const raw = await this.request<any>(`/learn/dashboards/progress${query}`);
    return {
      student_id: raw.student_id,
      student_name: raw.student_name,
      topics_completed: raw.completed_videos_count,
      total_topics: raw.total_videos_count || 1,
      overall_mastery_percentage: raw.average_quiz_score,
      weak_concepts: raw.weak_concepts || [],
      recent_activity: {
        video_units_watched: raw.completed_videos_count,
        quizzes_attempted: raw.quizzes_taken_count,
      },
    };
  }
}

export const api = new ApiClient();
