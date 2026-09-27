// React hook for the AI Language Learning Platform.

import { useCallback, useEffect, useRef, useState } from 'react';
import { translationEngine } from './translationEngine';
import { ocrEngine } from './ocrEngine';
import { languageTutor } from './languageTutor';
import { vocabularyManager } from './vocabularyManager';
import type {
  TranslationResult,
  TranslationRequest,
  OCRResponse,
  WordAnalysisDetail,
  SentenceAnalysisDetail,
  VocabularyItemResponse,
  FlashcardResponse,
  LearningProgress,
  ConversationPracticeResponse,
  ConversationTurn,
  DailyLessonPlan,
  LanguageOption,
  TranslationMode,
  TranslationTone,
} from '../../lib/types';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/useToast';

export interface UseTranslatorOptions {
  user_id?: string;
  default_source_language?: string;
  default_target_language?: string;
  auto_detect?: boolean;
  stream?: boolean;
}

export interface UseTranslatorReturn {
  languages: LanguageOption[];
  setLanguages: (languages: LanguageOption[]) => void;
  sourceLanguage: string;
  setSourceLanguage: (lang: string) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
  result: TranslationResult | null;
  setResult: (result: TranslationResult | null) => void;
  translating: boolean;
  sourceText: string;
  setSourceText: (text: string) => void;
  translate: (text?: string) => Promise<void>;
  cancelTranslation: () => void;
  swapLanguages: () => void;
  speakText: (text: string, language: string) => void;
  copyText: (text: string) => Promise<void>;
  clearResult: () => void;

  wordAnalysis: WordAnalysisDetail | null;
  setWordAnalysis: (analysis: WordAnalysisDetail | null) => void;
  analyzeWord: (word: string) => Promise<void>;
  sentenceAnalysis: SentenceAnalysisDetail | null;
  setSentenceAnalysis: (analysis: SentenceAnalysisDetail | null) => void;
  analyzeSentence: (sentence: string) => Promise<void>;

  ocrResult: OCRResponse | null;
  setOcrResult: (result: OCRResponse | null) => void;
  processingOCR: boolean;
  processImageOCR: (file: File) => Promise<void>;
  processCameraOCR: (imageData: ImageData | Blob) => Promise<void>;
  processPDFOCR: (file: File) => Promise<void>;
  cancelOCR: () => void;

  vocabulary: VocabularyItemResponse[];
  loadVocabulary: (source: string, target: string) => Promise<void>;
  saveWord: (word: string, translation: string, source: string, target: string, context?: string) => Promise<void>;
  removeWord: (wordId: string) => Promise<void>;
  isWordSaved: (word: string) => boolean;

  flashcards: FlashcardResponse[];
  generateFlashcards: (text: string, source: string, target: string, count?: number) => Promise<void>;
  reviewCard: (cardId: string, quality: 'again' | 'hard' | 'good' | 'easy', timeMs: number) => Promise<void>;
  studySession: { session_id: string; cards_due: number; estimated_duration_minutes: number } | null;
  startStudySession: () => { session_id: string; cards_due: number };
  getNextCard: () => FlashcardResponse | null;

  history: TranslationResult[];
  loadHistory: () => void;
  clearHistory: () => void;
  bookmarks: TranslationResult[];
  addBookmark: (result: TranslationResult) => void;
  removeBookmark: (id: string) => void;
  favorites: TranslationResult[];
  addFavorite: (result: TranslationResult) => void;
  removeFavorite: (id: string) => void;

  dailyLesson: DailyLessonPlan | null;
  generateDailyLesson: (targetLanguage: string, level?: 'beginner' | 'intermediate' | 'advanced') => Promise<void>;
  conversationPractice: ConversationPracticeResponse | null;
  startConversationPractice: (topic: string, scenario: string, targetLanguage: string) => Promise<void>;
  conversationTurns: ConversationTurn[];
  continueConversation: (conversationId: string, message: string) => Promise<void>;

  progress: LearningProgress | null;
  loadProgress: (languagePair: string) => Promise<void>;

  inputMode: TranslationMode;
  setInputMode: (mode: TranslationMode) => void;
  tone: TranslationTone;
  setTone: (tone: TranslationTone) => void;
}

