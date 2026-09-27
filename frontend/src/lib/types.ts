export type Role = 'student' | 'teacher' | 'parent' | 'administrator' | 'institution' | 'mentor';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  role: Role;
  xp: number;
  level: number;
  streak: number;
  last_active_date: string | null;
  career_goals: string[];
  skills: string[];
  interests: string[];
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface DashboardStats {
  conversations: number;
  memories: number;
  documents: number;
  agents: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatAttachment {
  type?: 'image' | 'video' | 'document' | 'web' | 'audio' | 'note';
  name?: string;
  content_type?: string | null;
  text?: string;
  summary?: string | null;
  source_url?: string | null;
}

export type TeachingMode =
  | 'explain'
  | 'solve'
  | 'practice'
  | 'quiz'
  | 'revise'
  | 'translate';

export interface TutorProfile {
  subject?: string;
  level?: string;
  teaching_mode?: TeachingMode;
  language?: string;
  response_style?: 'friendly' | 'concise' | 'step_by_step' | 'exam_ready';
  response_speed?: 'instant' | 'balanced' | 'deep';
}

export interface ChatRequest {
  message: string;
  use_memory?: boolean;
  document_id?: string | null;
  tutor?: TutorProfile;
  attachments?: ChatAttachment[];
  voice_response?: boolean;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
}

export interface DocumentItem {
  id: string;
  filename: string;
  content_type: string;
  extracted_text: string;
  created_at: string;
}

export interface MemoryItem {
  id: string;
  key?: string;
  content: string;
  category?: string;
  created_at: string;
}

export interface MemoryCreate {
  content: string;
  category?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  tools?: string[];
  is_public?: boolean;
  created_at?: string;
}

export interface AgentCreate {
  name: string;
  description?: string;
  system_prompt?: string;
  tools?: string[];
}

export interface AgentRunRequest {
  task: string;
}

export interface AgentRunResponse {
  output: string;
  tool_calls: string[];
}

export interface LanguageOption {
  code: string;
  name: string;
  native_name?: string;
}

export type TranslationTone = 'preserve' | 'formal' | 'casual' | 'simple' | 'natural' | 'technical';

export interface TranslationTextRequest {
  content: string;
  source_language: string;
  target_language: string;
  tone?: TranslationTone;
  preserve_formatting?: boolean;
}

export interface TranslationTextResponse {
  original_content: string;
  translated_content: string;
  source_language: string;
  detected_source_language: string;
  target_language: string;
  tone: TranslationTone;
  transliteration?: string;
  alternatives?: string[];
  notes?: string[];
  sentence_breakdown?: SentenceBreakdown | null;
  confidence_score?: number;
  time_taken_seconds?: number;
  character_count: number;
}

export interface TranslationHistoryItem {
  id: string;
  source_language: string;
  target_language: string;
  original_content: string;
  translated_content: string;
  mode: string;
  created_at: string;
  character_count: number;
}

export interface AdminStats {
  users: number;
  active_users: number;
  admins: number;
  conversations: number;
  messages: number;
  documents: number;
  memories: number;
  agents: number;
  storage: {
    database_bytes: number;
    database_files: number;
    uploads_bytes: number;
    uploads_files: number;
    extracted_bytes: number;
    extracted_files: number;
    total_bytes: number;
  };
  ai: Record<string, unknown>;
  features: Record<string, unknown>;
  requested_by: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  type: 'document' | 'chat' | 'page' | 'memory';
  href: string;
}

export interface ApiError {
  detail: string | { msg: string }[] | null;
  status: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type AvatarType =
  | 'male_teacher'
  | 'female_teacher'
  | 'professor'
  | 'school_teacher'
  | 'friendly_mentor'
  | 'kids_teacher';

export type LearningMode =
  | 'school'
  | 'college'
  | 'competitive_exam'
  | 'programming'
  | 'interview'
  | 'language_learning'
  | 'research'
  | 'professional_certification';

export type TeachingStyle =
  | 'slow'
  | 'normal'
  | 'fast'
  | 'very_detailed'
  | 'quick_revision'
  | 'visual'
  | 'story_based'
  | 'practical'
  | 'exam_oriented'
  | 'concept_based';

export type ClassroomLanguage = 'en' | 'te' | 'hi' | 'bilingual';

export interface CurriculumContext {
  country?: string;
  board?: string;
  institution?: string;
  course?: string;
  class_name?: string;
  academic_year?: string;
  exam?: string;
}

export interface ClassroomConfig {
  avatar_type: AvatarType;
  learning_mode: LearningMode;
  teaching_style: TeachingStyle;
  language: ClassroomLanguage;
  topic: string;
  subject?: string;
  level: string;
  curriculum_context?: CurriculumContext;
}

export type ClassSource = 'smart' | 'student' | 'merged' | 'custom';

export interface PreparationStage {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
}

export interface LearningClass {
  id: string;
  title: string;
  goal: string;
  subject: string;
  level: string;
  language: ClassroomLanguage;
  status: string;
  syllabus_source: ClassSource;
  syllabus_filename: string | null;
  syllabus_text: string;
  syllabus_topics: string[];
  curriculum: string[];
  comparison: {
    matches?: Array<{
      student_topic: string | null;
      ai_topic: string | null;
      status: string;
      score: number;
      student_order: number | null;
      ai_order: number | null;
    }>;
    counts?: Record<string, number>;
    selected_source?: ClassSource;
    selected_topics?: string[];
    curriculum_context?: CurriculumContext;
    curriculum_context_status?: 'provided' | 'not_specified';
    [key: string]: unknown;
  };
  prepared_content: {
    lesson?: GeneratedLesson;
    curriculum_tree?: {
      subject?: string;
      modules: Array<{
        id: string;
        title: string;
        chapters: Array<{
          id: string;
          title: string;
          topics: Array<{ id: string; title: string; subtopics: string[] }>;
        }>;
      }>;
    };
    board_scenes?: BoardScene[];
    coverage?: {
      complete: boolean;
      prepared_topics: string[];
      missing_topics: string[];
      fallback_topics: string[];
      requires_review: boolean;
      items: Array<{ topic: string; scene_id: string; source: string; score: number }>;
    };
    narration?: Array<{ scene_id: string; text: string; language: string }>;
    practice?: Array<{ id: string; topic: string; prompt: string }>;
    notes?: GeneratedNotes & { generated?: boolean };
    quiz?: GeneratedQuiz;
    [key: string]: unknown;
  };
  preparation: PreparationStage[];
  checkpoint: {
    student_id?: string;
    course_id?: string;
    subject_id?: string;
    curriculum_id?: string;
    module_id?: string;
    lesson_id?: string;
    topic_id?: string;
    subtopic_id?: string;
    current_visual_scene?: string | null;
    current_lesson?: number;
    scene_id?: string | null;
    stage?: string | null;
    position?: number;
    paused?: boolean;
    current_concept?: string;
    current_sentence?: string;
    visual_state?: Record<string, unknown>;
    animation_time?: number;
    lesson_progress?: number;
    mastery?: Record<string, unknown>;
    language?: ClassroomLanguage;
    voice_settings?: Record<string, unknown>;
    difficulty?: string;
    pending_question?: string | null;
    pending_task?: Record<string, unknown> | null;
    session_id?: string;
    [key: string]: unknown;
  };
  content_hash: string;
  current_lesson: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyllabusExtraction {
  filename: string;
  text: string;
  topics: string[];
  character_count: number;
}

export interface BoardScene {
  id: string;
  order: number;
  topic: string;
  visual_type: string;
  title: string;
  body: string;
  language: string;
  real_world_example?: string;
  coverage_source?: string;
  coverage_score?: number;
  animation?: { kind: string; labels: string[]; duration_ms?: number };
  events: Array<{ type: string; target: string; at: number }>;
  interactions: Array<Record<string, unknown>>;
}

export interface LessonOutlineItem {
  step: number;
  title: string;
  content: string;
  minutes: number;
  visual_script?: VisualScriptItem[];
}

export interface GeneratedLesson {
  title: string;
  subject: string;
  difficulty: string;
  estimated_minutes: number;
  learning_objectives: string[];
  outline: LessonOutlineItem[];
  key_concepts: string[];
  completed_topics: string[];
  remaining_topics: string[];
}

export interface QuizQuestion {
  id: string;
  type: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface GeneratedQuiz {
  topic: string;
  questions: QuizQuestion[];
}

export interface Flashcard {
  term: string;
  definition: string;
}

export interface GeneratedNotes {
  summary: string;
  key_points: string[];
  formula_sheet: string[];
  flashcards: Flashcard[];
  revision_sheet: string;
  mindmap: string;
}

export interface HomeworkTask {
  id: string;
  question: string;
  hint: string;
}

export interface GeneratedHomework {
  topic: string;
  difficulty: string;
  tasks: HomeworkTask[];
  note: string;
}

export interface EvaluatedItem {
  question: string;
  correct: boolean;
  score: number;
  feedback: string;
}

export interface HomeworkEvaluation {
  overall_score: number;
  items: EvaluatedItem[];
}

export interface Badge {
  id: string;
  label: string;
  description: string;
}

export interface ClassroomProgress {
  xp: number;
  level: number;
  xp_for_next_level: number;
  xp_into_level: number;
  streak: number;
  quizzes_taken: number;
  homework_completed: number;
  accuracy: number;
  topics_completed: string[];
  weak_topics: string[];
  strong_topics: string[];
  badges: Badge[];
  achievements: string[];
  last_active_date: string | null;
}

export type AssessmentActivityType =
  | 'adaptive_quiz'
  | 'exam_simulation'
  | 'homework'
  | 'project_lab'
  | 'coding_lab'
  | 'virtual_lab'
  | 'career_prep'
  | 'skill_assessment';

export type AssessmentDifficulty = 'foundational' | 'easy' | 'medium' | 'hard' | 'expert';

export interface AssessmentPlanRequest {
  topic: string;
  subject?: string;
  activity_type?: AssessmentActivityType;
  learner_level?: string;
  recent_accuracy?: number | null;
  completed_items?: number;
  exam_name?: string | null;
  requested_difficulty?: AssessmentDifficulty | 'adaptive';
  coding_language?: string;
  duration_minutes?: number | null;
}

export interface ProjectBriefResponse {
  objective: string;
  deliverables: string[];
  evaluation_criteria: string[];
  portfolio_tip: string;
}

export interface CodingLabBriefResponse {
  language: string;
  starter_tasks: string[];
  review_focus: string[];
  safety_checks: string[];
}

export interface VirtualLabBriefResponse {
  lab_type: string;
  simulation_focus: string[];
  safety_rules: string[];
  observation_tasks: string[];
}

export interface AssessmentPlanResponse {
  topic: string;
  subject: string;
  activity_type: AssessmentActivityType;
  mastery_band: 'needs_support' | 'practicing' | 'proficient' | 'advanced';
  difficulty: AssessmentDifficulty;
  question_types: string[];
  sections: string[];
  duration_minutes: number;
  negative_marking: boolean;
  practice_mix: string[];
  project_brief: ProjectBriefResponse | null;
  coding_lab: CodingLabBriefResponse | null;
  virtual_lab: VirtualLabBriefResponse | null;
  career_actions: string[];
  analytics_signals: string[];
  accessibility_support: string[];
  security_notes: string[];
  evaluation_rubric: string[];
  next_steps: string[];
  xp_reward: number;
}

export interface WordMeaning {
  source: string;
  meaning: string;
  translation: string;
  transliteration: string;
  note: string;
}

export interface SentenceBreakdown {
  original: string;
  translation: string;
  word_by_word: WordMeaning[];
  overall_meaning: string;
  formal_version: string;
  informal_version: string;
  natural_version: string;
  grammar_notes: string[];
}

export interface WordAnalysisDetail {
  original: string;
  pronunciation: string;
  ipa: string;
  meaning: string;
  translation: string;
  part_of_speech: string;
  root_word: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  usage: string;
  difficulty: string;
  frequency: string;
  frequency_rank?: number;
  related_words: string[];
  word_origin?: string;
  formal_usage?: string;
  informal_usage?: string;
  memory_tips: string[];
  common_mistakes: string[];
  cultural_notes?: string;
  verb_tense?: string;
  gender?: string;
  plural_form?: string;
}

export interface SentenceAnalysisDetail {
  original: string;
  translation: string;
  word_by_word: WordMeaning[];
  grammar: string[];
  grammar_notes: string[];
  meaning: string;
  overall_meaning: string;
  context: string;
  alternatives: string[];
  formal_version: string;
  informal_version: string;
  natural_version: string;
  professional_version: string;
  simple_version: string;
  spoken_version: string;
  literal_translation: string;
  contextual_translation: string;
  sentence_structure: string;
  similar_sentences: string[];
  tense?: string;
  voice?: string;
  mood?: string;
  idioms?: string[];
  cultural_meaning?: string;
}

export interface VocabularyItemResponse {
  id: string;
  word: string;
  translation: string;
  source_language: string;
  target_language: string;
  pronunciation: string;
  ipa: string;
  part_of_speech: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  difficulty: string;
  mastery: number;
  mastery_level: 'new' | 'learning' | 'review' | 'mastered';
  review_count: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  last_reviewed: string;
  next_review: string;
  created_at: string;
  tags: string[];
  notes: string;
}

export interface FlashcardResponse {
  id: string;
  front: string;
  back: string;
  source_language: string;
  target_language: string;
  hint?: string;
  example_sentence?: string;
  part_of_speech: string;
  difficulty: string;
  tags: string[];
  created_at: string;
  last_reviewed?: string;
  next_review: string;
  review_count: number;
}

export interface BookmarkResponse {
  id: string;
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  note: string;
  tags: string;
  created_at: string;
}

export interface SavedPhraseResponse {
  id: string;
  phrase: string;
  translation: string;
  source_language: string;
  target_language: string;
  context: string;
  category: string;
  usage_count: number;
  created_at: string;
}

export interface OCRBox {
  text: string;
  translation: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element_type: string;
  confidence: number;
}

export interface OCRResponse {
  text: string;
  boxes: OCRBox[];
  detected_language: string;
  confidence: number;
  processing_time_ms: number;
  word_count: number;
  language?: string;
  mode?: string;
}

export interface QuizQuestionSchema {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface QuizResponse {
  id: string;
  topic: string;
  source_language: string;
  target_language: string;
  questions: QuizQuestionSchema[];
  score: number;
  total: number;
  completed: boolean;
  created_at: string;
}

export interface ExplainResponse {
  original: string;
  translation: string;
  why_correct: string[];
  grammar_rules: string[];
  vocabulary_notes: string[];
  real_life_usage: string[];
  common_mistakes: string[];
  better_alternatives: string[];
}

export type TranslationSelectionType = 'word' | 'sentence' | 'paragraph' | 'document';

export interface PronunciationPlanResponse {
  normal_prompt: string;
  slow_prompt: string;
  practice_steps: string[];
  common_mistakes: string[];
}

export interface TranslationLearningPlanRequest {
  content: string;
  source_language: string;
  target_language: string;
  selection_type?: TranslationSelectionType | null;
  store_for_review?: boolean;
}

export interface TranslationLearningPlanResponse {
  selection_type: TranslationSelectionType;
  detected_script: string;
  skill_focus: string[];
  teaching_sequence: string[];
  pronunciation: PronunciationPlanResponse;
  vocabulary_targets: string[];
  grammar_targets: string[];
  practice_prompts: string[];
  storage_notice: string;
}

export type AnalysisTab = 'translation' | 'word' | 'sentence' | 'learning' | 'history' | 'bookmarks';

export interface VisualScriptItem {
  type: 'circle' | 'rect' | 'line' | 'text' | 'label';
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  r?: number;
  pulse?: boolean;
  color?: string;
  label?: string;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  dx1?: number;
  dy1?: number;
  dx2?: number;
  dy2?: number;
  width?: number;
  text?: string;
}

export interface LearningProgress {
  user_id: string;
  language_pair: string;
  words_learned: number;
  words_mastered: number;
  current_streak: number;
  longest_streak: number;
  total_study_time_minutes: number;
  last_study_date?: string;
  weak_areas: string[];
  strong_areas: string[];
  weekly_goal: number;
  weekly_progress: number;
}

export interface DailyLessonPlan {
  plan_id: string;
  date: string;
  estimated_duration_minutes: number;
  lessons: LessonActivity[];
  vocabulary_review: string[];
  grammar_focus: string[];
  speaking_practice: string[];
  listening_practice: string[];
  cultural_notes: string[];
}

export interface LessonActivity {
  id: string;
  type: 'vocabulary' | 'grammar' | 'pronunciation' | 'listening' | 'speaking' | 'reading' | 'writing' | 'practice';
  title: string;
  description: string;
  content: string;
  estimated_minutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  interactive: boolean;
  completed: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'tutor';
  content: string;
  translation?: string;
  corrections?: string[];
  pronunciation_score?: number;
  fluency_score?: number;
  timestamp: string;
}

export interface ConversationPracticeResponse {
  conversation_id: string;
  turns: ConversationTurn[];
  feedback: ConversationFeedback;
  vocabulary_used: string[];
  grammar_corrections: string[];
  pronunciation_tips: string[];
  next_suggested_topics: string[];
}

export interface ConversationFeedback {
  overall_score: number;
  fluency_score: number;
  accuracy_score: number;
  vocabulary_score: number;
  pronunciation_score: number;
  strengths: string[];
  weaknesses: string[];
  improvement_plan: string[];
}

export type TranslationMode = 'text' | 'sentence' | 'paragraph' | 'document' | 'conversation' | 'voice' | 'image' | 'camera' | 'pdf' | 'clipboard' | 'website' | 'screen' | 'ocr';

export interface TranslationRequest {
  text: string;
  source_language: string;
  target_language: string;
  mode?: TranslationMode;
  tone?: TranslationTone;
  preserve_formatting?: boolean;
  context?: string;
  user_id?: string;
}

export interface TranslationResult {
  id: string;
  original_content: string;
  translated_content: string;
  source_language: string;
  detected_source_language: string;
  target_language: string;
  tone: TranslationTone;
  transliteration?: string;
  alternatives: string[];
  notes: string[];
  confidence_score: number;
  time_taken_seconds: number;
  character_count: number;
  word_count: number;
  created_at: string;
  mode: TranslationMode;
  context?: string;
}

export interface StreamingTranslationResult {
  chunk: string;
  is_final: boolean;
  confidence?: number;
  alternatives?: string[];
}

export type WordDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type LearningStatus = 'new' | 'learning' | 'review' | 'mastered';

export type LanguageSkillFocus = 'vocabulary' | 'grammar' | 'pronunciation' | 'reading' | 'writing' | 'listening' | 'speaking' | 'comprehensive';

export interface PracticeExercise {
  id: string;
  type: 'fill_blank' | 'matching' | 'translation' | 'listening' | 'speaking' | 'writing';
  instruction: string;
  content: string;
  answer: string;
  hints: string[];
  difficulty: WordDifficulty;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  is_public: boolean;
  max_members: number;
  owner_id: string;
  settings: Record<string, unknown>;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudyGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string | null;
  role: string;
  xp_contributed: number;
  joined_at: string;
}

export interface GroupDiscussion {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string | null;
  content: string;
  parent_id: string | null;
  is_pinned: boolean;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  replies: GroupDiscussion[];
}

export interface SharedNote {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string | null;
  title: string;
  content: string;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  subject: string | null;
  difficulty: string;
  status: string;
  milestones: Record<string, unknown>[];
  progress: number;
  career_goal: string | null;
  feedback: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  item_type: string;
  tags: string[];
  media_urls: string[];
  is_public: boolean;
  certificate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  title: string;
  issuer: string;
  issue_date: string;
  expiry_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
  skills: string[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  reminder_minutes: number;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  name: string;
  description: string;
  icon: string | null;
  unlocked_at: string;
}

export interface InterviewSession {
  id: string;
  interview_type: string;
  role: string;
  questions: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  feedback: Record<string, unknown>;
  score: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodingSession {
  id: string;
  language: string;
  problem: string;
  code: string;
  output: string | null;
  errors: Record<string, unknown>[];
  hints_used: number;
  completed: boolean;
  execution_time: number | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProgress {
  user_id: string;
  full_name: string;
  xp: number;
  level: number;
  streak: number;
  accuracy: number;
  topics_completed: string[];
  weak_topics: string[];
  strong_topics: string[];
  badges: Badge[];
  last_active_date: string | null;
  total_study_time_minutes: number;
  lessons_completed: number;
}

export interface PlatformActivity {
  active_today: number;
  active_this_week: number;
  active_this_month: number;
  total_logins: number;
  conversations_today: number;
  messages_today: number;
  lessons_completed_today: number;
  quizzes_taken_today: number;
  new_signups_today: number;
  top_subjects: { subject: string; count: number }[];
}

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  role: string;
  xp: number;
  level: number;
  streak: number;
  created_at: string;
  last_active_date: string | null;
}

export interface ToggleUserActiveRequest {
  user_id: string;
  is_active: boolean;
}

export interface UpdateUserRoleRequest {
  user_id: string;
  role: string;
}

export interface StudyGroupCreate {
  name: string;
  description?: string | null;
  subject?: string | null;
  is_public?: boolean;
  max_members?: number;
  settings?: Record<string, unknown>;
}

export interface StudyGroupResponse {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  is_public: boolean;
  max_members: number;
  owner_id: string;
  settings: Record<string, unknown>;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudyGroupMemberResponse {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string | null;
  role: string;
  xp_contributed: number;
  joined_at: string;
}

export interface GroupDiscussionCreate {
  content: string;
  parent_id?: string | null;
}

export interface GroupDiscussionResponse {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string | null;
  content: string;
  parent_id: string | null;
  is_pinned: boolean;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  replies: GroupDiscussion[];
}

export interface SharedNoteCreate {
  title: string;
  content: string;
  tags?: string[];
}

export interface SharedNoteResponse {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string | null;
  title: string;
  content: string;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  title: string;
  description: string;
  subject?: string | null;
  difficulty?: string;
  career_goal?: string | null;
  milestones?: Record<string, unknown>[];
}

export interface ProjectResponse {
  id: string;
  user_id: string;
  title: string;
  description: string;
  subject: string | null;
  difficulty: string;
  status: string;
  milestones: Record<string, unknown>[];
  progress: number;
  career_goal: string | null;
  feedback: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItemCreate {
  title: string;
  description: string;
  item_type?: string;
  tags?: string[];
  media_urls?: string[];
  is_public?: boolean;
}

export interface PortfolioItemResponse {
  id: string;
  user_id: string;
  title: string;
  description: string;
  item_type: string;
  tags: string[];
  media_urls: string[];
  is_public: boolean;
  certificate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface CalendarEventCreate {
  title: string;
  description?: string | null;
  event_type?: string;
  start_time: string;
  end_time: string;
  reminder_minutes?: number;
  related_type?: string | null;
  related_id?: string | null;
}

export interface CalendarEventResponse {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  reminder_minutes: number;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BadgeResponse {
  id: string;
  badge_id: string;
  name: string;
  description: string;
  icon: string | null;
  unlocked_at: string;
}

export interface RoleUpdateRequest {
  role: string;
}

export interface InterviewSessionCreate {
  interview_type: string;
  role: string;
}

export interface InterviewSessionResponse {
  id: string;
  interview_type: string;
  role: string;
  questions: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  feedback: Record<string, unknown>;
  score: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodingSessionCreate {
  language: string;
  problem: string;
}

export interface CodingSessionResponse {
  id: string;
  language: string;
  problem: string;
  code: string;
  output: string | null;
  errors: Record<string, unknown>[];
  hints_used: number;
  completed: boolean;
  execution_time: number | null;
  created_at: string;
  updated_at: string;
}

export interface WhiteboardCreate {
  title: string;
  group_id?: string | null;
  elements: Record<string, unknown>[];
  is_public?: boolean;
}

export interface WhiteboardResponse {
  id: string;
  group_id: string | null;
  user_id: string;
  title: string;
  elements: Record<string, unknown>[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForumPostCreate {
  title: string;
  content: string;
  topic?: string | null;
  tags?: string[];
}

export interface ForumPostResponse {
  id: string;
  user_id: string;
  user_name: string | null;
  title: string;
  content: string;
  topic: string | null;
  tags: string[];
  views: number;
  upvotes: number;
  is_resolved: boolean;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface ForumCommentCreate {
  content: string;
  parent_id?: string | null;
}

export interface ForumCommentResponse {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string | null;
  content: string;
  parent_id: string | null;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrivacySettingsResponse {
  id: string;
  profile_visibility: string;
  show_xp: boolean;
  show_badges: boolean;
  show_progress: boolean;
  allow_study_group_invites: boolean;
  allow_mentor_messages: boolean;
  data_sharing: string;
  allow_analytics: boolean;
}
