import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Layers,
  HelpCircle,
  Trash2,
  X,
  Search,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Send,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { GlassCard, Badge, Spinner, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import type { VocabularyItemResponse, FlashcardResponse, QuizResponse, QuizQuestionSchema } from '../../lib/types';

type Tab = 'vocabulary' | 'flashcards' | 'quiz';

interface LearningPanelProps {
  sourceLanguage: string;
  targetLanguage: string;
  onClose: () => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'vocabulary', label: 'Vocabulary', icon: <BookOpen size={16} /> },
  { id: 'flashcards', label: 'Flashcards', icon: <Layers size={16} /> },
  { id: 'quiz', label: 'Quiz', icon: <HelpCircle size={16} /> },
];

export function LearningPanel({ sourceLanguage, targetLanguage, onClose }: LearningPanelProps) {
  const [tab, setTab] = useState<Tab>('vocabulary');

  return (
    <GlassCard className="flex h-[70vh] flex-col p-0">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brand-500" />
          <h2 className="font-display text-lg font-bold">Learning Center</h2>
        </div>
        <button
          onClick={onClose}
          className="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-black/10 px-3 py-2 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-brand-400/15 text-brand-700 dark:text-brand-300'
                : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {tab === 'vocabulary' && (
              <VocabularyTab />
            )}
            {tab === 'flashcards' && (
              <FlashcardsTab sourceLanguage={sourceLanguage} targetLanguage={targetLanguage} />
            )}
            {tab === 'quiz' && (
              <QuizTab sourceLanguage={sourceLanguage} targetLanguage={targetLanguage} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}

/* ----------------------------- Vocabulary Tab ----------------------------- */

function VocabularyTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<VocabularyItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.vocabularyList();
      setItems(data);
    } catch {
      toast({ title: 'Failed to load vocabulary', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.word.toLowerCase().includes(q) ||
        i.translation.toLowerCase().includes(q) ||
        (i.part_of_speech || '').toLowerCase().includes(q),
    );
  }, [items, query]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.deleteVocabulary(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast({ title: 'Removed from vocabulary', variant: 'success' });
      } catch {
        toast({ title: 'Could not delete', variant: 'error' });
      }
    },
    [toast],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={24} className="text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search words, translations, parts of speech…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftIcon={<Search size={16} />}
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No saved vocabulary"
          description="Words you save from translations will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{v.word}</span>
                  {v.part_of_speech && <Badge tone="sky">{v.part_of_speech}</Badge>}
                </div>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {v.translation}
                  {v.pronunciation && ` · ${v.pronunciation}`}
                </p>
              </div>
              <button
                onClick={() => remove(v.id)}
                className="focus-ring shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-coral/10 hover:text-coral"
                aria-label="Delete word"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------- Flashcards Tab ----------------------------- */

function FlashcardsTab({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) {
  const { toast } = useToast();
  const [cards, setCards] = useState<FlashcardResponse[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showGen, setShowGen] = useState(false);

  const generate = useCallback(async () => {
    if (!content.trim()) {
      toast({ title: 'Enter some text first', variant: 'info' });
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateFlashcards({
        content: content.trim(),
        source_language: sourceLanguage,
        target_language: targetLanguage,
        count: 8,
      });
      if (res.length === 0) {
        toast({ title: 'No flashcards generated', variant: 'info' });
        return;
      }
      setCards(res);
      setIndex(0);
      setFlipped(false);
      setReviewed(new Set());
      setShowGen(false);
      toast({ title: `Generated ${res.length} flashcards`, variant: 'success' });
    } catch {
      toast({ title: 'Flashcard generation failed', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }, [content, sourceLanguage, targetLanguage, toast]);

  const current = cards[index];

  const markReviewed = useCallback(() => {
    if (!current) return;
    setReviewed((prev) => new Set(prev).add(current.id));
    toast({ title: 'Marked as reviewed', variant: 'success' });
    if (index < cards.length - 1) {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }, [current, index, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="space-y-3">
        {!showGen ? (
          <EmptyState
            icon={<Layers size={28} />}
            title="No flashcards yet"
            description="Generate flashcards from any text to start reviewing."
            action={
              <Button size="sm" onClick={() => setShowGen(true)} leftIcon={<Sparkles size={14} />}>
                Generate flashcards
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            <TextArea
              label="Source text"
              value={content}
              onChange={setContent}
              rows={5}
              placeholder="Paste a paragraph or vocabulary list to turn into flashcards…"
            />
            <div className="flex gap-2">
              <Button onClick={generate} loading={generating} leftIcon={!generating && <Sparkles size={14} />}>
                {generating ? 'Generating…' : 'Generate'}
              </Button>
              <Button variant="ghost" onClick={() => setShowGen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <Badge tone={reviewed.has(current.id) ? 'brand' : 'neutral'}>
          {reviewed.has(current.id) ? 'Reviewed' : 'Due'}
        </Badge>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="focus-ring w-full"
          aria-label="Flip card"
        >
          <motion.div
            key={`${current.id}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="min-h-[160px] rounded-2xl border border-black/10 bg-white/70 px-5 py-6 text-center dark:border-white/10 dark:bg-white/5"
          >
            {flipped ? (
              <>
                <p className="text-xs uppercase tracking-wide text-slate-400">Translation</p>
                <p className="mt-2 font-display text-2xl font-bold">{current.back}</p>
                <p className="mt-2 text-sm text-slate-500">({current.difficulty})</p>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wide text-slate-400">Front</p>
                <p className="mt-2 font-display text-2xl font-bold">{current.front}</p>
                <p className="mt-2 text-xs text-slate-400">Tap to reveal</p>
              </>
            )}
          </motion.div>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1));
            setFlipped(false);
          }}
          leftIcon={<ArrowLeft size={14} />}
        >
          Prev
        </Button>
        <Button size="sm" variant="secondary" onClick={markReviewed} disabled={reviewed.has(current.id)} leftIcon={<CheckCircle2 size={14} />}>
          Mark reviewed
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={index === cards.length - 1}
          onClick={() => {
            setIndex((i) => Math.min(cards.length - 1, i + 1));
            setFlipped(false);
          }}
          rightIcon={<ArrowRight size={14} />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Quiz Tab -------------------------------- */

function QuizTab({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [active, setActive] = useState<QuizResponse | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQuizzes(await api.quizList());
    } catch {
      toast({ title: 'Failed to load quizzes', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(async () => {
    if (!content.trim()) {
      toast({ title: 'Enter some text first', variant: 'info' });
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateQuiz({
        content: content.trim(),
        source_language: sourceLanguage,
        target_language: targetLanguage,
        count: 5,
      });
      setQuizzes((prev) => [res, ...prev]);
      setActive(res);
      setQIndex(0);
      setAnswers({});
      setFinished(false);
      setShowGen(false);
      toast({ title: 'Quiz ready', variant: 'success' });
    } catch {
      toast({ title: 'Quiz generation failed', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }, [content, sourceLanguage, targetLanguage, toast]);

  const startQuiz = useCallback((q: QuizResponse) => {
    setActive(q);
    setQIndex(0);
    setAnswers({});
    setFinished(false);
  }, []);

  const submit = useCallback(async () => {
    if (!active) return;
    const score = active.questions.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0);
    setFinished(true);
    setSaving(true);
    try {
      await api.saveQuizResult({
        topic: active.topic,
        questions: active.questions,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        score,
        total: active.questions.length,
        completed: true,
      });
    } catch {
      /* non-blocking */
    } finally {
      setSaving(false);
    }
  }, [active, answers, sourceLanguage, targetLanguage]);

  if (active) {
    const q: QuizQuestionSchema = active.questions[qIndex];
    const chosen = answers[qIndex];
    const isLast = qIndex === active.questions.length - 1;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge tone="brand">{active.topic}</Badge>
          <button onClick={() => setActive(null)} className="text-sm text-slate-500 underline">
            Back to quizzes
          </button>
        </div>

        {!finished ? (
          <>
            <p className="text-sm text-slate-400">
              Question {qIndex + 1} of {active.questions.length}
            </p>
            <p className="font-display text-lg font-semibold">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt) => {
                const selected = chosen === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setAnswers((prev) => ({ ...prev, [qIndex]: opt }))}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                      selected
                        ? 'border-brand-400 bg-brand-400/10'
                        : 'border-black/10 hover:border-brand-400/50 dark:border-white/10',
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={qIndex === 0}
                onClick={() => setQIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              {isLast ? (
                <Button size="sm" onClick={submit} loading={saving} leftIcon={!saving && <Send size={14} />}>
                  Submit quiz
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setQIndex((i) => i + 1)}
                  disabled={chosen === undefined}
                  rightIcon={<ArrowRight size={14} />}
                >
                  Next
                </Button>
              )}
            </div>
          </>
        ) : (
          <QuizResult
            quiz={active}
            answers={answers}
            onRetry={() => {
              setAnswers({});
              setQIndex(0);
              setFinished(false);
            }}
            onExit={() => setActive(null)}
          />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={24} className="text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowGen(true)} leftIcon={<Sparkles size={14} />}>
          New quiz
        </Button>
      </div>

      {showGen && (
        <div className="space-y-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
          <TextArea
            label="Source text"
            value={content}
            onChange={setContent}
            rows={4}
            placeholder="Paste text to generate a quiz from…"
          />
          <div className="flex gap-2">
            <Button onClick={generate} loading={generating} leftIcon={!generating && <Sparkles size={14} />}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
            <Button variant="ghost" onClick={() => setShowGen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {quizzes.length === 0 ? (
        <EmptyState icon={<HelpCircle size={28} />} title="No quizzes yet" description="Generate a quiz to test your skills." />
      ) : (
        <ul className="space-y-2">
          {quizzes.map((quiz) => (
            <li
              key={quiz.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{quiz.topic}</span>
                  {quiz.completed && (
                    <Badge tone="brand">
                      {quiz.score}/{quiz.total}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {quiz.questions.length} questions
                  {quiz.completed ? ' · completed' : ' · in progress'}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => startQuiz(quiz)} leftIcon={<RotateCcw size={14} />}>
                {quiz.completed ? 'Retake' : 'Take'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuizResult({
  quiz,
  answers,
  onRetry,
  onExit,
}: {
  quiz: QuizResponse;
  answers: Record<number, string>;
  onRetry: () => void;
  onExit: () => void;
}) {
  const score = quiz.questions.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0);
  const pct = Math.round((score / quiz.questions.length) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-400/30 bg-brand-400/10 p-5 text-center">
        <p className="text-sm text-slate-500">Your score</p>
        <p className="font-display text-4xl font-bold text-brand-700 dark:text-brand-300">
          {score}/{quiz.questions.length}
        </p>
        <p className="text-sm text-slate-500">{pct}%</p>
      </div>

      <ul className="space-y-2">
        {quiz.questions.map((q, i) => {
          const correct = answers[i] === q.answer;
          return (
            <li
              key={i}
              className={cn(
                'rounded-xl border px-3 py-2.5',
                correct
                  ? 'border-brand-400/30 bg-brand-400/5'
                  : 'border-coral/30 bg-coral/5',
              )}
            >
              <div className="flex items-start gap-2">
                {correct ? <CheckCircle2 size={16} className="mt-0.5 text-brand-500" /> : <XCircle size={16} className="mt-0.5 text-coral" />}
                <div className="text-sm">
                  <p className="font-medium">{q.question}</p>
                  {!correct && (
                    <p className="text-xs text-slate-500">
                      Correct: <span className="text-brand-600 dark:text-brand-300">{q.answer}</span>
                    </p>
                  )}
                  {q.explanation && <p className="mt-1 text-xs text-slate-400">{q.explanation}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Button size="sm" onClick={onRetry} leftIcon={<RotateCcw size={14} />}>
          Retry
        </Button>
        <Button size="sm" variant="ghost" onClick={onExit}>
          Finish
        </Button>
      </div>
    </div>
  );
}
