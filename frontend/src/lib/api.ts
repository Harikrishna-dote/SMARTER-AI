import type {
  AdminStats,
  AdminUserListItem,
  AgentConfig,
  AgentCreate,
  AgentRunRequest,
  AgentRunResponse,
  ApiError,
  AssessmentPlanRequest,
  AssessmentPlanResponse,
  BadgeResponse,
  BookmarkResponse,
  CalendarEventCreate,
  CalendarEventResponse,
  ClassSource,
  ChatRequest,
  ChatResponse,
  ClassroomConfig,
  CurriculumContext,
  ClassroomProgress,
  CodingSessionCreate,
  CodingSessionResponse,
  Conversation,
  DashboardStats,
  DocumentItem,
  ExplainResponse,
  FlashcardResponse,
  ForumCommentCreate,
  ForumCommentResponse,
  ForumPostCreate,
  ForumPostResponse,
  GeneratedHomework,
  GeneratedLesson,
  GeneratedNotes,
  GeneratedQuiz,
  GroupDiscussionCreate,
  GroupDiscussionResponse,
  HomeworkEvaluation,
  InterviewSessionCreate,
  InterviewSessionResponse,
  LanguageOption,
  LearningClass,
  LoginRequest,
  MemoryCreate,
  MemoryItem,
  Message,
  NotificationResponse,
  OCRResponse,
  PlatformActivity,
  PortfolioItemCreate,
  PortfolioItemResponse,
  PrivacySettingsResponse,
  ProjectCreate,
  ProjectResponse,
  QuizResponse,
  RegisterRequest,
  RoleUpdateRequest,
  UpdateUserRoleRequest,
  SavedPhraseResponse,
  SearchResultItem,
  SyllabusExtraction,
  SharedNoteCreate,
  SharedNoteResponse,
  StudentProgress,
  StudyGroupCreate,
  StudyGroupMemberResponse,
  StudyGroupResponse,
  ToggleUserActiveRequest,
  TokenResponse,
  TranslationHistoryItem,
  TranslationLearningPlanRequest,
  TranslationLearningPlanResponse,
  TranslationTextRequest,
  TranslationTextResponse,
  User,
  VocabularyItemResponse,
  WhiteboardCreate,
  WhiteboardResponse,
} from './types';

const API_PREFIX = '/api/v1';
const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const TOKEN_KEY = 'smarterai.token';

type ChatStreamEvent =
  | { type: 'meta'; model?: string; speed?: string }
  | { type: 'token'; content: string }
  | { type: 'error'; message?: string }
  | { type: 'done'; message: Message; done?: boolean; first_token_seconds?: number; total_seconds?: number };

if (RAW_BASE_URL) {
  console.warn('[API] Direct backend base URL detected:', RAW_BASE_URL, '- proxy may be bypassed');
}

function apiRoot(): string {
  if (!BASE_URL) {
    if (import.meta.env.DEV) {
      console.warn('[api] No VITE_API_URL configured. Falling back to window.location.origin. Ensure your Vite dev proxy is active or set VITE_API_URL in frontend/.env');
    }
    return window.location.origin;
  }
  return BASE_URL.endsWith(API_PREFIX) ? BASE_URL.slice(0, -API_PREFIX.length) || window.location.origin : BASE_URL;
}

function apiUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${apiRoot()}${API_PREFIX}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(apiErrorMessage(status, detail));
    this.status = status;
    this.detail = detail;
    this.name = 'ApiClientError';
  }
}

export function apiErrorMessage(status: number, detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return null;
        const record = item as { loc?: unknown; msg?: unknown; detail?: unknown };
        const message = typeof record.msg === 'string'
          ? record.msg
          : typeof record.detail === 'string'
            ? record.detail
            : null;
        if (!message) return null;
        const loc = Array.isArray(record.loc)
          ? record.loc.filter((part) => typeof part === 'string' || typeof part === 'number').slice(1).join('.')
          : '';
        return loc ? `${loc}: ${message}` : message;
      })
      .filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  if (detail && typeof detail === 'object') {
    const record = detail as { message?: unknown; msg?: unknown; detail?: unknown };
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
    if (typeof record.msg === 'string' && record.msg.trim()) return record.msg;
    if (typeof record.detail === 'string' && record.detail.trim()) return record.detail;
  }
  const statusMessages: Record<number, string> = {
    400: 'Please check the request and try again.',
    401: 'Please sign in again.',
    403: 'You do not have permission to do that.',
    404: 'The requested item was not found.',
    409: 'This item already exists.',
    422: 'Please check the form and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'The server had a problem. Please try again.',
  };
  return statusMessages[status] ?? 'Request failed';
}

