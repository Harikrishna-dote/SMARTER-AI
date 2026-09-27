// AI Language Tutor - provides conversation practice, grammar lessons, and personalized learning.

import type {
  LanguageOption,
  WordAnalysisDetail,
  SentenceAnalysisDetail,
  LearningProgress,
  PracticeExercise,
  TranslationLearningPlanResponse,
  LanguageSkillFocus,
  TranslationRequest,
} from '../../lib/types';

export interface LanguageTutorOptions {
  user_id?: string;
  native_language?: string;
  target_language?: string;
  proficiency_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  daily_goal_minutes?: number;
  interests?: string[];
}

export interface ConversationPracticeRequest {
  topic: string;
  scenario: string;
  target_language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  focus_skills: LanguageSkillFocus[];
  max_turns?: number;
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

export interface ConversationTurn {
  role: 'user' | 'tutor';
  content: string;
  translation?: string;
  corrections?: string[];
  pronunciation_score?: number;
  fluency_score?: number;
  timestamp: string;
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

export interface WeeklyLearningPlan {
  week_number: number;
  start_date: string;
  end_date: string;
  theme: string;
  daily_plans: DailyLessonPlan[];
  weekly_goal: string;
  assessment: string;
  prerequisites: string[];
}

export class LanguageTutor {
  private options: LanguageTutorOptions;

  constructor(options: LanguageTutorOptions = {}) {
    this.options = {
      proficiency_level: 'beginner',
      daily_goal_minutes: 15,
      interests: [],
      ...options,
    };
  }

  async generateDailyLesson(
    targetLanguage: string,
    level: 'beginner' | 'intermediate' | 'advanced' = 'beginner'
  ): Promise<DailyLessonPlan> {
    const response = await fetch('/api/language-tutor/daily-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_language: targetLanguage,
        proficiency_level: level,
        user_id: this.options.user_id,
        daily_goal_minutes: this.options.daily_goal_minutes,
        interests: this.options.interests,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate daily lesson');
    }

    return response.json();
  }

  async startConversationPractice(request: ConversationPracticeRequest): Promise<ConversationPracticeResponse> {
    const response = await fetch('/api/language-tutor/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        user_id: this.options.user_id,
        native_language: this.options.native_language,
        proficiency_level: this.options.proficiency_level,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start conversation practice');
    }

    return response.json();
  }

  async continueConversation(conversationId: string, userMessage: string): Promise<ConversationTurn> {
    const response = await fetch(`/api/language-tutor/conversation/${conversationId}/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        user_id: this.options.user_id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to continue conversation');
    }

    return response.json();
  }

  async analyzePronunciation(
    audio: Blob,
    expectedText: string,
    language: string
  ): Promise<PronunciationAnalysis> {
    const formData = new FormData();
    formData.append('audio', audio);
    formData.append('expected_text', expectedText);
    formData.append('language', language);

    const response = await fetch('/api/language-tutor/pronunciation', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Pronunciation analysis failed');
    }

    return response.json();
  }

  async generateLearningPlan(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    skillFocus: LanguageSkillFocus
  ): Promise<TranslationLearningPlanResponse> {
    const response = await fetch('/api/v1/translation/learning-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        selection_type: 'paragraph',
        skill_focus: skillFocus,
        user_level: this.options.proficiency_level,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate learning plan');
    }

    return response.json();
  }

  async getProgress(languagePair: string): Promise<LearningProgress> {
    const response = await fetch(`/api/language-tutor/progress?languagePair=${encodeURIComponent(languagePair)}&user_id=${this.options.user_id}`);

    if (!response.ok) {
      throw new Error('Failed to get progress');
    }

    return response.json();
  }

  async updateProgress(languagePair: string, updates: Partial<LearningProgress>): Promise<LearningProgress> {
    const response = await fetch('/api/language-tutor/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        languagePair,
        updates,
        user_id: this.options.user_id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update progress');
    }

    return response.json();
  }
}

export interface PronunciationAnalysis {
  text: string;
  phonemes: string[];
  accuracy_score: number;
  fluency_score: number;
  overall_score: number;
  mispronounced_words: MispronouncedWord[];
  tips: string[];
  audio_comparison_url?: string;
}

export interface MispronouncedWord {
  word: string;
  expected_pronunciation: string;
  actual_pronunciation: string;
  phoneme_difference: string[];
  severity: 'minor' | 'moderate' | 'major';
  practice_tip: string;
}

export const languageTutor = new LanguageTutor();
