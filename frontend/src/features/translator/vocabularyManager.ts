// AI Vocabulary Builder with spaced repetition and memory.

import type {
  VocabularyItemResponse,
  FlashcardResponse,
  WordAnalysisDetail,
  LearningProgress,
  WordDifficulty,
  LearningStatus,
  LanguageOption,
} from '../../lib/types';

export interface VocabularyManagerOptions {
  user_id?: string;
  daily_review_limit?: number;
  new_cards_per_day?: number;
  lembret_interval?: number;
}

export interface StudySession {
  session_id: string;
  start_time: string;
  cards_due: number;
  cards_new: number;
  cards_learning: number;
  cards_review: number;
  estimated_duration_minutes: number;
}

export interface ReviewResult {
  card_id: string;
  quality: 'again' | 'hard' | 'good' | 'easy';
  time_taken_ms: number;
  attempts: number;
}

export class VocabularyManager {
  private options: VocabularyManagerOptions;
  private vocabulary: VocabularyItemResponse[] = [];
  private flashcards: FlashcardResponse[] = [];
  private reviewQueue: FlashcardResponse[] = [];
  private currentSession: StudySession | null = null;

  constructor(options: VocabularyManagerOptions = {}) {
    this.options = {
      daily_review_limit: 50,
      new_cards_per_day: 10,
      lembret_interval: 1,
      ...options,
    };
    this.loadFromStorage();
  }

  async loadVocabulary(sourceLanguage: string, targetLanguage: string): Promise<VocabularyItemResponse[]> {
    const response = await fetch(`/api/v1/translation/vocabulary?source_language=${sourceLanguage}&target_language=${targetLanguage}`);
    if (!response.ok) {
      throw new Error('Failed to load vocabulary');
    }
    this.vocabulary = await response.json();
    this.saveToStorage();
    return this.vocabulary;
  }

  async saveWord(word: string, translation: string, sourceLanguage: string, targetLanguage: string, context?: string): Promise<VocabularyItemResponse> {
    const response = await fetch('/api/v1/translation/vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word,
        translation,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        context: context || '',
        user_id: this.options.user_id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save word');
    }

    const item = await response.json();
    this.vocabulary.push(item);
    this.saveToStorage();
    return item;
  }

  async saveFromAnalysis(analysis: WordAnalysisDetail, sourceLanguage: string, targetLanguage: string): Promise<VocabularyItemResponse> {
    return this.saveWord(
      analysis.original,
      analysis.translation,
      sourceLanguage,
      targetLanguage,
      `${analysis.part_of_speech}: ${analysis.meaning}`
    );
  }

