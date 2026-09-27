// Client-side translation engine with streaming, caching, and history.

import {
  TranslationRequest,
  TranslationResult,
  StreamingTranslationResult,
  TranslationMode,
  TranslationTone,
  LanguageOption,
} from '../../lib/types';
import { authHeaders } from '../../lib/api';

const CACHE_KEY = 'smarter_translation_cache';
const HISTORY_KEY = 'smarter_translation_history';
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24;
const MAX_HISTORY_ITEMS = 500;

export interface TranslationEngineOptions {
  user_id?: string;
  default_source_language?: string;
  default_target_language?: string;
  default_tone?: TranslationTone;
  auto_detect_language?: boolean;
  stream_responses?: boolean;
}

export class TranslationEngine {
  private options: TranslationEngineOptions;
  private cache: Map<string, { result: TranslationResult; timestamp: number }> = new Map();
  private history: TranslationResult[] = [];
  private abortController: AbortController | null = null;
  private streamingCallbacks: Array<(result: StreamingTranslationResult) => void> = [];

  constructor(options: TranslationEngineOptions = {}) {
    this.options = {
      default_source_language: 'auto',
      default_target_language: 'en',
      default_tone: 'natural',
      auto_detect_language: true,
      stream_responses: false,
      ...options,
    };
    this.loadCache();
    this.loadHistory();
  }

  getDefaultSourceLanguage(): string {
    return this.options.default_source_language || 'auto';
  }

  getDefaultTargetLanguage(): string {
    return this.options.default_target_language || 'en';
  }

  getDefaultTone(): TranslationTone {
    return this.options.default_tone || 'natural';
  }

  isAutoDetectEnabled(): boolean {
    return this.options.auto_detect_language ?? true;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const cacheKey = this.buildCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MAX_CACHE_AGE_MS) {
      return cached.result;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const result = await this.performTranslation(request);
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      this.addToHistory(result);
      this.persistCache();
      this.persistHistory();
      return result;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Translation was cancelled');
      }
      throw error;
    }
  }

  async *translateStream(
    request: TranslationRequest
  ): AsyncGenerator<StreamingTranslationResult> {
    const cacheKey = this.buildCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MAX_CACHE_AGE_MS) {
      yield {
        chunk: cached.result.translated_content,
        is_final: true,
        confidence: cached.result.confidence_score,
        alternatives: cached.result.alternatives,
      };
      return;
    }

    const words = request.text.split(/(\s+)/);
    let accumulated = '';
    for (const word of words) {
      if (this.abortController?.signal.aborted) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
      accumulated += word;
      yield {
        chunk: accumulated,
        is_final: false,
      };
    }

    const result = await this.translate(request);
    yield {
      chunk: result.translated_content,
      is_final: true,
      confidence: result.confidence_score,
      alternatives: result.alternatives,
    };
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  getHistory(): TranslationResult[] {
    return [...this.history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  clearHistory(): void {
    this.history = [];
    this.persistHistory();
  }

  addBookmark(result: TranslationResult): void {
    const bookmarks = this.getBookmarks();
    bookmarks.push({
      ...result,
      id: result.id || `bm_${Date.now()}`,
    });
    localStorage.setItem('smarter_translation_bookmarks', JSON.stringify(bookmarks));
  }

  getBookmarks(): TranslationResult[] {
    try {
      return JSON.parse(localStorage.getItem('smarter_translation_bookmarks') || '[]');
    } catch {
      return [];
    }
  }

  removeBookmark(id: string): void {
    const bookmarks = this.getBookmarks().filter((b) => b.id !== id);
    localStorage.setItem('smarter_translation_bookmarks', JSON.stringify(bookmarks));
  }

  addFavorite(result: TranslationResult): void {
    const favorites = this.getFavorites();
    favorites.push({
      ...result,
      id: result.id || `fav_${Date.now()}`,
    });
    localStorage.setItem('smarter_translation_favorites', JSON.stringify(favorites));
  }

  getFavorites(): TranslationResult[] {
    try {
      return JSON.parse(localStorage.getItem('smarter_translation_favorites') || '[]');
    } catch {
      return [];
    }
  }

  removeFavorite(id: string): void {
    const favorites = this.getFavorites().filter((f) => f.id !== id);
    localStorage.setItem('smarter_translation_favorites', JSON.stringify(favorites));
  }

  onStreamingUpdate(callback: (result: StreamingTranslationResult) => void): () => void {
    this.streamingCallbacks.push(callback);
    return () => {
      this.streamingCallbacks = this.streamingCallbacks.filter((cb) => cb !== callback);
    };
  }

  private async performTranslation(request: TranslationRequest): Promise<TranslationResult> {
    const response = await fetch('/api/v1/translation/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        content: request.text,
        source_language: request.source_language,
        target_language: request.target_language,
        mode: request.mode || 'text',
        tone: request.tone || this.options.default_tone,
        preserve_formatting: request.preserve_formatting ?? true,
        context: request.context,
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Translation failed' }));
      throw new Error(error.detail || 'Translation failed');
    }

    const data = await response.json();
    return this.normalizeResult(data, request);
  }

  private normalizeResult(data: unknown, request: TranslationRequest): TranslationResult {
    const result = data as Record<string, unknown>;
    return {
      id: (result.id as string) || `tr_${Date.now()}`,
      original_content: request.text,
      translated_content: (result.translated_content as string) || (result.translation as string) || '',
      source_language: request.source_language,
      detected_source_language: (result.detected_source_language as string) || request.source_language,
      target_language: request.target_language,
      tone: request.tone || this.options.default_tone || 'natural',
      transliteration: (result.transliteration as string) || '',
      alternatives: (result.alternatives as string[]) || [],
      notes: (result.notes as string[]) || [],
      confidence_score: (result.confidence_score as number) || 0.9,
      time_taken_seconds: (result.time_taken_seconds as number) || 0,
      character_count: request.text.length,
      word_count: request.text.split(/\s+/).filter(Boolean).length,
      created_at: new Date().toISOString(),
      mode: request.mode || 'text',
      context: request.context,
    };
  }

  private buildCacheKey(request: TranslationRequest): string {
    return `${request.source_language}:${request.target_language}:${request.mode || 'text'}:${request.tone || 'natural'}:${request.text}`;
  }

  private addToHistory(result: TranslationResult): void {
    this.history.unshift(result);
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }
  }

  private loadCache(): void {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Map<string, { result: TranslationResult; timestamp: number }>;
        this.cache = new Map(Object.entries(parsed));
      }
    } catch {
      // ignore parse errors
    }
  }

  private persistCache(): void {
    try {
      const obj = Object.fromEntries(this.cache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {
      // ignore storage errors
    }
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch {
      // ignore parse errors
    }
  }

  private persistHistory(): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // ignore storage errors
    }
  }
}

export const translationEngine = new TranslationEngine();