export function useTranslator(options: UseTranslatorOptions = {}): UseTranslatorReturn {
  const { toast } = useToast();

  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState(options.default_source_language || 'auto');
  const [targetLanguage, setTargetLanguage] = useState(options.default_target_language || 'te');
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [translating, setTranslating] = useState(false);
  const [inputMode, setInputMode] = useState<TranslationMode>('text');
  const [tone, setTone] = useState<TranslationTone>('natural');

  const [wordAnalysis, setWordAnalysis] = useState<WordAnalysisDetail | null>(null);
  const [sentenceAnalysis, setSentenceAnalysis] = useState<SentenceAnalysisDetail | null>(null);

  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [processingOCR, setProcessingOCR] = useState(false);

  const [vocabulary, setVocabulary] = useState<VocabularyItemResponse[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardResponse[]>([]);
  const [studySession, setStudySession] = useState<{ session_id: string; cards_due: number; estimated_duration_minutes: number } | null>(null);

  const [history, setHistory] = useState<TranslationResult[]>([]);
  const [bookmarks, setBookmarks] = useState<TranslationResult[]>([]);
  const [favorites, setFavorites] = useState<TranslationResult[]>([]);

  const [dailyLesson, setDailyLesson] = useState<DailyLessonPlan | null>(null);
  const [conversationPractice, setConversationPractice] = useState<ConversationPracticeResponse | null>(null);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);

  const [progress, setProgress] = useState<LearningProgress | null>(null);

  useEffect(() => {
    let active = true;
    api
      .translationLanguages()
      .then((options) => {
        if (!active) return;
        setLanguages(options);
      })
      .catch(() => {
        if (!active) return;
        toast({ title: 'Could not load languages', variant: 'error' });
      });
    return () => { active = false; };
  }, [toast]);

  useEffect(() => {
    setHistory(translationEngine.getHistory());
    setBookmarks(translationEngine.getBookmarks());
    setFavorites(translationEngine.getFavorites());
    setFlashcards(vocabularyManager.getFlashcards());
  }, []);

  const translate = useCallback(async (text?: string) => {
    const textToTranslate = text || sourceText;
    if (!textToTranslate.trim() || translating) return;

    setTranslating(true);
    setWordAnalysis(null);
    setSentenceAnalysis(null);

    try {
      console.log('Sending translation request:', { text: textToTranslate, source: sourceLanguage, target: targetLanguage });
      const response = await translationEngine.translate({
        text: textToTranslate,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        mode: inputMode,
        tone,
      });
      console.log('Received translation response:', response);
      setResult(response);
      setHistory(translationEngine.getHistory());

      if (sourceLanguage === 'auto' || sourceLanguage === 'en') {
        const firstWord = textToTranslate.trim().split(/\s+/)[0];
        if (firstWord && !firstWord.includes(' ')) {
          void analyzeWord(firstWord);
        }
      }
    } catch (error) {
      toast({
        title: 'Translation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setTranslating(false);
    }
  }, [sourceText, sourceLanguage, targetLanguage, translating, inputMode, tone, toast]);

  const cancelTranslation = useCallback(() => {
    translationEngine.cancel();
    setTranslating(false);
  }, []);

  const swapLanguages = useCallback(() => {
    if (sourceLanguage === 'auto') return;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    if (result) {
      setSourceText(result.translated_content);
    }
  }, [sourceLanguage, targetLanguage, result]);

  const speakText = useCallback((text: string, language: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard', variant: 'success' });
    } catch {
      toast({ title: 'Failed to copy', variant: 'error' });
    }
  }, [toast]);

  const clearResult = useCallback(() => {
    setResult(null);
    setWordAnalysis(null);
    setSentenceAnalysis(null);
  }, []);

  const analyzeWord = useCallback(async (word: string) => {
    try {
      const res = await api.explainTranslation({
        content: word,
        source_language: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
        target_language: targetLanguage,
        focus: 'vocabulary',
      });
      setWordAnalysis({
        original: word,
        pronunciation: word,
        ipa: '',
        meaning: res.translation || word,
        translation: res.translation || word,
        part_of_speech: 'unknown',
        root_word: word,
        synonyms: [],
        antonyms: [],
        examples: res.real_life_usage || [],
        usage: res.vocabulary_notes?.join(' ') || '',
        difficulty: 'intermediate',
        frequency: 'unknown',
        frequency_rank: undefined,
        related_words: [],
        word_origin: '',
        formal_usage: '',
        informal_usage: '',
        memory_tips: res.why_correct || [],
        common_mistakes: res.common_mistakes || [],
      });
    } catch (error) {
      toast({
        title: 'Word analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [sourceLanguage, targetLanguage, toast]);

  const analyzeSentence = useCallback(async (sentence: string) => {
    try {
      const res = await api.explainTranslation({
        content: sentence,
        source_language: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
        target_language: targetLanguage,
        focus: 'grammar',
      });
      setSentenceAnalysis({
        original: sentence,
        translation: res.translation || sentence,
        word_by_word: [],
        grammar: res.grammar_rules || [],
        grammar_notes: res.grammar_rules || [],
        meaning: res.translation || sentence,
        overall_meaning: res.translation || sentence,
        context: '',
        alternatives: res.better_alternatives || [],
        formal_version: sentence,
        informal_version: sentence,
        natural_version: res.translation || sentence,
        professional_version: sentence,
        simple_version: sentence,
        spoken_version: sentence,
        literal_translation: res.translation || sentence,
        contextual_translation: res.translation || sentence,
        sentence_structure: '',
        similar_sentences: [],
      });
    } catch (error) {
      toast({
        title: 'Sentence analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [sourceLanguage, targetLanguage, toast]);

  const processImageOCR = useCallback(async (file: File) => {
    setProcessingOCR(true);
    try {
      const result = await ocrEngine.processImage(file);
      setOcrResult(result);
      setSourceText(result.text);
    } catch (error) {
      toast({
        title: 'OCR failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setProcessingOCR(false);
    }
  }, [toast]);

  const processCameraOCR = useCallback(async (imageData: ImageData | Blob) => {
    setProcessingOCR(true);
    try {
      const result = await ocrEngine.processCameraFrame(imageData);
      setOcrResult(result);
      setSourceText(result.text);
    } catch (error) {
      toast({
        title: 'Camera OCR failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setProcessingOCR(false);
    }
  }, [toast]);

  const processPDFOCR = useCallback(async (file: File) => {
    setProcessingOCR(true);
    try {
      const result = await ocrEngine.processPDF(file);
      setOcrResult(result);
      setSourceText(result.text);
    } catch (error) {
      toast({
        title: 'PDF OCR failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setProcessingOCR(false);
    }
  }, [toast]);

  const cancelOCR = useCallback(() => {
    ocrEngine.cancel();
    setProcessingOCR(false);
  }, []);

  const loadVocabulary = useCallback(async (source: string, target: string) => {
    try {
      const items = await vocabularyManager.loadVocabulary(source, target);
      setVocabulary(items);
    } catch (error) {
      toast({
        title: 'Failed to load vocabulary',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const saveWord = useCallback(async (word: string, translation: string, source: string, target: string, context?: string) => {
    try {
      await vocabularyManager.saveWord(word, translation, source, target, context);
      setVocabulary(vocabularyManager.getVocabulary());
      toast({ title: 'Word saved to vocabulary', variant: 'success' });
    } catch (error) {
      toast({
        title: 'Failed to save word',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const removeWord = useCallback(async (wordId: string) => {
    try {
      await vocabularyManager.removeWord(wordId);
      setVocabulary(vocabularyManager.getVocabulary());
    } catch (error) {
      toast({
        title: 'Failed to remove word',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const isWordSaved = useCallback((word: string): boolean => {
    return vocabularyManager.getVocabulary().some((v) => v.word.toLowerCase() === word.toLowerCase());
  }, [vocabulary]);

  const generateFlashcards = useCallback(async (text: string, source: string, target: string, count?: number) => {
    try {
      const cards = await vocabularyManager.generateFlashcards(text, source, target, count);
      setFlashcards(cards);
      toast({ title: `Generated ${cards.length} flashcards`, variant: 'success' });
    } catch (error) {
      toast({
        title: 'Failed to generate flashcards',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const reviewCard = useCallback(async (cardId: string, quality: 'again' | 'hard' | 'good' | 'easy', timeMs: number) => {
    try {
      await vocabularyManager.reviewCard(cardId, quality, timeMs);
      setFlashcards(vocabularyManager.getFlashcards());
    } catch (error) {
      toast({
        title: 'Failed to review card',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const startStudySession = useCallback(() => {
    const session = vocabularyManager.startStudySession();
    setStudySession(session);
    return session;
  }, []);

  const getNextCard = useCallback(() => {
    return vocabularyManager.getNextCard();
  }, []);

  const loadHistory = useCallback(() => {
    setHistory(translationEngine.getHistory());
  }, []);

  const clearHistory = useCallback(() => {
    translationEngine.clearHistory();
    setHistory([]);
  }, []);

  const addBookmark = useCallback((result: TranslationResult) => {
    translationEngine.addBookmark(result);
    setBookmarks(translationEngine.getBookmarks());
    toast({ title: 'Added to bookmarks', variant: 'success' });
  }, [toast]);

  const removeBookmark = useCallback((id: string) => {
    translationEngine.removeBookmark(id);
    setBookmarks(translationEngine.getBookmarks());
  }, []);

  const addFavorite = useCallback((result: TranslationResult) => {
    translationEngine.addFavorite(result);
    setFavorites(translationEngine.getFavorites());
    toast({ title: 'Added to favorites', variant: 'success' });
  }, [toast]);

  const removeFavorite = useCallback((id: string) => {
    translationEngine.removeFavorite(id);
    setFavorites(translationEngine.getFavorites());
  }, []);

  const generateDailyLesson = useCallback(async (targetLanguage: string, level?: 'beginner' | 'intermediate' | 'advanced') => {
    try {
      const lesson = await languageTutor.generateDailyLesson(targetLanguage, level);
      setDailyLesson(lesson);
    } catch (error) {
      toast({
        title: 'Failed to generate daily lesson',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const startConversationPractice = useCallback(async (topic: string, scenario: string, targetLanguage: string) => {
    try {
      const conversation = await languageTutor.startConversationPractice({
        topic,
        scenario,
        target_language: targetLanguage,
        difficulty: 'beginner',
        focus_skills: ['speaking', 'listening'],
      });
      setConversationPractice(conversation);
      setConversationTurns(conversation.turns);
    } catch (error) {
      toast({
        title: 'Failed to start conversation practice',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const continueConversation = useCallback(async (conversationId: string, message: string) => {
    try {
      const turn = await languageTutor.continueConversation(conversationId, message);
      setConversationTurns((prev) => [...prev, turn]);
    } catch (error) {
      toast({
        title: 'Failed to continue conversation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  }, [toast]);

  const loadProgress = useCallback(async (languagePair: string) => {
    try {
      const prog = await languageTutor.getProgress(languagePair);
      setProgress(prog);
    } catch {
      // ignore progress load errors
    }
  }, []);

  return {
    languages,
    setLanguages,
    sourceLanguage,
    setSourceLanguage,
    targetLanguage,
    setTargetLanguage,
    result,
    setResult,
    translating,
    sourceText,
    setSourceText,
    translate,
    cancelTranslation,
    swapLanguages,
    speakText,
    copyText,
    clearResult,

    wordAnalysis,
    setWordAnalysis,
    analyzeWord,
    sentenceAnalysis,
    setSentenceAnalysis,
    analyzeSentence,

    ocrResult,
    setOcrResult,
    processingOCR,
    processImageOCR,
    processCameraOCR,
    processPDFOCR,
    cancelOCR,

    vocabulary,
    loadVocabulary,
    saveWord,
    removeWord,
    isWordSaved,

    flashcards,
    generateFlashcards,
    reviewCard,
    studySession,
    startStudySession,
    getNextCard,

    history,
    loadHistory,
    clearHistory,
    bookmarks,
    addBookmark,
    removeBookmark,
    favorites,
    addFavorite,
    removeFavorite,

    dailyLesson,
    generateDailyLesson,
    conversationPractice,
    startConversationPractice,
    conversationTurns,
    continueConversation,

    progress,
    loadProgress,

    inputMode,
    setInputMode,
    tone,
    setTone,
  };
}
