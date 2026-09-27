import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  Copy,
  Languages,
  LoaderCircle,
  Trash2,
  Mic,
  ScanLine,
  Camera,
  X,
  Volume2,
  Bookmark,
  Star,
  Sparkles,
  MessageSquare,
  ClipboardPaste,
  Type,
  BarChart3,
  GraduationCap,
  MessageCircle,
  Pause,
  Upload,
  Wand2,
  Lightbulb,
  BookOpen,
  Target,
} from 'lucide-react';

import { GlassCard, PageHeader, EmptyState } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { TextArea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type {
  AnalysisTab,
  ExplainResponse,
  LanguageOption,
  OCRResponse,
  SentenceAnalysisDetail,
  TranslationHistoryItem,
  TranslationTextResponse,
  WordAnalysisDetail,
} from '../lib/types';
import { OCRScanner, WordAnalysisPanel, SentenceAnalysisPanel, LearningPanel, HistoryPanel } from '../components/translator';
import { useTranslator } from '../features/translator/useTranslator';

const INPUT_MODES: { id: 'text' | 'voice' | 'ocr' | 'camera'; label: string; icon: React.ReactNode }[] = [
  { id: 'text', label: 'Type', icon: <Type size={16} /> },
  { id: 'voice', label: 'Voice', icon: <Mic size={16} /> },
  { id: 'ocr', label: 'Scan', icon: <ScanLine size={16} /> },
  { id: 'camera', label: 'Camera', icon: <Camera size={16} /> },
];

const ANALYSIS_TABS: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
  { id: 'translation', label: 'Translation', icon: <Languages size={16} /> },
  { id: 'word', label: 'Word', icon: <Type size={16} /> },
  { id: 'sentence', label: 'Sentence', icon: <MessageSquare size={16} /> },
  { id: 'learning', label: 'Learning', icon: <Sparkles size={16} /> },
  { id: 'bookmarks', label: 'Saved', icon: <Bookmark size={16} /> },
];

const selectClassName =
  'h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm text-ink outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-white/10 dark:bg-white/5 dark:text-chalk';

function languageName(languages: LanguageOption[], code: string): string {
  if (code === 'auto') return 'Auto-detect';
  return languages.find((language) => language.code === code)?.name ?? code;
}