async function parseError(res: Response): Promise<ApiError> {
  let detail: ApiError['detail'] = null;
  try {
    const data = await res.json();
    // FastAPI uses `detail`; the enhanced backend middleware wraps unexpected
    // failures in `{ error: { message, ... } }`.
    detail = data?.detail ?? data?.error ?? null;
  } catch {
    detail = res.statusText;
  }
  return { detail, status: res.status };
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
    isForm?: boolean;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders() };
  let payload: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.isForm) {
      payload = options.body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(options.body);
    }
  }

  const url = apiUrl(path, options.query);
  const res = await fetch(url, { method, headers, body: payload });
  if (!res.ok) {
    console.error('[API] request failed:', res.status, res.statusText);
    const err = await parseError(res);
    throw new ApiClientError(err.status, err.detail);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  // ----- Auth -----
  async login(payload: LoginRequest): Promise<TokenResponse> {
    return request<TokenResponse>('POST', '/auth/login', { body: payload });
  },
  async register(payload: RegisterRequest): Promise<User> {
    return request<User>('POST', '/auth/register', { body: payload });
  },
  async me(): Promise<User> {
    return request<User>('GET', '/auth/me');
  },

  // ----- Users -----
  async dashboard(): Promise<DashboardStats> {
    return request<DashboardStats>('GET', '/users/dashboard');
  },
  async profile(): Promise<User> {
    return request<User>('GET', '/users/me');
  },

  // ----- Chats -----
  async createConversation(title = 'New conversation'): Promise<Conversation> {
    return request<Conversation>('POST', '/chats/conversations', { body: { title } });
  },
  async listConversations(): Promise<Conversation[]> {
    return request<Conversation[]>('GET', '/chats/conversations');
  },
  async listMessages(conversationId: string): Promise<Message[]> {
    return request<Message[]>('GET', `/chats/conversations/${conversationId}/messages`);
  },
  async deleteConversation(conversationId: string): Promise<void> {
    return request<void>('DELETE', `/chats/conversations/${conversationId}`);
  },
  async sendMessage(conversationId: string, payload: ChatRequest): Promise<ChatResponse> {
    return request<ChatResponse>('POST', `/chats/conversations/${conversationId}/messages`, {
      body: payload,
    });
  },
  async *streamMessage(
    conversationId: string,
    payload: ChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const streamUrl = apiUrl(`/chats/conversations/${conversationId}/stream`);
    const res = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) {
      const err = await parseError(res);
      throw new ApiClientError(err.status, err.detail);
    }
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            yield JSON.parse(trimmed) as ChatStreamEvent;
          } catch {
            /* ignore malformed keep-alive lines */
          }
        }
      }
      const trailing = buffer.trim();
      if (trailing) {
        try {
          yield JSON.parse(trailing) as ChatStreamEvent;
        } catch {
          /* ignore malformed trailing lines */
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  // ----- Documents -----
  async listDocuments(): Promise<DocumentItem[]> {
    return request<DocumentItem[]>('GET', '/documents');
  },
  async uploadDocument(file: File): Promise<DocumentItem> {
    const form = new FormData();
    form.append('file', file);
    return request<DocumentItem>('POST', '/documents', { body: form, isForm: true });
  },
  async chatWithDocument(documentId: string, question: string): Promise<{ answer: string; document_id: string }> {
    return request('POST', `/documents/${documentId}/chat`, { body: { question } });
  },

  // ----- Memory -----
  async listMemory(): Promise<MemoryItem[]> {
    return request<MemoryItem[]>('GET', '/memory');
  },
  async createMemory(payload: MemoryCreate): Promise<MemoryItem> {
    return request<MemoryItem>('POST', '/memory', { body: payload });
  },

  // ----- Agents -----
  async listAgents(): Promise<AgentConfig[]> {
    return request<AgentConfig[]>('GET', '/agents');
  },
  async createAgent(payload: AgentCreate): Promise<AgentConfig> {
    return request<AgentConfig>('POST', '/agents', { body: payload });
  },
  async runAgent(agentId: string, payload: AgentRunRequest): Promise<AgentRunResponse> {
    return request<AgentRunResponse>('POST', `/agents/${agentId}/run`, { body: payload });
  },

  // ----- Translation -----
  async translationLanguages(): Promise<LanguageOption[]> {
    return request<LanguageOption[]>('GET', '/translation/languages');
  },
  async translateText(payload: TranslationTextRequest): Promise<TranslationTextResponse> {
    return request<TranslationTextResponse>('POST', '/translation/text', { body: payload });
  },
  async translationHistory(): Promise<TranslationHistoryItem[]> {
    return request<TranslationHistoryItem[]>('GET', '/translation/history');
  },
  async clearTranslationHistory(): Promise<void> {
    return request<void>('DELETE', '/translation/history');
  },

  async ocrImage(file: File, language = 'auto'): Promise<OCRResponse> {
    const form = new FormData();
    form.append('file', file);
    return request<OCRResponse>('POST', '/translation/ocr', {
      body: form,
      isForm: true,
      query: { language },
    });
  },
  async explainTranslation(payload: {
    content: string;
    source_language: string;
    target_language: string;
    focus?: string;
  }): Promise<ExplainResponse> {
    return request<ExplainResponse>('POST', '/translation/explain', { body: payload });
  },
  async translationLearningPlan(payload: TranslationLearningPlanRequest): Promise<TranslationLearningPlanResponse> {
    return request<TranslationLearningPlanResponse>('POST', '/translation/learning-plan', { body: payload });
  },
  async generateFlashcards(payload: {
    content: string;
    source_language: string;
    target_language: string;
    count?: number;
  }): Promise<FlashcardResponse[]> {
    return request<FlashcardResponse[]>('POST', '/translation/flashcards', { body: payload });
  },
  async generateQuiz(payload: {
    content: string;
    source_language: string;
    target_language: string;
    count?: number;
    types?: string[];
  }): Promise<QuizResponse> {
    return request<QuizResponse>('POST', '/translation/quiz', { body: payload });
  },

  async vocabularyList(): Promise<VocabularyItemResponse[]> {
    return request<VocabularyItemResponse[]>('GET', '/translation/vocabulary');
  },
  async saveVocabulary(payload: Record<string, unknown>): Promise<VocabularyItemResponse> {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, String(v));
    });
    return request<VocabularyItemResponse>('POST', '/translation/vocabulary', { body: form, isForm: true });
  },
  async deleteVocabulary(itemId: string): Promise<void> {
    return request<void>('DELETE', `/translation/vocabulary/${itemId}`);
  },

  async bookmarkList(): Promise<BookmarkResponse[]> {
    return request<BookmarkResponse[]>('GET', '/translation/bookmarks');
  },
  async addBookmark(payload: Record<string, unknown>): Promise<BookmarkResponse> {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, String(v));
    });
    return request<BookmarkResponse>('POST', '/translation/bookmarks', { body: form, isForm: true });
  },
  async deleteBookmark(bookmarkId: string): Promise<void> {
    return request<void>('DELETE', `/translation/bookmarks/${bookmarkId}`);
  },

  async favoritesList(): Promise<SavedPhraseResponse[]> {
    return request<SavedPhraseResponse[]>('GET', '/translation/favorites');
  },
  async addFavorite(payload: Record<string, unknown>): Promise<SavedPhraseResponse> {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, String(v));
    });
    return request<SavedPhraseResponse>('POST', '/translation/favorites', { body: form, isForm: true });
  },
  async deleteFavorite(phraseId: string): Promise<void> {
    return request<void>('DELETE', `/translation/favorites/${phraseId}`);
  },

  async saveQuizResult(payload: {
    topic: string;
    questions: unknown[];
    source_language: string;
    target_language: string;
    score: number;
    total: number;
    completed: boolean;
  }): Promise<QuizResponse> {
    const form = new FormData();
    form.append('topic', payload.topic);
    form.append('questions', JSON.stringify(payload.questions));
    form.append('source_language', payload.source_language);
    form.append('target_language', payload.target_language);
    form.append('score', String(payload.score));
    form.append('total', String(payload.total));
    form.append('completed', String(payload.completed));
    return request<QuizResponse>('POST', '/translation/quizzes/save', { body: form, isForm: true });
  },
  async quizList(): Promise<QuizResponse[]> {
    return request<QuizResponse[]>('GET', '/translation/quizzes');
  },

  // ----- Assessment, Labs, Projects, Career -----
  async assessmentPlan(payload: AssessmentPlanRequest): Promise<AssessmentPlanResponse> {
    return request<AssessmentPlanResponse>('POST', '/assessment/plan', { body: payload });
  },

  // ----- Vision -----
  async ocr(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await request<{ text: string }>('POST', '/vision/ocr', { body: form, isForm: true });
    return res.text;
  },
  async analyzeImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await request<{ description: string }>('POST', '/vision/analyze', { body: form, isForm: true });
    return res.description;
  },

  // ----- Voice -----
  async transcribe(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await request<{ text: string }>('POST', '/voice/transcribe', { body: form, isForm: true });
    return res.text;
  },
  async transcribeAudio(blob: Blob, filename = 'voice.webm'): Promise<{ text: string; language?: string }> {
    const form = new FormData();
    form.append('file', blob, filename);
    return request<{ text: string; language?: string }>('POST', '/voice/transcribe', { body: form, isForm: true });
  },
  async synthesize(text: string, language?: string, rate = 1): Promise<Blob> {
    const url = apiUrl('/voice/synthesize', { ...(language ? { language } : {}), rate });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text, rate }),
    });
    if (!res.ok) throw new ApiClientError(res.status, res.statusText);
    return res.blob();
  },
  async synthesizeStream(
    text: string,
    language: string | undefined,
    onChunk: (audio: Blob) => void,
    rate = 1,
  ): Promise<void> {
    const url = apiUrl('/voice/synthesize/stream', { ...(language ? { language } : {}), rate });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text, rate }),
    });
    if (!res.ok || !res.body) throw new ApiClientError(res.status || 502, res.statusText || 'Voice stream unavailable');
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type?: string; data?: string; mime_type?: string; message?: string };
          if (event.type === 'error') throw new Error(event.message || 'Voice stream failed');
          if (event.type !== 'audio' || !event.data) continue;
          const binary = atob(event.data);
          const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
          onChunk(new Blob([bytes], { type: event.mime_type || 'audio/wav' }));
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  },
  async voiceStatus(): Promise<{
    stt_available: boolean;
    tts_available: boolean;
    piper_telugu: boolean;
    piper_english: boolean;
    parler_available: boolean;
    supported_languages: string[];
    default_language: string;
  }> {
    return request<{
      stt_available: boolean;
      tts_available: boolean;
      piper_telugu: boolean;
      piper_english: boolean;
      parler_available: boolean;
      supported_languages: string[];
      default_language: string;
    }>('GET', '/voice/status');
  },
  async warmupVoice(): Promise<{ stt: boolean; tts: boolean }> {
    return request<{ stt: boolean; tts: boolean }>('POST', '/voice/warmup');
  },
  async detectLanguage(text: string): Promise<{ language: string }> {
    return request<{ language: string }>('POST', '/voice/detect-language', { body: { text } });
  },
  async createLessonVoiceSession(
    conversationId: string,
    segments: string[],
    language: string,
  ): Promise<{
    session_id: string;
    conversation_id: string;
    user_id: string;
    language: string;
    paused: boolean;
    current_index: number;
    segments: Array<Record<string, unknown>>;
    created_at: number;
  }> {
    return request('POST', '/voice/lesson/sync', {
      body: { conversation_id: conversationId, segments, language },
    });
  },
  async pauseLessonVoice(sessionId: string): Promise<{ paused: boolean }> {
    return request<{ paused: boolean }>('POST', '/voice/lesson/pause', { body: { session_id: sessionId } });
  },
  async resumeLessonVoice(sessionId: string): Promise<{ resumed: boolean }> {
    return request<{ resumed: boolean }>('POST', '/voice/lesson/resume', { body: { session_id: sessionId } });
  },
  async endLessonVoice(sessionId: string): Promise<{ ended: boolean }> {
    return request<{ ended: boolean }>('POST', '/voice/lesson/end', { body: { session_id: sessionId } });
  },

  // ----- Settings -----
  async getSettings(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('GET', '/settings');
  },
  async updateSettings(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('PATCH', '/settings', { body: payload });
  },

  // ----- Search -----
  async search(q: string): Promise<SearchResultItem[]> {
    const res = await request<{ results: SearchResultItem[] }>('GET', '/search', { query: { q } });
    return res.results;
  },
  async searchIndex(): Promise<SearchResultItem[]> {
    const res = await request<{ items: SearchResultItem[] }>('GET', '/search/index');
    return res.items;
  },

  // ----- AI Tutor Classroom -----
  async classroomLesson(config: ClassroomConfig, topic: string): Promise<GeneratedLesson> {
    return request<GeneratedLesson>('POST', '/classroom/lesson', { body: { config, topic } });
  },
  async extractClassSyllabus(file: File): Promise<SyllabusExtraction> {
    const body = new FormData();
    body.append('file', file);
    return request<SyllabusExtraction>('POST', '/classroom/classes/syllabus', { body, isForm: true });
  },
  async createLearningClass(payload: {
    goal: string;
    level: string;
    language: ClassroomConfig['language'];
    syllabus_source: ClassSource;
    syllabus_text?: string;
    syllabus_filename?: string | null;
    avatar_type?: ClassroomConfig['avatar_type'];
    learning_mode?: ClassroomConfig['learning_mode'];
    teaching_style?: ClassroomConfig['teaching_style'];
    curriculum_context?: CurriculumContext;
  }): Promise<LearningClass> {
    return request<LearningClass>('POST', '/classroom/classes', { body: payload });
  },
  async listLearningClasses(): Promise<LearningClass[]> {
    return request<LearningClass[]>('GET', '/classroom/classes');
  },
  async getLearningClass(classId: string): Promise<LearningClass> {
    return request<LearningClass>('GET', `/classroom/classes/${encodeURIComponent(classId)}`);
  },
  async updateLearningClassCurriculum(classId: string, topics: string[], source: ClassSource = 'custom'): Promise<LearningClass> {
    return request<LearningClass>('PATCH', `/classroom/classes/${encodeURIComponent(classId)}/curriculum`, { body: { topics, source } });
  },
  async saveLearningClassCheckpoint(classId: string, payload: {
    current_lesson: number;
    scene_id?: string | null;
    stage?: string | null;
    position?: number;
    paused?: boolean;
    current_concept?: string | null;
    current_sentence?: string | null;
    visual_state?: Record<string, unknown> | null;
    animation_time?: number | null;
    lesson_progress?: number | null;
    mastery?: Record<string, unknown> | null;
    language?: string | null;
    voice_settings?: Record<string, unknown> | null;
    difficulty?: string | null;
    pending_question?: string | null;
    pending_task?: Record<string, unknown> | null;
  }): Promise<LearningClass> {
    return request<LearningClass>('POST', `/classroom/classes/${encodeURIComponent(classId)}/checkpoint`, { body: payload });
  },
  async startLearningClass(classId: string): Promise<{ learning_class: LearningClass; session: Record<string, unknown> }> {
    return request<{ learning_class: LearningClass; session: Record<string, unknown> }>('POST', `/classroom/classes/${encodeURIComponent(classId)}/start`);
  },
  async startAutonomousLesson(config: ClassroomConfig, topic: string): Promise<{
    session_id: string;
    type: string;
    stage?: string;
    progress_percent?: number;
    content?: string | Record<string, unknown>;
    roadmap?: Record<string, unknown>;
    lesson?: Record<string, unknown>;
    message?: string;
    next_stage?: string;
    concepts_covered?: string[];
    pending_concepts?: string[];
    is_completed?: boolean;
    next_recommendation?: string | null;
    resume_snapshot?: Record<string, unknown>;
  }> {
    return request('POST', '/classroom/autonomous/start', { body: { config, topic } });
  },
  async continueAutonomousLesson(sessionId: string, studentInput?: string): Promise<{
    session_id: string;
    type: string;
    stage?: string;
    progress_percent?: number;
    content?: string | Record<string, unknown>;
    message?: string;
    concepts_covered?: string[];
    pending_concepts?: string[];
    next_stage?: string | null;
    is_completed?: boolean;
    next_recommendation?: string | null;
    resume_lesson?: boolean;
    interruption_type?: string;
    resume_snapshot?: Record<string, unknown>;
  }> {
    return request('POST', '/classroom/autonomous/continue', { body: { session_id: sessionId, student_input: studentInput } });
  },
  async pauseAutonomousLesson(sessionId: string): Promise<{ paused: boolean }> {
    return request<{ paused: boolean }>('POST', '/classroom/autonomous/pause', { body: { session_id: sessionId } });
  },
  async resumeAutonomousLesson(sessionId: string): Promise<{
    session_id: string;
    type: string;
    stage?: string;
    progress_percent?: number;
    content?: string | Record<string, unknown>;
    message?: string;
    concepts_covered?: string[];
    pending_concepts?: string[];
    next_stage?: string | null;
    is_completed?: boolean;
    next_recommendation?: string | null;
    resume_lesson?: boolean;
    resume_snapshot?: Record<string, unknown>;
  }> {
    return request('POST', '/classroom/autonomous/resume', { body: { session_id: sessionId } });
  },
  async *streamAutonomousLesson(sessionId: string): AsyncGenerator<Record<string, unknown>> {
    const streamUrl = apiUrl(`/classroom/autonomous/stream/${sessionId}`);
    const res = await fetch(streamUrl, {
      method: 'GET',
      headers: { ...authHeaders() },
    });
    if (!res.ok) {
      const err = await parseError(res);
      throw new ApiClientError(err.status, err.detail);
    }
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            yield JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
  async changeAutonomousTopic(sessionId: string, newTopic: string, config: ClassroomConfig): Promise<{
    session_id: string;
    type: string;
    message?: string;
    new_topic?: string;
  }> {
    return request('POST', '/classroom/autonomous/change-topic', { body: { session_id: sessionId, new_topic: newTopic, config } });
  },
  async classroomQuiz(
    config: ClassroomConfig,
    topic: string,
    count = 5,
    types: string[] = ['mcq', 'true_false', 'fill_blank'],
  ): Promise<GeneratedQuiz> {
    return request<GeneratedQuiz>('POST', '/classroom/quiz', { body: { config, topic, count, types } });
  },
  async classroomNotes(config: ClassroomConfig, topic: string): Promise<GeneratedNotes> {
    return request<GeneratedNotes>('POST', '/classroom/notes', { body: { config, topic } });
  },
  async classroomHomework(config: ClassroomConfig, topic: string, difficulty = 'medium'): Promise<GeneratedHomework> {
    return request<GeneratedHomework>('POST', '/classroom/homework', { body: { config, topic, difficulty } });
  },
  async classroomEvaluate(config: ClassroomConfig, items: { question: string; answer: string; expected?: string }[], topic = ''): Promise<HomeworkEvaluation> {
    return request<HomeworkEvaluation>('POST', '/classroom/evaluate', { body: { config, items, topic } });
  },
  async classroomProgress(): Promise<ClassroomProgress> {
    return request<ClassroomProgress>('GET', '/classroom/progress');
  },
  async classroomUpdateProgress(update: Partial<ClassroomProgress> & { xp_delta?: number; action?: string; topic?: string; quiz_score?: number; homework_correct?: number; homework_total?: number }): Promise<ClassroomProgress> {
    return request<ClassroomProgress>('POST', '/classroom/progress', { body: update });
  },
  async generateVisualization(payload: {
    topic: string;
    concept: string;
    subject?: string;
    difficulty?: string;
    level?: string;
    mode_hint?: string;
    real_world_example?: string;
    config?: ClassroomConfig;
  }): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('POST', '/classroom/visualization', { body: payload });
  },

  // ----- Admin -----
  async adminStats(): Promise<AdminStats> {
    return request<AdminStats>('GET', '/admin/stats');
  },
  async listUsers(query?: { role?: string; search?: string }): Promise<AdminUserListItem[]> {
    return request<AdminUserListItem[]>('GET', '/admin/users', { query });
  },
  async updateUserRole(payload: UpdateUserRoleRequest): Promise<{ role: string }> {
    return request<{ role: string }>('PATCH', `/admin/users/${encodeURIComponent(payload.user_id)}/role`, { body: { role: payload.role } });
  },
  async toggleUserActive(payload: ToggleUserActiveRequest): Promise<{ is_active: boolean }> {
    return request<{ is_active: boolean }>('PATCH', `/admin/users/${encodeURIComponent(payload.user_id)}/activate`, {
      query: { active: payload.is_active },
    });
  },
  async platformActivity(): Promise<PlatformActivity> {
    return request<PlatformActivity>('GET', '/admin/activity');
  },

  // ----- Students -----
  async listStudents(query?: { search?: string; class_id?: string }): Promise<User[]> {
    return request<User[]>('GET', '/admin/students', { query });
  },
  async listClasses(): Promise<StudyGroupResponse[]> {
    return request<StudyGroupResponse[]>('GET', '/admin/classes');
  },
  async getStudentProgress(studentId: string): Promise<StudentProgress> {
    return request<StudentProgress>('GET', `/admin/students/${encodeURIComponent(studentId)}/progress`);
  },

  // ----- Roles -----
  async updateRole(payload: RoleUpdateRequest): Promise<{ role: string }> {
    return request<{ role: string }>('PATCH', '/ecosystem/role', { body: payload });
  },

  // ----- Study Groups -----
  async createStudyGroup(payload: StudyGroupCreate): Promise<StudyGroupResponse> {
    return request<StudyGroupResponse>('POST', '/ecosystem/study-groups', { body: payload });
  },
  async listStudyGroups(): Promise<StudyGroupResponse[]> {
    return request<StudyGroupResponse[]>('GET', '/ecosystem/study-groups');
  },
  async joinStudyGroup(groupId: string): Promise<StudyGroupMemberResponse> {
    return request<StudyGroupMemberResponse>('POST', `/ecosystem/study-groups/${encodeURIComponent(groupId)}/join`);
  },
  async listGroupDiscussions(groupId: string): Promise<GroupDiscussionResponse[]> {
    return request<GroupDiscussionResponse[]>('GET', `/ecosystem/study-groups/${encodeURIComponent(groupId)}/discussions`);
  },
  async createGroupDiscussion(groupId: string, payload: GroupDiscussionCreate): Promise<GroupDiscussionResponse> {
    return request<GroupDiscussionResponse>('POST', `/ecosystem/study-groups/${encodeURIComponent(groupId)}/discussions`, { body: payload });
  },
  async createSharedNote(groupId: string, payload: SharedNoteCreate): Promise<SharedNoteResponse> {
    return request<SharedNoteResponse>('POST', `/ecosystem/study-groups/${encodeURIComponent(groupId)}/notes`, { body: payload });
  },
  async listSharedNotes(groupId: string): Promise<SharedNoteResponse[]> {
    return request<SharedNoteResponse[]>('GET', `/ecosystem/study-groups/${encodeURIComponent(groupId)}/notes`);
  },

  // ----- Projects -----
  async createProject(payload: ProjectCreate): Promise<ProjectResponse> {
    return request<ProjectResponse>('POST', '/ecosystem/projects', { body: payload });
  },
  async listProjects(): Promise<ProjectResponse[]> {
    return request<ProjectResponse[]>('GET', '/ecosystem/projects');
  },
  async updateProject(projectId: string, payload: ProjectCreate): Promise<ProjectResponse> {
    return request<ProjectResponse>('PATCH', `/ecosystem/projects/${encodeURIComponent(projectId)}`, { body: payload });
  },
  async deleteProject(projectId: string): Promise<void> {
    return request<void>('DELETE', `/ecosystem/projects/${encodeURIComponent(projectId)}`);
  },

  // ----- Portfolio -----
  async createPortfolioItem(payload: PortfolioItemCreate): Promise<PortfolioItemResponse> {
    return request<PortfolioItemResponse>('POST', '/ecosystem/portfolio', { body: payload });
  },
  async listPortfolio(): Promise<PortfolioItemResponse[]> {
    return request<PortfolioItemResponse[]>('GET', '/ecosystem/portfolio');
  },

  // ----- Notifications -----
  async listNotifications(unreadOnly = false): Promise<NotificationResponse[]> {
    return request<NotificationResponse[]>('GET', `/ecosystem/notifications?unread_only=${unreadOnly}`);
  },
  async markNotificationRead(notificationId: string): Promise<{ read: boolean }> {
    return request<{ read: boolean }>('PATCH', `/ecosystem/notifications/${encodeURIComponent(notificationId)}/read`);
  },
  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return request<{ updated: number }>('POST', '/ecosystem/notifications/read-all');
  },

  // ----- Calendar -----
  async createCalendarEvent(payload: CalendarEventCreate): Promise<CalendarEventResponse> {
    return request<CalendarEventResponse>('POST', '/ecosystem/calendar/events', { body: payload });
  },
  async listCalendarEvents(startDate?: string, endDate?: string): Promise<CalendarEventResponse[]> {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const qs = params.toString();
    return request<CalendarEventResponse[]>('GET', `/ecosystem/calendar/events${qs ? `?${qs}` : ''}`);
  },
  async completeCalendarEvent(eventId: string): Promise<{ completed: boolean }> {
    return request<{ completed: boolean }>('PATCH', `/ecosystem/calendar/events/${encodeURIComponent(eventId)}/complete`);
  },

  // ----- Badges -----
  async listBadges(): Promise<BadgeResponse[]> {
    return request<BadgeResponse[]>('GET', '/ecosystem/badges');
  },

  // ----- Interview Simulator -----
  async createInterviewSession(payload: InterviewSessionCreate): Promise<InterviewSessionResponse> {
    return request<InterviewSessionResponse>('POST', '/ecosystem/interview/sessions', { body: payload });
  },
  async listInterviewSessions(): Promise<InterviewSessionResponse[]> {
    return request<InterviewSessionResponse[]>('GET', '/ecosystem/interview/sessions');
  },

  // ----- Coding Playground -----
  async createCodingSession(payload: CodingSessionCreate): Promise<CodingSessionResponse> {
    return request<CodingSessionResponse>('POST', '/ecosystem/coding/sessions', { body: payload });
  },
  async updateCodingSession(sessionId: string, code: string): Promise<CodingSessionResponse> {
    return request<CodingSessionResponse>('PATCH', `/ecosystem/coding/sessions/${encodeURIComponent(sessionId)}`, { body: { code } });
  },
  async listCodingSessions(): Promise<CodingSessionResponse[]> {
    return request<CodingSessionResponse[]>('GET', '/ecosystem/coding/sessions');
  },
  async runCodingSession(sessionId: string): Promise<CodingSessionResponse> {
    return request<CodingSessionResponse>('POST', `/ecosystem/coding/sessions/${encodeURIComponent(sessionId)}/run`);
  },

  // ----- Whiteboard -----
  async createWhiteboard(payload: WhiteboardCreate): Promise<WhiteboardResponse> {
    return request<WhiteboardResponse>('POST', '/ecosystem/whiteboards', { body: payload });
  },
  async listWhiteboards(): Promise<WhiteboardResponse[]> {
    return request<WhiteboardResponse[]>('GET', '/ecosystem/whiteboards');
  },
  async updateWhiteboard(boardId: string, payload: WhiteboardCreate): Promise<WhiteboardResponse> {
    return request<WhiteboardResponse>('PATCH', `/ecosystem/whiteboards/${encodeURIComponent(boardId)}`, { body: payload });
  },

  // ----- Forum -----
  async createForumPost(payload: ForumPostCreate): Promise<ForumPostResponse> {
    return request<ForumPostResponse>('POST', '/ecosystem/forum/posts', { body: payload });
  },
  async listForumPosts(topic?: string): Promise<ForumPostResponse[]> {
    const query = topic ? { query: { topic } } : undefined;
    return request<ForumPostResponse[]>('GET', '/ecosystem/forum/posts', query);
  },
  async createForumComment(postId: string, payload: ForumCommentCreate): Promise<ForumCommentResponse> {
    return request<ForumCommentResponse>('POST', `/ecosystem/forum/posts/${encodeURIComponent(postId)}/comments`, { body: payload });
  },
  async listForumComments(postId: string): Promise<ForumCommentResponse[]> {
    return request<ForumCommentResponse[]>('GET', `/ecosystem/forum/posts/${encodeURIComponent(postId)}/comments`);
  },

  // ----- Privacy -----
  async getPrivacySettings(): Promise<PrivacySettingsResponse> {
    return request<PrivacySettingsResponse>('GET', '/ecosystem/privacy');
  },
  async updatePrivacySettings(payload: Record<string, unknown>): Promise<PrivacySettingsResponse> {
    return request<PrivacySettingsResponse>('PATCH', '/ecosystem/privacy', { body: payload });
  },
};