  async removeWord(wordId: string): Promise<void> {
    const response = await fetch(`/api/v1/translation/vocabulary/${wordId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to remove word');
    }

    this.vocabulary = this.vocabulary.filter((v) => v.id !== wordId);
    this.saveToStorage();
  }

  async generateFlashcards(text: string, sourceLanguage: string, targetLanguage: string, count: number = 10): Promise<FlashcardResponse[]> {
    const response = await fetch('/api/v1/translation/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        count,
        user_id: this.options.user_id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate flashcards');
    }

    const data = await response.json();
    this.flashcards = data.flashcards || data;
    this.saveToStorage();
    return this.flashcards;
  }

  async reviewCard(cardId: string, quality: 'again' | 'hard' | 'good' | 'easy', timeTakenMs: number): Promise<ReviewResult> {
    const card = this.flashcards.find((c) => c.id === cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const intervals: Record<string, number> = {
      again: 0,
      hard: 1,
      good: 3,
      easy: 7,
    };

    const easeFactors: Record<string, number> = {
      again: 1.3,
      hard: 2.5,
      good: 2.5,
      easy: 3.0,
    };

    const newInterval = intervals[quality];
    const newEaseFactor = easeFactors[quality];

    card.review_count += 1;
    card.last_reviewed = new Date().toISOString();
    card.next_review = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000).toISOString();

    const result: ReviewResult = {
      card_id: cardId,
      quality,
      time_taken_ms: timeTakenMs,
      attempts: 1,
    };

    this.saveToStorage();

    const vocabItem = this.vocabulary.find((v) => v.word === card.front);
    if (vocabItem) {
      vocabItem.repetitions += 1;
      vocabItem.interval_days = newInterval;
      vocabItem.ease_factor = newEaseFactor;
      vocabItem.last_reviewed = card.last_reviewed;
      vocabItem.next_review = card.next_review;
      vocabItem.mastery_level = this.updateMasteryLevel(vocabItem.mastery_level, quality);
      this.saveToStorage();
    }

    return result;
  }

  startStudySession(): StudySession {
    this.reviewQueue = this.getDueCards();
    this.currentSession = {
      session_id: `session_${Date.now()}`,
      start_time: new Date().toISOString(),
      cards_due: this.reviewQueue.length,
      cards_new: this.reviewQueue.filter((c) => c.review_count === 0).length,
      cards_learning: this.reviewQueue.filter((c) => c.review_count > 0 && c.review_count < 3).length,
      cards_review: this.reviewQueue.filter((c) => c.review_count >= 3).length,
      estimated_duration_minutes: Math.ceil(this.reviewQueue.length * 0.5),
    };
    return this.currentSession;
  }

  getCurrentSession(): StudySession | null {
    return this.currentSession;
  }

  getNextCard(): FlashcardResponse | null {
    if (this.reviewQueue.length === 0) {
      return null;
    }
    return this.reviewQueue.shift() || null;
  }

  getDueCards(): FlashcardResponse[] {
    const now = new Date();
    return this.flashcards
      .filter((card) => new Date(card.next_review) <= now)
      .sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime());
  }

  getNewCards(limit: number = this.options.new_cards_per_day || 10): FlashcardResponse[] {
    return this.flashcards.filter((c) => c.review_count === 0).slice(0, limit);
  }

  getVocabularyByStatus(status: LearningStatus): VocabularyItemResponse[] {
    return this.vocabulary.filter((v) => v.mastery_level === status);
  }

  getWeakVocabulary(): VocabularyItemResponse[] {
    return this.vocabulary
      .filter((v) => v.mastery_level === 'new' || v.mastery_level === 'learning')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  getStrongVocabulary(): VocabularyItemResponse[] {
    return this.vocabulary.filter((v) => v.mastery_level === 'mastered');
  }

  getDailyReviewList(): FlashcardResponse[] {
    const dueCards = this.getDueCards();
    const newCards = this.getNewCards(this.options.new_cards_per_day || 10);
    return [...dueCards, ...newCards].slice(0, this.options.daily_review_limit || 50);
  }

  async generateWeeklyReview(): Promise<{ date: string; cards_due: number; words_to_review: string[] }> {
    const dueCards = this.getDueCards();
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const upcomingDue = this.flashcards.filter((c) => {
      const nextReview = new Date(c.next_review);
      return nextReview <= weekFromNow;
    });

    return {
      date: weekFromNow.toISOString().split('T')[0],
      cards_due: upcomingDue.length,
      words_to_review: upcomingDue.map((c) => c.front),
    };
  }

  getVocabulary(): VocabularyItemResponse[] {
    return [...this.vocabulary];
  }

  getFlashcards(): FlashcardResponse[] {
    return [...this.flashcards];
  }

  private updateMasteryLevel(current: LearningStatus, quality: 'again' | 'hard' | 'good' | 'easy'): LearningStatus {
    if (quality === 'again') return 'learning';
    if (quality === 'hard') return current === 'mastered' ? 'review' : 'learning';
    if (quality === 'good') {
      if (current === 'new') return 'learning';
      if (current === 'learning') return 'review';
      return 'mastered';
    }
    if (quality === 'easy') return 'mastered';
    return current;
  }

  private loadFromStorage(): void {
    try {
      const vocab = localStorage.getItem('smarter_vocabulary');
      const cards = localStorage.getItem('smarter_flashcards');
      if (vocab) this.vocabulary = JSON.parse(vocab);
      if (cards) this.flashcards = JSON.parse(cards);
    } catch {
      // ignore parse errors
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('smarter_vocabulary', JSON.stringify(this.vocabulary));
      localStorage.setItem('smarter_flashcards', JSON.stringify(this.flashcards));
    } catch {
      // ignore storage errors
    }
  }
}

export const vocabularyManager = new VocabularyManager();
