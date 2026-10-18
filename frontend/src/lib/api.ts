import {
  User,
  Student,
  StudentDetail,
  Parent,
  ParentDetail,
  Teacher,
  TeacherDetail,
  SubjectItem,
  SubjectDetail,
  ChapterItem,
  ChapterDetail,
  TopicItem,
  TopicDetail,
  SubtopicItem,
  PaginatedResponse,
  ParentLink,
  StudentLink,
  TeacherLink,
  SubjectLink,
  Textbook,
  PipelineStatus,
  PipelineStageStatus,
  TextbookHierarchy,
  ProcessingJob,
  RegenerationComparison,
  Chapter,
  Topic,
  Subtopic,
  VideoPlan,
  VideoPlanRegeneration,
  ScriptItem,
  ScriptRegenerationPreview,
  ScriptSection,
  VideoRenderDetails,
  VideoGenerationStatus,
  SceneItem,
  ReviewItem,
  VideoUnit,
  TopicQuiz,
  QuizSubmissionResult,
  AdaptiveQuiz,
  ProgressSummary,
  ThresholdSettings,
  AdminQuestionItem,
  AdminQuizItem,
  ObserverDashboardSummary,
  QuizGenerateRequest,
  QuestionResultItem,
  DetailedQuizResult,
  StudentTopicPerformance,
  ParentChildInfo,
  ParentChildProgressResponse,
  ParentAssignmentItem,
  TeacherAssignedStudent,
  AssignmentCreatePayload,
  AssignmentUpdatePayload,
  AssignmentGradePayload,
  AssignmentSubmissionItem,
  TeacherAssignmentItem,
  TeacherAssignmentDetail,
  StudentAssignmentListItem,
  StudentAssignmentDetail,
  TeacherAssignmentSummary,
  StudentAssignmentSummary,
  ParentAssignmentSummary,
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
  async login(identifier: string, password: string, role?: string): Promise<{ access_token: string; token_type: string }> {
    const payload: Record<string, any> = {
      identifier: identifier.trim(),
      username: identifier.trim(),
      password,
    };
    if (role) {
      payload.role = role;
    }

    const res = await this.request<{ access_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    this.setToken(res.access_token);
    return res;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // --- Admin Endpoints ---
  async uploadTextbook(file: File, title: string, subjectId?: number, description?: string): Promise<Textbook> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (subjectId) {
      formData.append('subject_id', subjectId.toString());
    }
    if (description) {
      formData.append('description', description);
    }

    return this.request<Textbook>('/admin/textbooks', {
      method: 'POST',
      body: formData,
    });
  }

  async listTextbooks(search?: string, subjectId?: number, status?: string): Promise<Textbook[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (subjectId) params.append('subject_id', subjectId.toString());
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Textbook[]>(`/admin/textbooks${query}`);
  }

  async getTextbook(id: number): Promise<Textbook> {
    return this.request<Textbook>(`/admin/textbooks/${id}`);
  }

  async processTextbook(id: number, sync: boolean = false): Promise<{ message: string; textbook_id: number; status: string }> {
    return this.request<{ message: string; textbook_id: number; status: string }>(`/admin/textbooks/${id}/process?sync=${sync}`, {
      method: 'POST',
    });
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

  async approveTextbookCurriculum(textbookId: number): Promise<{ message: string; textbook_id: number; status: string }> {
    return this.request<{ message: string; textbook_id: number; status: string }>(`/admin/textbooks/${textbookId}/approve`, {
      method: 'POST',
    });
  }

  async regenerateCurriculum(textbookId: number, target: string = 'all'): Promise<RegenerationComparison> {
    return this.request<RegenerationComparison>(`/admin/textbooks/${textbookId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ target }),
    });
  }

  async patchChapter(id: number, data: Partial<Chapter>): Promise<Chapter> {
    return this.request<Chapter>(`/admin/chapters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async patchTopic(id: number, data: Partial<Topic>): Promise<Topic> {
    return this.request<Topic>(`/admin/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async patchSubtopic(id: number, data: Partial<Subtopic>): Promise<Subtopic> {
    return this.request<Subtopic>(`/admin/subtopics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // --- BUILD 04: Video Plans & Intelligent Segmentation ---
  async generateVideoPlanForTopic(topicId: number, force: boolean = false): Promise<VideoPlan[]> {
    return this.request<VideoPlan[]>(`/admin/topics/${topicId}/video-plans/generate?force=${force}`, {
      method: 'POST',
    });
  }

  async generateVideoPlansForChapter(chapterId: number, force: boolean = false): Promise<VideoPlan[]> {
    return this.request<VideoPlan[]>(`/admin/chapters/${chapterId}/video-plans/generate?force=${force}`, {
      method: 'POST',
    });
  }

  async generateVideoPlansForTextbook(textbookId: number, force: boolean = false): Promise<VideoPlan[]> {
    return this.request<VideoPlan[]>(`/admin/textbooks/${textbookId}/video-plans/generate?force=${force}`, {
      method: 'POST',
    });
  }

  async listVideoPlans(filters?: { topic_id?: number; chapter_id?: number; subject_id?: number; status?: string }): Promise<VideoPlan[]> {
    const params = new URLSearchParams();
    if (filters?.topic_id) params.append('topic_id', filters.topic_id.toString());
    if (filters?.chapter_id) params.append('chapter_id', filters.chapter_id.toString());
    if (filters?.subject_id) params.append('subject_id', filters.subject_id.toString());
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<VideoPlan[]>(`/admin/video-plans${query}`);
  }

  async getVideoPlan(id: number): Promise<VideoPlan> {
    return this.request<VideoPlan>(`/admin/video-plans/${id}`);
  }

  async patchVideoPlan(id: number, data: Partial<VideoPlan>): Promise<VideoPlan> {
    return this.request<VideoPlan>(`/admin/video-plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async approveVideoPlan(id: number): Promise<VideoPlan> {
    return this.request<VideoPlan>(`/admin/video-plans/${id}/approve`, {
      method: 'POST',
    });
  }

  async approveTopicVideoPlans(topicId: number): Promise<VideoPlan[]> {
    return this.request<VideoPlan[]>(`/admin/topics/${topicId}/video-plans/approve`, {
      method: 'POST',
    });
  }

  async regenerateVideoPlanPreview(topicId: number): Promise<VideoPlanRegeneration> {
    return this.request<VideoPlanRegeneration>(`/admin/topics/${topicId}/video-plans/regenerate`, {
      method: 'POST',
    });
  }

  // BUILD 05: SCRIPT GENERATION & ADMIN REVIEW METHODS
  async generateVideoScript(videoId: number, force: boolean = false, engine?: string): Promise<ScriptItem> {
    return this.request<ScriptItem>(`/admin/video-plans/${videoId}/script/generate`, {
      method: 'POST',
      body: JSON.stringify({ force_regenerate: force, engine }),
    });
  }

  async getVideoPlanScript(videoId: number): Promise<ScriptItem> {
    return this.request<ScriptItem>(`/admin/video-plans/${videoId}/script`);
  }

  async listScripts(filters?: { topic_id?: number; chapter_id?: number; subject_id?: number; status?: string }): Promise<ScriptItem[]> {
    const params = new URLSearchParams();
    if (filters?.topic_id) params.append('topic_id', filters.topic_id.toString());
    if (filters?.chapter_id) params.append('chapter_id', filters.chapter_id.toString());
    if (filters?.subject_id) params.append('subject_id', filters.subject_id.toString());
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ScriptItem[]>(`/admin/scripts${query}`);
  }

  async getScript(id: number): Promise<ScriptItem> {
    return this.request<ScriptItem>(`/admin/scripts/${id}`);
  }

  async patchScript(id: number, data: Partial<ScriptItem>): Promise<ScriptItem> {
    return this.request<ScriptItem>(`/admin/scripts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async regenerateScriptPreview(id: number): Promise<ScriptRegenerationPreview> {
    return this.request<ScriptRegenerationPreview>(`/admin/scripts/${id}/regenerate`, {
      method: 'POST',
    });
  }

  async regenerateScriptConfirmed(id: number): Promise<ScriptItem> {
    return this.request<ScriptItem>(`/admin/scripts/${id}/regenerate?force=true`, {
      method: 'POST',
    });
  }

  async approveScript(id: number): Promise<ScriptItem> {
    return this.request<ScriptItem>(`/admin/scripts/${id}/approve`, {
      method: 'POST',
    });
  }

  // BUILD 06: Video Rendering APIs
  async generateVideo(videoId: number, force: boolean = false, ttsEngine?: string, voice?: string): Promise<VideoRenderDetails> {
    return this.request<VideoRenderDetails>(`/admin/video-plans/${videoId}/video/generate`, {
      method: 'POST',
      body: JSON.stringify({ force, tts_engine: ttsEngine, voice }),
    });
  }

  async getVideoGenerationStatus(videoId: number): Promise<VideoGenerationStatus> {
    return this.request<VideoGenerationStatus>(`/admin/videos/${videoId}/generation-status`);
  }

  async getVideoPreview(videoId: number): Promise<VideoRenderDetails> {
    return this.request<VideoRenderDetails>(`/admin/videos/${videoId}/preview`);
  }

  async regenerateVideo(videoId: number, force: boolean = true, ttsEngine?: string, voice?: string): Promise<VideoRenderDetails> {
    return this.request<VideoRenderDetails>(`/admin/videos/${videoId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ force, tts_engine: ttsEngine, voice }),
    });
  }

  async approveVideo(videoId: number, notes?: string): Promise<VideoRenderDetails> {
    return this.request<VideoRenderDetails>(`/admin/videos/${videoId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async publishVideo(videoId: number): Promise<VideoRenderDetails> {
    return this.request<VideoRenderDetails>(`/admin/videos/${videoId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ publish: true }),
    });
  }

  async listVideos(filters?: { topic_id?: number; chapter_id?: number; subject_id?: number; render_status?: string; status?: string }): Promise<VideoRenderDetails[]> {
    const params = new URLSearchParams();
    if (filters?.topic_id) params.append('topic_id', filters.topic_id.toString());
    if (filters?.chapter_id) params.append('chapter_id', filters.chapter_id.toString());
    if (filters?.subject_id) params.append('subject_id', filters.subject_id.toString());
    if (filters?.render_status) params.append('render_status', filters.render_status);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<VideoRenderDetails[]>(`/admin/videos${query}`);
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
    const raw = await this.request<any>(`/learn/videos/${videoId}`);
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      topic_title: raw.topic_title,
      subject_id: raw.subject_id,
      subject_name: raw.subject_name,
      chapter_id: raw.chapter_id,
      chapter_title: raw.chapter_title,
      title: raw.title,
      duration_seconds: raw.duration_seconds || 330,
      target_duration_minutes: (raw.duration_seconds || 330) / 60,
      video_url: raw.video_url || raw.storage_key || '',
      review_status: raw.review_status || 'published',
      description: raw.description,
      learning_objective: raw.learning_objective,
      content_outline: raw.content_outline,
      actual_duration_seconds: raw.actual_duration_seconds,
    };
  }

  async getTopicVideos(topicId: number): Promise<VideoPlan[]> {
    return this.request<VideoPlan[]>(`/learn/topics/${topicId}/videos`);
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

  async getQuiz(id: number): Promise<TopicQuiz> {
    const raw = await this.getStudentQuizById(id);
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      title: raw.title,
      review_status: raw.review_status || 'published',
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
      assigned_subjects: raw.assigned_subjects || [],
      resume_learning: raw.resume_learning || null,
      modules: raw.modules || [],
      quizzes: raw.quizzes || [],
    };
  }

  async getObserverDashboard(): Promise<ObserverDashboardSummary> {
    return this.request<ObserverDashboardSummary>('/learn/dashboards/observer');
  }

  // --- BUILD 8.1: Strict Parent Child-Progress ---
  async getParentChildren(): Promise<ParentChildInfo[]> {
    return this.request<ParentChildInfo[]>('/learn/parent/children');
  }

  async getParentChildProgress(studentId?: number): Promise<ParentChildProgressResponse> {
    const url = studentId ? `/learn/parent/progress/${studentId}` : '/learn/parent/progress';
    return this.request<ParentChildProgressResponse>(url);
  }

  async getTeacherClassPerformance(): Promise<ObserverDashboardSummary> {
    return this.request<ObserverDashboardSummary>('/learn/teacher/class-performance');
  }

  // --- Student Management ---
  async listStudents(params?: { page?: number; page_size?: number; student_id?: string; name?: string; class?: string; section?: string }): Promise<PaginatedResponse<Student>> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.page_size) q.append('page_size', params.page_size.toString());
    if (params?.student_id) q.append('student_id', params.student_id);
    if (params?.name) q.append('name', params.name);
    if (params?.class) q.append('class', params.class);
    if (params?.section) q.append('section', params.section);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return this.request<PaginatedResponse<Student>>(`/admin/students${queryString}`);
  }

  async getStudent(id: number): Promise<StudentDetail> {
    return this.request<StudentDetail>(`/admin/students/${id}`);
  }

  async createStudent(data: any): Promise<Student> {
    return this.request<Student>('/admin/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: number, data: any): Promise<Student> {
    return this.request<Student>(`/admin/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStudent(id: number): Promise<{ message: string; id: number; is_active: boolean }> {
    return this.request<{ message: string; id: number; is_active: boolean }>(`/admin/students/${id}`, {
      method: 'DELETE',
    });
  }

  async getStudentParents(id: number): Promise<ParentLink[]> {
    return this.request<ParentLink[]>(`/admin/students/${id}/parents`);
  }

  async linkStudentParent(id: number, data: { parent_id: any; relationship: string }): Promise<ParentLink> {
    return this.request<ParentLink>(`/admin/students/${id}/parents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unlinkStudentParent(id: number, parentId: any): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/students/${id}/parents/${parentId}`, {
      method: 'DELETE',
    });
  }

  async getStudentSubjects(id: number): Promise<SubjectLink[]> {
    return this.request<SubjectLink[]>(`/admin/students/${id}/subjects`);
  }

  async assignStudentSubject(id: number, subjectId: number): Promise<SubjectLink> {
    return this.request<SubjectLink>(`/admin/students/${id}/subjects`, {
      method: 'POST',
      body: JSON.stringify({ subject_id: subjectId }),
    });
  }

  async unassignStudentSubject(id: number, subjectId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/students/${id}/subjects/${subjectId}`, {
      method: 'DELETE',
    });
  }

  // --- Parent Management ---
  async listParents(params?: { page?: number; page_size?: number; parent_id?: string; name?: string }): Promise<PaginatedResponse<Parent>> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.page_size) q.append('page_size', params.page_size.toString());
    if (params?.parent_id) q.append('parent_id', params.parent_id);
    if (params?.name) q.append('name', params.name);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return this.request<PaginatedResponse<Parent>>(`/admin/parents${queryString}`);
  }

  async getParent(id: number): Promise<ParentDetail> {
    return this.request<ParentDetail>(`/admin/parents/${id}`);
  }

  async createParent(data: any): Promise<Parent> {
    return this.request<Parent>('/admin/parents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateParent(id: number, data: any): Promise<Parent> {
    return this.request<Parent>(`/admin/parents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteParent(id: number): Promise<{ message: string; id: number; is_active: boolean }> {
    return this.request<{ message: string; id: number; is_active: boolean }>(`/admin/parents/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Teacher Management ---
  async listTeachers(params?: { page?: number; page_size?: number; teacher_id?: string; name?: string }): Promise<PaginatedResponse<Teacher>> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.page_size) q.append('page_size', params.page_size.toString());
    if (params?.teacher_id) q.append('teacher_id', params.teacher_id);
    if (params?.name) q.append('name', params.name);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return this.request<PaginatedResponse<Teacher>>(`/admin/teachers${queryString}`);
  }

  async getTeacher(id: number): Promise<TeacherDetail> {
    return this.request<TeacherDetail>(`/admin/teachers/${id}`);
  }

  async createTeacher(data: any): Promise<Teacher> {
    return this.request<Teacher>('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeacher(id: number, data: any): Promise<Teacher> {
    return this.request<Teacher>(`/admin/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTeacher(id: number): Promise<{ message: string; id: number; is_active: boolean }> {
    return this.request<{ message: string; id: number; is_active: boolean }>(`/admin/teachers/${id}`, {
      method: 'DELETE',
    });
  }

  async getTeacherStudents(id: number): Promise<StudentLink[]> {
    return this.request<StudentLink[]>(`/admin/teachers/${id}/students`);
  }

  async assignTeacherStudent(id: number, studentId: any): Promise<StudentLink> {
    return this.request<StudentLink>(`/admin/teachers/${id}/students`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });
  }

  async unassignTeacherStudent(id: number, studentId: any): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/teachers/${id}/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  // --- Subject Management ---
  async listSubjects(params?: { page?: number; page_size?: number; name?: string; class?: string }): Promise<PaginatedResponse<SubjectItem>> {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.page_size) q.append('page_size', params.page_size.toString());
    if (params?.name) q.append('name', params.name);
    if (params?.class) q.append('class', params.class);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    const res = await this.request<any>(`/admin/subjects${queryString}`);
    if (Array.isArray(res)) {
      return {
        items: res,
        total: res.length,
        page: 1,
        page_size: res.length,
        total_pages: 1,
      };
    }
    return res;
  }

  async getSubjects(page = 1, pageSize = 20): Promise<PaginatedResponse<SubjectItem>> {
    return this.listSubjects({ page, page_size: pageSize });
  }

  async getSubject(id: number): Promise<SubjectDetail> {
    return this.request<SubjectDetail>(`/admin/subjects/${id}`);
  }

  async createSubject(data: any): Promise<SubjectItem> {
    return this.request<SubjectItem>('/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubject(id: number, data: any): Promise<SubjectItem> {
    return this.request<SubjectItem>(`/admin/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSubject(id: number): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>(`/admin/subjects/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Chapter Management ---
  async getSubjectChapters(subjectId: number): Promise<ChapterItem[]> {
    return this.request<ChapterItem[]>(`/admin/subjects/${subjectId}/chapters`);
  }

  async createChapter(subjectId: number, data: any): Promise<ChapterItem> {
    return this.request<ChapterItem>(`/admin/subjects/${subjectId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getChapter(id: number): Promise<ChapterDetail> {
    return this.request<ChapterDetail>(`/admin/chapters/${id}`);
  }

  async updateChapter(id: number, data: any): Promise<ChapterItem> {
    return this.request<ChapterItem>(`/admin/chapters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChapter(id: number): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>(`/admin/chapters/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Topic Management ---
  async getChapterTopics(chapterId: number): Promise<TopicItem[]> {
    return this.request<TopicItem[]>(`/admin/chapters/${chapterId}/topics`);
  }

  async createTopic(chapterId: number, data: any): Promise<TopicItem> {
    return this.request<TopicItem>(`/admin/chapters/${chapterId}/topics`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTopic(id: number): Promise<TopicDetail> {
    return this.request<TopicDetail>(`/admin/topics/${id}`);
  }

  async updateTopic(id: number, data: any): Promise<TopicItem> {
    return this.request<TopicItem>(`/admin/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTopic(id: number): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>(`/admin/topics/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Subtopic Management ---
  async getTopicSubtopics(topicId: number): Promise<SubtopicItem[]> {
    return this.request<SubtopicItem[]>(`/admin/topics/${topicId}/subtopics`);
  }

  async createSubtopic(topicId: number, data: any): Promise<SubtopicItem> {
    return this.request<SubtopicItem>(`/admin/topics/${topicId}/subtopics`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubtopic(id: number): Promise<SubtopicItem> {
    return this.request<SubtopicItem>(`/admin/subtopics/${id}`);
  }

  async updateSubtopic(id: number, data: any): Promise<SubtopicItem> {
    return this.request<SubtopicItem>(`/admin/subtopics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSubtopic(id: number): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>(`/admin/subtopics/${id}`, {
      method: 'DELETE',
    });
  }

  // --- BUILD 07: Admin Quiz Management ---
  async generateQuiz(topicId: number, data?: QuizGenerateRequest): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/topics/${topicId}/quizzes/generate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async listAdminQuizzes(params?: {
    topic_id?: number;
    chapter_id?: number;
    subject_id?: number;
    status?: string;
    is_adaptive?: boolean;
  }): Promise<AdminQuizItem[]> {
    const q = new URLSearchParams();
    if (params?.topic_id) q.append('topic_id', params.topic_id.toString());
    if (params?.chapter_id) q.append('chapter_id', params.chapter_id.toString());
    if (params?.subject_id) q.append('subject_id', params.subject_id.toString());
    if (params?.status) q.append('status', params.status);
    if (params?.is_adaptive !== undefined) q.append('is_adaptive', params.is_adaptive.toString());
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return this.request<AdminQuizItem[]>(`/admin/quizzes${queryString}`);
  }

  async getAdminQuiz(id: number): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/quizzes/${id}`);
  }

  async patchAdminQuiz(id: number, data: any): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/quizzes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async regenerateQuiz(id: number, data?: any): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/quizzes/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async approveQuiz(id: number): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/quizzes/${id}/approve`, {
      method: 'POST',
    });
  }

  async publishQuiz(id: number): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/quizzes/${id}/publish`, {
      method: 'POST',
    });
  }

  async archiveQuiz(id: number): Promise<AdminQuizItem> {
    return this.request<AdminQuizItem>(`/admin/quizzes/${id}/archive`, {
      method: 'POST',
    });
  }

  async patchAdminQuestion(id: number, data: any): Promise<AdminQuestionItem> {
    return this.request<AdminQuestionItem>(`/admin/questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async regenerateAdminQuestion(id: number): Promise<AdminQuestionItem> {
    return this.request<AdminQuestionItem>(`/admin/questions/${id}/regenerate`, {
      method: 'POST',
    });
  }

  async deleteAdminQuestion(id: number): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>(`/admin/questions/${id}`, {
      method: 'DELETE',
    });
  }

  async addAdminQuestion(quizId: number, data: any): Promise<AdminQuestionItem> {
    return this.request<AdminQuestionItem>(`/admin/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- BUILD 07: Student Learning & Quiz Endpoints ---
  async getStudentTopicQuizzes(topicId: number): Promise<any[]> {
    return this.request<any[]>(`/learn/topics/${topicId}/quizzes`);
  }

  async getStudentTopicQuiz(topicId: number): Promise<any> {
    return this.request<any>(`/learn/topics/${topicId}/quiz`);
  }

  async getStudentQuizById(id: number): Promise<any> {
    return this.request<any>(`/learn/quizzes/${id}`);
  }

  async startQuizSession(id: number): Promise<any> {
    return this.request<any>(`/learn/quizzes/${id}/start`, {
      method: 'POST',
    });
  }

  async submitDetailedQuizAttempt(quizId: number, answers: Record<string, any>): Promise<DetailedQuizResult> {
    return this.request<DetailedQuizResult>(`/learn/quizzes/${quizId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }

  async getStudentQuizAttempts(quizId: number): Promise<DetailedQuizResult[]> {
    return this.request<DetailedQuizResult[]>(`/learn/quizzes/${quizId}/attempts`);
  }

  async getStudentTopicPerformance(topicId: number): Promise<StudentTopicPerformance> {
    return this.request<StudentTopicPerformance>(`/learn/topics/${topicId}/performance`);
  }

  async generateAdaptiveQuiz(topicId: number): Promise<any> {
    return this.request<any>(`/learn/topics/${topicId}/adaptive-quiz`, {
      method: 'POST',
    });
  }

  // --- BUILD 09: Assignment Engine Endpoints ---

  // Teacher Endpoints
  async getTeacherAssignedStudents(): Promise<TeacherAssignedStudent[]> {
    return this.request<TeacherAssignedStudent[]>('/api/teacher/students');
  }

  async getTeacherAssignments(): Promise<TeacherAssignmentItem[]> {
    return this.request<TeacherAssignmentItem[]>('/api/teacher/assignments');
  }

  async getTeacherAssignment(id: number): Promise<TeacherAssignmentDetail> {
    return this.request<TeacherAssignmentDetail>(`/api/teacher/assignments/${id}`);
  }

  async createTeacherAssignment(payload: AssignmentCreatePayload): Promise<TeacherAssignmentItem> {
    return this.request<TeacherAssignmentItem>('/api/teacher/assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTeacherAssignment(id: number, payload: AssignmentUpdatePayload): Promise<TeacherAssignmentItem> {
    return this.request<TeacherAssignmentItem>(`/api/teacher/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteTeacherAssignment(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/teacher/assignments/${id}`, {
      method: 'DELETE',
    });
  }

  async getAssignmentSubmissions(assignmentId: number): Promise<AssignmentSubmissionItem[]> {
    return this.request<AssignmentSubmissionItem[]>(`/api/teacher/assignments/${assignmentId}/submissions`);
  }

  async gradeAssignmentSubmission(
    assignmentId: number,
    payload: AssignmentGradePayload
  ): Promise<AssignmentSubmissionItem> {
    return this.request<AssignmentSubmissionItem>(`/api/teacher/assignments/${assignmentId}/grade`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getTeacherAssignmentsSummary(): Promise<TeacherAssignmentSummary> {
    return this.request<TeacherAssignmentSummary>('/api/teacher/assignments-summary');
  }

  // Student Endpoints
  async getStudentAssignments(): Promise<StudentAssignmentListItem[]> {
    return this.request<StudentAssignmentListItem[]>('/api/student/assignments');
  }

  async getStudentAssignmentDetail(id: number): Promise<StudentAssignmentDetail> {
    return this.request<StudentAssignmentDetail>(`/api/student/assignments/${id}`);
  }

  async submitStudentAssignment(
    id: number,
    payload: { submission_text?: string; file_url?: string }
  ): Promise<StudentAssignmentDetail> {
    return this.request<StudentAssignmentDetail>(`/api/student/assignments/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getStudentAssignmentsSummary(): Promise<StudentAssignmentSummary> {
    return this.request<StudentAssignmentSummary>('/api/student/assignments-summary');
  }

  // Parent Endpoints
  async getParentChildAssignments(studentId: number): Promise<ParentAssignmentItem[]> {
    return this.request<ParentAssignmentItem[]>(`/api/parent/children/${studentId}/assignments`);
  }

  async getParentAssignments(): Promise<ParentAssignmentItem[]> {
    return this.request<ParentAssignmentItem[]>('/api/parent/assignments');
  }

  async getParentAssignmentsSummary(): Promise<ParentAssignmentSummary> {
    return this.request<ParentAssignmentSummary>('/api/parent/assignments-summary');
  }

  // File Upload
  async uploadAssignmentFile(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ url: string; filename: string }>('/api/assignments/upload', {
      method: 'POST',
      body: formData,
    });
  }
}

export const api = new ApiClient();