export default function Translate() {
  const { toast } = useToast();

  const {
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
  } = useTranslator({ default_target_language: 'te' });

  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTab>('translation');
  const [showOCR, setShowOCR] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [showLessonPlanner, setShowLessonPlanner] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const nonAutoCodes = useMemo(
    () => languages.map((language) => language.code),
    [languages],
  );

  useEffect(() => {
    let active = true;
    api
      .translationLanguages()
      .then((options) => {
        if (!active) return;
        setLanguages(options);
        const preferred = options.find((language) => language.code === 'te');
        const fallback = options[0]?.code ?? 'te';
      })
      .catch(() => {
        toast({
          title: 'Could not load languages',
          description: 'Translation will retry when you submit text.',
          variant: 'error',
        });
      });
    return () => { active = false; };
  }, [toast, setLanguages]);

  useEffect(() => {
    if (result && activeAnalysisTab === 'word' && !wordAnalysis) {
      void analyzeWord(result.translated_content.split(/\s+/)[0] || sourceText.split(/\s+/)[0]);
    }
  }, [result]);

  useEffect(() => {
    if (result && activeAnalysisTab === 'sentence' && !sentenceAnalysis) {
      void analyzeSentence(sourceText.trim());
    }
  }, [result]);

  function handleTranslate() {
    if (translating) return;
    if (!sourceText.trim()) {
      toast({ title: 'Enter some text to translate.', variant: 'error' });
      return;
    }
    void translate();
  }

  async function handleVoiceRecord() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach((track) => track.stop());

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob);
          formData.append('source_language', sourceLanguage);
          formData.append('target_language', targetLanguage);

          const response = await fetch('/api/v1/voice/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Voice transcription failed');

          const data = await response.json();
          setSourceText(data.transcription || data.text || '');
          setTranscript(data.transcription || data.text || '');
        } catch (error) {
          toast({
            title: 'Voice input failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'error',
          });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to use voice input.',
        variant: 'error',
      });
    }
  }

  async function handleCameraCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      cameraStreamRef.current = stream;
      setShowCamera(true);

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          processCameraOCR(blob).then(() => {
            setShowCamera(false);
            stream.getTracks().forEach((track) => track.stop());
          }).catch(() => {
            setShowCamera(false);
            stream.getTracks().forEach((track) => track.stop());
          });
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access to use camera translation.',
        variant: 'error',
      });
      setShowCamera(false);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      void processPDFOCR(file);
    } else if (file.type.startsWith('image/')) {
      void processImageOCR(file);
    } else {
      toast({ title: 'Unsupported file type', variant: 'error' });
    }
    setShowFileUpload(false);
  }

  function handlePaste() {
    navigator.clipboard.readText().then((text) => {
      setSourceText(text);
      toast({ title: 'Pasted from clipboard', variant: 'success' });
    }).catch(() => {
      toast({ title: 'Could not access clipboard', variant: 'error' });
    });
  }

  useEffect(() => {
    const handlePasteEvent = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text');
      if (text && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setSourceText(text);
        toast({ title: 'Pasted from clipboard', variant: 'success' });
      }
    };
    document.addEventListener('paste', handlePasteEvent);
    return () => document.removeEventListener('paste', handlePasteEvent);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="AI Language Studio"
        subtitle="Translate, learn, and master any language with AI"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProgress(true)}
              className="gap-2"
            >
              <BarChart3 size={16} />
              Progress
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLessonPlanner(true)}
              className="gap-2"
            >
              <GraduationCap size={16} />
              Lessons
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConversation(true)}
              className="gap-2"
            >
              <MessageCircle size={16} />
              Practice
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <GlassCard strong className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">From</label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className={selectClassName}
                >
                  <option value="auto">Auto-detect</option>
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={swapLanguages}
                className="mt-5"
                disabled={sourceLanguage === 'auto'}
              >
                <ArrowLeftRight size={18} />
              </Button>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">To</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className={selectClassName}
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Input</label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInputMode('text')}
                    className={cn('h-8 px-2', inputMode === 'text' && 'bg-brand-400/10 text-brand-300')}
                  >
                    <Type size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInputMode('voice')}
                    className={cn('h-8 px-2', inputMode === 'voice' && 'bg-brand-400/10 text-brand-300')}
                  >
                    <Mic size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOCR(true)}
                    className={cn('h-8 px-2', inputMode === 'ocr' && 'bg-brand-400/10 text-brand-300')}
                  >
                    <ScanLine size={14} />
                  </Button>
                </div>
              </div>
              <div className="relative mt-2" onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleTranslate();
                }
              }}>
                <TextArea
                  value={sourceText}
                  onChange={setSourceText}
                  placeholder="Enter text to translate, or use voice/camera/OCR..."
                  className="min-h-[160px] resize-none pr-24"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePaste}
                    className="h-8 w-8 px-0"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste size={16} />
                  </Button>
                  {inputMode === 'voice' && (
                    <Button
                      variant={isRecording ? 'danger' : 'ghost'}
                      size="sm"
                      onClick={handleVoiceRecord}
                      className="h-8 w-8 px-0"
                    >
                      {isRecording ? <Pause size={16} /> : <Mic size={16} />}
                    </Button>
                  )}
                </div>
              </div>
              {isRecording && (
                <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Recording... Click mic to stop
                </div>
              )}
              {transcript && (
                <div className="mt-2 rounded-lg bg-brand-400/5 p-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Transcript:</span> {transcript}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  onClick={handleTranslate}
                  disabled={translating || !sourceText.trim()}
                  className="flex-1 gap-2"
                >
                  {translating ? <LoaderCircle size={16} className="animate-spin" /> : <Languages size={16} />}
                  {translating ? 'Translating...' : 'Translate'}
                </Button>
                {translating && (
                  <Button variant="ghost" size="sm" onClick={cancelTranslation}>
                    <X size={16} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFileUpload(true)}
                  title="Upload file"
                >
                  <Upload size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCameraCapture}
                  title="Camera translation"
                >
                  <Camera size={16} />
                </Button>
              </div>
            </div>
          </GlassCard>

          <GlassCard strong className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Wand2 size={16} />
              <span>AI Translation Quality</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['formal', 'natural', 'technical'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all',
                    tone === t
                      ? 'border-brand-400 bg-brand-400/10 text-brand-300'
                      : 'border-black/10 hover:border-brand-400/30 dark:border-white/10'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-7">
          <GlassCard strong className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/5">
                {ANALYSIS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAnalysisTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                      activeAnalysisTab === tab.id
                        ? 'bg-white text-ink shadow-sm dark:bg-slate-800 dark:text-chalk'
                        : 'text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-chalk'
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {result && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speakText(result.translated_content, targetLanguage)}
                      title="Listen"
                    >
                      <Volume2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(result.translated_content)}
                      title="Copy"
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addBookmark(result)}
                      title="Bookmark"
                    >
                      <Bookmark size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addFavorite(result)}
                      title="Favorite"
                    >
                      <Star size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearResult}
                      title="Clear"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <EmptyState
                      icon={<Languages size={32} />}
                      title="Enter text to translate"
                      description="Type, speak, scan, or use camera to translate between any languages"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {activeAnalysisTab === 'translation' && (
                      <div className="space-y-3">
                        <div className="rounded-xl bg-black/5 p-4 dark:bg-white/5">
                          <p className="text-sm leading-relaxed text-ink dark:text-chalk">{sourceText}</p>
                        </div>
                        <div className="rounded-xl bg-brand-400/5 p-4">
                          <p className="text-sm leading-relaxed text-ink dark:text-chalk">{result.translated_content}</p>
                        </div>
                        {result.alternatives.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alternatives</p>
                            <div className="flex flex-wrap gap-2">
                              {result.alternatives.map((alt: string, index: number) => (
                                <button
                                  key={index}
                                  onClick={() => copyText(alt)}
                                  className="rounded-lg border border-black/10 px-3 py-1.5 text-xs hover:border-brand-400/30 dark:border-white/10"
                                >
                                  {alt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.notes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
                            <ul className="space-y-1">
                              {result.notes.map((note: string, index: number) => (
                                <li key={index} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                  <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
                                  {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {activeAnalysisTab === 'word' && (
                      <WordAnalysisPanel
                        analysis={wordAnalysis}
                        sourceLanguage={sourceLanguage}
                        targetLanguage={targetLanguage}
                        onSaveVocabulary={() => wordAnalysis && saveWord(wordAnalysis.original, wordAnalysis.translation, sourceLanguage, targetLanguage, wordAnalysis.usage)}
                        onSpeak={(text, lang) => speakText(text, lang)}
                      />
                    )}

                    {activeAnalysisTab === 'sentence' && (
                      <SentenceAnalysisPanel
                        analysis={sentenceAnalysis}
                        sourceLanguage={sourceLanguage}
                        targetLanguage={targetLanguage}
                        onSpeak={(text, lang) => speakText(text, lang)}
                      />
                    )}

                    {activeAnalysisTab === 'learning' && (
                      <LearningPanel
                        sourceLanguage={sourceLanguage}
                        targetLanguage={targetLanguage}
                        onClose={() => {}}
                      />
                    )}

                    {activeAnalysisTab === 'bookmarks' && (
                      <HistoryPanel
                        onClose={() => setShowHistory(false)}
                        onLoadHistory={(item) => {
                          setSourceText(item.original_content);
                          setTargetLanguage(item.target_language);
                          if (item.source_language !== 'auto') setSourceLanguage(item.source_language);
                        }}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal open={showOCR} onClose={() => setShowOCR(false)} title="Scan & Translate">
        <OCRScanner
          language={sourceLanguage}
          onScanComplete={(result) => {
            setOcrResult(result);
            setSourceText(result.text);
            setShowOCR(false);
          }}
          onClose={() => setShowOCR(false)}
        />
      </Modal>

      <Modal open={showCamera} onClose={() => { setShowCamera(false); cancelOCR(); }} title="Camera Translation">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Point your camera at any text to translate it in real-time.
          </p>
          <div className="flex items-center justify-center rounded-xl bg-black/5 p-8 dark:bg-white/5">
            <Camera size={48} className="text-slate-400" />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleCameraCapture} className="flex-1 gap-2">
              <Camera size={16} />
              Capture & Translate
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCamera(false); cancelOCR(); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showFileUpload} onClose={() => setShowFileUpload(false)} title="Upload Document">
        <div className="space-y-4">
          <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-black/10 p-8 dark:border-white/10">
            <div className="text-center">
              <Upload size={32} className="mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Upload PDF, Word, PowerPoint, or image files
              </p>
            </div>
          </div>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.tiff,.bmp"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button variant="ghost" size="sm" className="w-full cursor-pointer" onClick={() => document.getElementById('file-upload')?.click()}>
              Choose File
            </Button>
          </label>
        </div>
      </Modal>

      <Modal open={showVocabulary} onClose={() => setShowVocabulary(false)} title="Vocabulary Notebook">
        <div className="max-h-[600px] overflow-y-auto space-y-3">
          {vocabulary.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={32} />}
              title="No vocabulary yet"
              description="Save words from translations to build your vocabulary notebook"
            />
          ) : (
            vocabulary.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink dark:text-chalk">{item.word}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.translation}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWord(item.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-brand-400/10 px-2 py-0.5 text-xs text-brand-300">{item.part_of_speech}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/5">{item.mastery_level}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal open={showLessonPlanner} onClose={() => setShowLessonPlanner(false)} title="AI Lesson Planner">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="sm" onClick={() => generateDailyLesson(targetLanguage, 'beginner')} className="justify-start gap-2">
              <BookOpen size={16} />
              Beginner Lesson
            </Button>
            <Button variant="ghost" size="sm" onClick={() => generateDailyLesson(targetLanguage, 'intermediate')} className="justify-start gap-2">
              <Target size={16} />
              Intermediate Lesson
            </Button>
          </div>
          {dailyLesson && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{dailyLesson.plan_id}</p>
              <div className="space-y-2">
                {dailyLesson.lessons.map((lesson: any) => (
                  <div key={lesson.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-400/10 px-2 py-0.5 text-xs text-brand-300">{lesson.type}</span>
                      <span className="text-sm font-medium text-ink dark:text-chalk">{lesson.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{lesson.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showConversation} onClose={() => setShowConversation(false)} title="Conversation Practice">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Topic (e.g., greetings, travel, food)"
              className="flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    void startConversationPractice(input.value.trim(), 'casual', targetLanguage);
                  }
                }
              }}
            />
            <Button size="sm" onClick={() => {
              const input = document.querySelector('input[placeholder="Topic"]') as HTMLInputElement;
              if (input?.value.trim()) {
                void startConversationPractice(input.value.trim(), 'casual', targetLanguage);
              }
            }}>Start</Button>
          </div>
          {conversationPractice && (
            <div className="max-h-[400px] space-y-3 overflow-y-auto">
              {conversationTurns.map((turn: any, index: number) => (
                <div key={index} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-xl px-4 py-2 text-sm ${turn.role === 'user' ? 'bg-brand-400 text-white' : 'bg-black/5 dark:bg-white/5'}`}>
                    <p>{turn.content}</p>
                    {turn.corrections && turn.corrections.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {turn.corrections.map((correction: string, i: number) => (
                          <p key={i} className="text-xs text-red-500">{correction}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showProgress} onClose={() => setShowProgress(false)} title="Learning Progress">
        <div className="space-y-4">
          {progress ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-400/5 p-3">
                  <p className="text-xs text-slate-500">Words Learned</p>
                  <p className="text-2xl font-bold text-brand-300">{progress.words_learned}</p>
                </div>
                <div className="rounded-xl bg-brand-400/5 p-3">
                  <p className="text-xs text-slate-500">Words Mastered</p>
                  <p className="text-2xl font-bold text-brand-300">{progress.words_mastered}</p>
                </div>
                <div className="rounded-xl bg-brand-400/5 p-3">
                  <p className="text-xs text-slate-500">Current Streak</p>
                  <p className="text-2xl font-bold text-brand-300">{progress.current_streak} days</p>
                </div>
                <div className="rounded-xl bg-brand-400/5 p-3">
                  <p className="text-xs text-slate-500">Study Time</p>
                  <p className="text-2xl font-bold text-brand-300">{progress.total_study_time_minutes} min</p>
                </div>
              </div>
              {progress.weak_areas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Weak Areas</p>
                  <div className="flex flex-wrap gap-2">
                    {progress.weak_areas.map((area: string) => (
                      <span key={area} className="rounded-full bg-red-400/10 px-3 py-1 text-xs text-red-600">{area}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<BarChart3 size={32} />}
              title="No progress data"
              description="Start learning to track your progress"
            />
          )}
        </div>
      </Modal>

      {showHistory && (
        <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Translation History">
          <HistoryPanel
            onClose={() => setShowHistory(false)}
            onLoadHistory={(item) => {
              setSourceText(item.original_content);
              setTargetLanguage(item.target_language);
              if (item.source_language !== 'auto') setSourceLanguage(item.source_language);
              setShowHistory(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
