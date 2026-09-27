import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FileUp,
  Layers3,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Volume2,
  X,
} from 'lucide-react';
import { TeacherAvatar, type AvatarState } from '../components/classroom/TeacherAvatar';
import { VisualScriptRenderer } from '../components/classroom/VisualScriptRenderer';
import { Badge, GlassCard, Spinner } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { api, ApiClientError } from '../lib/api';
import { createAdvancedVisualization } from '../features/classroom/visualLearningEngine';
import { useVoice } from '../hooks/useVoice';
import { cn } from '../lib/utils';
import type { BoardScene, ClassSource, ClassroomLanguage, CurriculumContext, LearningClass } from '../lib/types';

type View = 'builder' | 'ready' | 'classroom';

const LEVELS = ['Not sure', 'Beginner', 'School', 'Intermediate', 'Undergraduate', 'Professional', 'Competitive exam'];
const LANGUAGES: Array<{ value: ClassroomLanguage; label: string; hint: string }> = [
  { value: 'en', label: 'English', hint: 'Clear English teaching' },
  { value: 'te', label: 'తెలుగు', hint: 'Telugu-first explanations' },
  { value: 'bilingual', label: 'English + తెలుగు', hint: 'Technical terms stay in English' },
  { value: 'hi', label: 'हिन्दी', hint: 'Hindi explanations' },
];

function languageLabel(language: ClassroomLanguage): string {
  return LANGUAGES.find((item) => item.value === language)?.label ?? 'English';
}

function readableContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as { content?: unknown; message?: unknown; answer?: unknown; text?: unknown; output?: unknown; response?: unknown };
    return readableContent(record.content ?? record.message ?? record.answer ?? record.text ?? record.output ?? record.response ?? '');
  }
  return '';
}

function BuilderStep({ number, title, active, complete }: { number: number; title: string; active: boolean; complete: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', active ? 'text-white' : 'text-white/45')}>
      <span className={cn('grid h-8 w-8 place-items-center rounded-full border text-sm font-semibold', complete ? 'border-teal-300 bg-teal-300 text-slate-950' : active ? 'border-cyan-200 bg-cyan-200/15 text-cyan-100' : 'border-white/20')}>
        {complete ? <Check size={15} /> : number}
      </span>
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

function SelectPill({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300', selected ? 'border-cyan-200 bg-cyan-200 text-slate-950' : 'border-white/15 bg-white/[0.04] text-white/70 hover:border-cyan-200/50 hover:text-white')}>
      {children}
    </button>
  );
}

function PreparationRail({ stages }: { stages: LearningClass['preparation'] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
          <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', stage.status === 'complete' ? 'bg-teal-300 text-slate-950' : stage.status === 'failed' ? 'bg-rose-400/20 text-rose-200' : stage.status === 'running' ? 'bg-cyan-300/20 text-cyan-100' : 'bg-white/10 text-white/45')}>
            {stage.status === 'complete' ? <Check size={14} /> : stage.status === 'running' ? <Spinner size={14} /> : stage.status === 'failed' ? <X size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <span className="text-sm text-white/75">{stage.label}</span>
        </div>
      ))}
    </div>
  );
}

function CurriculumMap({ learningClass }: { learningClass: LearningClass }) {
  const tree = learningClass.prepared_content.curriculum_tree;
  const coverage = learningClass.prepared_content.coverage;
  if (!tree?.modules?.length) return null;
  return (
    <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.04] p-4">
      {coverage && <p className={cn('mb-3 text-xs', coverage.requires_review ? 'text-amber-200' : 'text-teal-200')}>{coverage.requires_review ? `Coverage prepared with ${coverage.fallback_topics.length} explicit completion scene${coverage.fallback_topics.length === 1 ? '' : 's'} for provider-missed topics.` : 'Coverage check complete: every curriculum topic has a prepared scene.'}</p>}
      <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Learning route</p><span className="text-[11px] text-white/40">subject → module → chapter → topic</span></div>
      <div className="grid gap-3 md:grid-cols-3">
        {tree.modules.map((module) => (
          <div key={module.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-sm font-semibold text-cyan-100">{module.title}</p>
            <div className="mt-2 space-y-2">{module.chapters.map((chapter) => <div key={chapter.id}><p className="text-xs font-medium text-white/75">{chapter.title}</p><div className="mt-1 space-y-1 pl-3">{chapter.topics.map((topic) => <div key={topic.id}><p className="text-xs text-white/60">{topic.title}</p><p className="text-[10px] leading-4 text-white/35">{topic.subtopics.join(' · ')}</p></div>)}</div></div>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonPanel({ learningClass }: { learningClass: LearningClass }) {
  const counts = learningClass.comparison.counts ?? {};
  const matches = learningClass.comparison.matches ?? [];
  const curriculumContext = learningClass.comparison.curriculum_context ?? {};
  const contextLabel = Object.entries(curriculumContext).map(([key, value]) => `${key.replace('_', ' ')}: ${value}`).join(' · ');
  if (!learningClass.syllabus_topics.length) {
    return <div className="space-y-4"><CurriculumMap learningClass={learningClass} /><div className="rounded-2xl border border-dashed border-white/15 px-4 py-5 text-sm text-white/55">SMART curriculum selected. Upload a syllabus later if you want an alignment report.</div><p className="text-xs text-white/40">{contextLabel ? `Curriculum context: ${contextLabel}` : 'Curriculum context not specified; current board or exam alignment is not claimed.'}</p></div>;
  }
  const metrics: Array<[string, number, string]> = [
    ['Matching', counts.matching ?? 0, 'text-teal-200'],
    ['Partial', counts.partial_match ?? 0, 'text-amber-200'],
    ['AI additions', counts.missing_from_student_syllabus ?? 0, 'text-cyan-200'],
    ['Not in plan', counts.missing_from_ai_plan ?? 0, 'text-rose-200'],
  ];
  return (
    <div className="space-y-4">
      <CurriculumMap learningClass={learningClass} />
      <p className="text-xs text-white/40">{contextLabel ? `Curriculum context: ${contextLabel}` : 'Curriculum context not specified; current board or exam alignment is not claimed.'}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(([label, count, tone]) => <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-3"><p className={cn('text-xl font-semibold', tone)}>{count}</p><p className="text-xs text-white/45">{label}</p></div>)}
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {matches.map((match, index) => (
          <div key={`${match.student_topic ?? 'ai'}-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
            <span className="truncate text-white/70">{match.student_topic ?? '—'}</span>
            <span className="text-white/30">↔</span>
            <span className="truncate text-white/70">{match.ai_topic ?? 'Not covered'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimatedExample({ scene, paused }: { scene: BoardScene; paused: boolean }) {
  const labels = scene.animation?.labels?.length ? scene.animation.labels : ['Idea', 'Example', 'Practice'];
  const kind = scene.animation?.kind ?? 'concept_flow';
  const [activeStep, setActiveStep] = useState(0);
  const [force, setForce] = useState(20);
  const [mass, setMass] = useState(5);

  useEffect(() => {
    setActiveStep(0);
    setForce(20);
    setMass(5);
  }, [scene.id]);

  useEffect(() => {
    if (paused) return undefined;
    if (labels.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % labels.length);
    }, scene.animation?.duration_ms ?? 1800);
    return () => window.clearInterval(timer);
  }, [labels.length, paused, scene.animation?.duration_ms, scene.id]);

  const acceleration = force / Math.max(1, mass);
  return (
    <div className="rounded-2xl border border-teal-200/20 bg-teal-200/[0.05] p-4" aria-label={`Live example for ${scene.title}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-200/75">Live example</p>
        <span className="inline-flex items-center gap-1 text-[10px] text-teal-100/60"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />concept-linked simulation</span>
      </div>
      {kind === 'motion' ? <div className="space-y-3">
        <div className="relative h-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          <div className="absolute inset-y-0 left-0 rounded-xl bg-gradient-to-r from-cyan-300/20 to-amber-300/30 transition-all" style={{ width: `${Math.min(100, Math.max(8, acceleration * 12))}%` }} />
          <div className="relative flex h-full items-center justify-between px-3 text-xs text-white/75"><span>Force {force} N</span><span className="font-mono text-cyan-100">a = {acceleration.toFixed(1)} m/s²</span><span>Mass {mass} kg</span></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-white/60">Force: {force} N<input aria-label="Simulation force" type="range" min="1" max="60" value={force} onChange={(event) => setForce(Number(event.target.value))} className="mt-1 w-full accent-cyan-300" /></label>
          <label className="text-xs text-white/60">Mass: {mass} kg<input aria-label="Simulation mass" type="range" min="1" max="20" value={mass} onChange={(event) => setMass(Number(event.target.value))} className="mt-1 w-full accent-amber-300" /></label>
        </div>
        <p className="text-xs leading-5 text-white/55">Change one variable and observe the relationship: acceleration = force ÷ mass.</p>
      </div> : kind === 'equation' ? <div className="space-y-3">
        <div className="rounded-xl border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-4 text-center font-mono text-lg text-cyan-100">x = {activeStep + 1} → x² = {(activeStep + 1) ** 2}</div>
        <label className="block text-xs text-white/60">Try a value: {activeStep + 1}<input aria-label="Equation value" type="range" min="0" max={Math.max(4, labels.length - 1)} value={activeStep} onChange={(event) => setActiveStep(Number(event.target.value))} className="mt-1 w-full accent-cyan-300" /></label>
        <p className="text-xs leading-5 text-white/55">The visual updates the result as the input changes, then connects it to the prepared explanation below.</p>
      </div> : <>
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {labels.map((label, index) => (
            <div key={`${label}-${index}`} className="flex min-w-0 flex-1 items-center gap-2">
              <button type="button" onClick={() => setActiveStep(index)} className={cn('grid min-h-12 flex-1 place-items-center rounded-xl border px-2 text-center text-xs font-semibold text-white/80 transition', index === activeStep ? `${paused ? '' : 'animate-pulse '}border-cyan-200/50 bg-cyan-200/15` : 'border-white/10 bg-white/[0.05]')} aria-label={`Show ${label}`}>
                {label}
              </button>
              {index < labels.length - 1 && <ArrowRight size={15} className={cn('shrink-0 text-teal-200/70', index === activeStep ? 'animate-pulse' : '')} />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-white/50" aria-live="polite">Step {activeStep + 1}: {labels[activeStep]}</p>
      </>}
      {scene.real_world_example && <p className="mt-3 text-xs leading-5 text-white/55">{scene.real_world_example}</p>}
    </div>
  );
}

function BoardSurface({ scene, sceneIndex, sceneCount, paused, level, subject, canAdvance = true, onPrevious, onNext }: { scene: BoardScene | undefined; sceneIndex: number; sceneCount: number; paused: boolean; level: string; subject: string; canAdvance?: boolean; onPrevious: () => void; onNext: () => void }) {
  const [dynamicScene, setDynamicScene] = useState<Awaited<ReturnType<typeof createAdvancedVisualization>> | null>(null);

  useEffect(() => {
    let active = true;
    if (!scene) {
      setDynamicScene(null);
      return () => { active = false; };
    }
    setDynamicScene(null);
    void createAdvancedVisualization({
      topic: scene.topic || scene.title,
      concept: scene.body || scene.title,
      subject,
      level,
      learningMode: 'school',
      difficulty: level,
      realWorldExample: scene.real_world_example,
    }).then((generated) => {
      if (active) setDynamicScene(generated);
    });
    return () => { active = false; };
  }, [level, scene, subject]);

  if (!scene) return <div className="grid h-full min-h-[420px] place-items-center text-white/40">Your prepared board will appear here.</div>;
  const isCode = scene.visual_type === 'code_trace';
  const isFormula = scene.visual_type === 'formula';
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-cyan-100/15 bg-[#101d31] p-6 shadow-[0_25px_100px_rgba(0,0,0,.35)] sm:p-10">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(115,220,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(115,220,255,.07) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="relative flex min-h-[380px] flex-col">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/65">Digital board · scene {sceneIndex + 1}/{sceneCount}</p><h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-4xl">{scene.title}</h2></div>
          <Badge tone="sky">{scene.visual_type.replace('_', ' ')}</Badge>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-8">
          <AnimatedExample scene={scene} paused={paused} />
          <div className="rounded-2xl border border-cyan-200/20 bg-[#09111f] p-3" aria-label={`Dynamic visualization for ${scene.title}`}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Dynamic concept visualization</p>
              <span className="text-[10px] text-white/40">{paused ? 'paused with class' : 'live'}</span>
            </div>
            {dynamicScene ? <VisualScriptRenderer visualizationScene={dynamicScene} paused={paused} /> : <div className="grid h-48 place-items-center text-xs text-white/40">Preparing the concept visual…</div>}
          </div>
          {isFormula ? <div className="rounded-2xl border border-cyan-200/25 bg-cyan-200/[0.06] px-4 py-10 text-center font-mono text-3xl text-cyan-100 sm:text-6xl">{scene.body.match(/[^.!?\n]*=[^.!?\n]*/)?.[0] ?? scene.body.slice(0, 80)}</div> : isCode ? <pre className="overflow-x-auto rounded-2xl border border-violet-200/20 bg-[#09111f] p-5 font-mono text-sm leading-7 text-violet-100"><code>{scene.body}</code></pre> : <div className="mx-auto grid w-full max-w-2xl gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.07] p-5 text-center"><Lightbulb className="mx-auto mb-3 text-cyan-200" size={24} /><p className="text-sm font-semibold text-white">Observe</p><p className="mt-1 text-xs text-white/55">Notice the central idea</p></div><div className="rounded-2xl border border-teal-200/20 bg-teal-200/[0.07] p-5 text-center"><ArrowRight className="mx-auto mb-3 text-teal-200" size={24} /><p className="text-sm font-semibold text-white">Connect</p><p className="mt-1 text-xs text-white/55">Link cause and effect</p></div><div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] p-5 text-center"><Target className="mx-auto mb-3 text-amber-200" size={24} /><p className="text-sm font-semibold text-white">Apply</p><p className="mt-1 text-xs text-white/55">Try it yourself</p></div></div>}
          <p className="mx-auto max-w-3xl text-center text-base leading-8 text-white/75 sm:text-lg">{scene.body}</p>
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4"><button type="button" className="touch-target inline-flex items-center gap-2 rounded-lg px-3 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30" onClick={onPrevious} disabled={sceneIndex === 0}><ArrowLeft size={16} />Previous</button><span className="text-xs text-white/40">Prepared content · no blank generation gap</span><button type="button" className="touch-target inline-flex items-center gap-2 rounded-lg px-3 text-sm text-cyan-100 hover:bg-white/10 disabled:opacity-30" onClick={onNext} disabled={sceneIndex >= sceneCount - 1 || !canAdvance} aria-label="Next concept" title={canAdvance ? 'Continue to the next concept' : 'Complete the understanding checkpoint before continuing'}>Next concept<ArrowRight size={16} /></button></div>
      </div>
    </div>
  );
}

type StudyTab = 'notes' | 'practice' | 'quiz';

function StudyPanel({ learningClass, topic, onMasterySaved }: { learningClass: LearningClass; topic: string; onMasterySaved: (learningClass: LearningClass) => void }) {
  const [tab, setTab] = useState<StudyTab>('notes');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const notes = learningClass.prepared_content.notes;
  const quiz = learningClass.prepared_content.quiz;
  const practice = learningClass.prepared_content.practice ?? [];
  const currentMastery = learningClass.checkpoint.mastery?.[topic];
  const understood = typeof currentMastery === 'number' && currentMastery >= 70;
  const needsHelp = typeof currentMastery === 'number' && currentMastery < 70;

  const markUnderstanding = async (didUnderstand: boolean) => {
    setStatus('Saving understanding checkpoint...');
    try {
      const previousMastery = learningClass.checkpoint.mastery && typeof learningClass.checkpoint.mastery === 'object'
        ? learningClass.checkpoint.mastery
        : {};
      const updated = await api.saveLearningClassCheckpoint(learningClass.id, {
        current_lesson: learningClass.current_lesson,
        scene_id: learningClass.checkpoint.scene_id,
        stage: learningClass.checkpoint.stage,
        paused: learningClass.checkpoint.paused,
        lesson_progress: learningClass.checkpoint.lesson_progress,
        current_concept: topic,
        mastery: { ...previousMastery, [topic]: didUnderstand ? 100 : 0 },
      });
      onMasterySaved(updated);
      setStatus(didUnderstand ? 'Understood. The next concept is unlocked.' : 'Let’s stay here and review this concept.');
    } catch {
      setStatus('The understanding checkpoint could not be saved. Please try again.');
    }
  };

  const submitQuiz = async () => {
    if (!quiz?.questions.length) return;
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
    const correct = quiz.questions.filter((question) => normalize(answers[question.id] ?? '') === normalize(question.answer)).length;
    const nextScore = Math.round((correct / quiz.questions.length) * 100);
    setScore(nextScore);
    setMistakes(quiz.questions.length - correct);
    setSubmitted(true);
    setStatus('Saving mastery...');
    try {
      await api.classroomUpdateProgress({ action: 'quiz', topic, quiz_score: nextScore, xp_delta: Math.max(5, correct * 5) });
      const previousMastery = learningClass.checkpoint.mastery && typeof learningClass.checkpoint.mastery === 'object'
        ? learningClass.checkpoint.mastery as Record<string, unknown>
        : {};
      const updated = await api.saveLearningClassCheckpoint(learningClass.id, {
        current_lesson: learningClass.current_lesson,
        scene_id: learningClass.checkpoint.scene_id,
        stage: learningClass.checkpoint.stage,
        paused: learningClass.checkpoint.paused,
        lesson_progress: learningClass.checkpoint.lesson_progress,
        current_concept: topic,
        mastery: { ...previousMastery, [topic]: nextScore },
      });
      onMasterySaved(updated);
      setStatus('Mastery checkpoint saved.');
    } catch {
      setStatus('Quiz graded locally; mastery sync will retry next time.');
    }
  };

  return (
    <GlassCard className="border-white/10 bg-white/[0.035] p-4 text-white">
      <div className="mb-4 rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.04] p-3" aria-label="Understanding checkpoint"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">Understanding checkpoint</p><p className="mt-1 text-xs text-white/60">Confirm this concept before moving forward. Asking for help keeps the lesson here.</p></div><Badge tone={understood ? 'brand' : needsHelp ? 'neutral' : 'sky'}>{understood ? 'understood' : needsHelp ? 'needs help' : 'pending'}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => void markUnderstanding(true)} disabled={understood}>I understand this concept</Button><Button size="sm" variant="secondary" onClick={() => void markUnderstanding(false)}>I need help</Button></div></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-200/70">Study tools</p><p className="mt-1 text-sm text-white/55">Everything here is linked to this prepared lesson.</p></div>
        <div className="flex gap-1 rounded-xl bg-white/[0.05] p-1">
          {(['notes', 'practice', 'quiz'] as StudyTab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn('rounded-lg px-3 py-1.5 text-xs capitalize', tab === item ? 'bg-cyan-200 text-slate-950' : 'text-white/55 hover:text-white')}>{item}</button>)}
        </div>
      </div>
      {tab === 'notes' && <div className="space-y-3 text-sm"><p className="leading-6 text-white/75">{notes?.summary || `Revision notes for ${topic}.`}</p><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/35">Key points</p><ul className="list-disc space-y-1 pl-5 text-white/65">{(notes?.key_points?.length ? notes.key_points : [topic]).map((item) => <li key={item}>{item}</li>)}</ul></div>{Boolean(notes?.formula_sheet?.length) && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/35">Formula sheet</p><div className="space-y-1 font-mono text-cyan-100">{notes?.formula_sheet.map((item) => <p key={item}>{item}</p>)}</div></div>}{Boolean(notes?.flashcards?.length) && <div className="grid gap-2 sm:grid-cols-2">{notes?.flashcards.slice(0, 4).map((card) => <div key={card.term} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="font-semibold text-cyan-100">{card.term}</p><p className="mt-1 text-xs leading-5 text-white/55">{card.definition}</p></div>)}</div>}</div>}
      {tab === 'practice' && <div className="space-y-2">{practice.length ? practice.map((task) => <div key={task.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-teal-200/60">Practice · {task.topic}</p><p className="mt-1 text-sm leading-6 text-white/75">{task.prompt}</p></div>) : <p className="text-sm text-white/55">Practice will appear after the first prepared topic.</p>}</div>}
      {tab === 'quiz' && <div className="space-y-4">{quiz?.questions.length ? <>{quiz.questions.map((question, index) => <div key={question.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-sm font-medium text-white/80">{index + 1}. {question.question}</p><div className="mt-2 grid gap-2">{question.options.length ? question.options.map((option) => <button key={option} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className={cn('rounded-lg border px-3 py-2 text-left text-xs', answers[question.id] === option ? 'border-cyan-200 bg-cyan-200/10 text-cyan-100' : 'border-white/10 text-white/55 hover:text-white')}>{option}</button>) : <input value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Type your answer" className="h-10 rounded-lg border border-white/10 bg-[#09111f] px-3 text-sm text-white outline-none placeholder:text-white/30" />}</div>{submitted && <p className="mt-2 text-xs text-teal-200">Answer: {question.answer}. {question.explanation}</p>}</div>)}<div className="flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => void submitQuiz()} disabled={submitted}>Submit quiz</Button>{score !== null && <span className="text-sm text-cyan-100">Score: {score}%</span>}{mistakes !== null && <span className="text-xs text-amber-200">Mistakes: {mistakes}. {mistakes ? 'Review the explanations and retry this topic.' : 'Ready for the next concept.'}</span>}{status && <span className="text-xs text-white/50">{status}</span>}</div></> : <p className="text-sm text-white/55">This class has no prepared quiz yet.</p>}</div>}
    </GlassCard>
  );
}

export default function Classroom() {
  const [searchParams] = useSearchParams();
  const requestedClassId = searchParams.get('class');
  const resumeRequested = searchParams.get('resume') === '1';
  const [view, setView] = useState<View>('builder');
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('Not sure');
  const [language, setLanguage] = useState<ClassroomLanguage>('en');
  const [curriculumContext, setCurriculumContext] = useState<CurriculumContext>({});
  const [source, setSource] = useState<ClassSource>('smart');
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusFilename, setSyllabusFilename] = useState<string | null>(null);
  const [syllabusTopics, setSyllabusTopics] = useState<string[]>([]);
  const [classes, setClasses] = useState<LearningClass[]>([]);
  const [currentClass, setCurrentClass] = useState<LearningClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [animationTime, setAnimationTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [question, setQuestion] = useState('');
  const [smartWakeEnabled, setSmartWakeEnabled] = useState(false);
  const [voiceRate, setVoiceRate] = useState(1);
  const [messages, setMessages] = useState<Array<{ role: 'teacher' | 'student'; text: string }>>([]);
  const resumeClaimRef = useRef<string | null>(null);
  const resumeAfterDoubtRef = useRef(false);
  const narratedSceneRef = useRef<string | null>(null);
  const animationTimeRef = useRef(0);
  const saveCheckpointRef = useRef<((index: number, isPaused: boolean, mastery?: Record<string, unknown>) => Promise<LearningClass | null>) | null>(null);
  const voice = useVoice(language);
  const { speak, startListening, stopListening, listening, speaking, voiceStatus } = voice;
  const speakDisplayedText = useCallback((text: string) => {
    void speak(text, { rate: voiceRate });
  }, [speak, voiceRate]);

  const scenes = currentClass?.prepared_content.board_scenes ?? [];
  const scene = scenes[sceneIndex];
  const sceneMastery = scene?.topic && currentClass?.checkpoint.mastery && typeof currentClass.checkpoint.mastery === 'object'
    ? currentClass.checkpoint.mastery[scene.topic]
    : undefined;
  const sceneUnderstood = typeof sceneMastery === 'number' && sceneMastery >= 70;
  const teacherState: AvatarState = paused ? 'idle' : question ? 'listening' : working ? 'thinking' : 'explaining';

  useEffect(() => {
    if (view !== 'classroom' || !scene || paused || working || narratedSceneRef.current === scene.id) return;
    narratedSceneRef.current = scene.id;
    void speakDisplayedText(scene.body);
  }, [paused, scene, speakDisplayedText, view, working]);

  const refreshClasses = useCallback(async () => {
    try {
      const result = await api.listLearningClasses();
      setClasses(result);
    } catch {
      // The builder is still usable when the class list is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshClasses(); }, [refreshClasses]);

  const chooseExisting = useCallback((learningClass: LearningClass) => {
    setCurrentClass(learningClass);
    setLanguage(learningClass.language);
    setCurriculumContext(learningClass.comparison.curriculum_context ?? {});
    setGoal(learningClass.goal);
    setLevel(learningClass.level);
    setSyllabusText(learningClass.syllabus_text ?? '');
    setSyllabusFilename(learningClass.syllabus_filename);
    setSyllabusTopics(learningClass.syllabus_topics);
    setTopics(learningClass.curriculum);
    setView(learningClass.status === 'ready' ? 'ready' : 'builder');
    setError(learningClass.last_error ?? '');
  }, []);

  const startClassById = useCallback(async (classId: string) => {
    setWorking(true); setError('');
    try {
      narratedSceneRef.current = null;
      const started = await api.startLearningClass(classId);
      setCurrentClass(started.learning_class);
      setLanguage(started.learning_class.language);
      setSessionId(typeof started.session.session_id === 'string' ? started.session.session_id : null);
      setMessages((started.session.content || started.session.message) ? [{ role: 'teacher', text: readableContent(started.session.content ?? started.session.message) }] : []);
      const savedStep = started.learning_class.checkpoint.current_lesson;
      const runtimeStep = typeof savedStep === 'number'
        ? savedStep
        : started.learning_class.current_lesson;
      const restoredSceneCount = started.learning_class.prepared_content.board_scenes?.length ?? 0;
      setSceneIndex(Math.max(0, Math.min(runtimeStep || 0, Math.max(0, restoredSceneCount - 1))));
      const restoredAnimationTime = typeof started.learning_class.checkpoint.animation_time === 'number'
        ? started.learning_class.checkpoint.animation_time
        : 0;
      animationTimeRef.current = restoredAnimationTime;
      setAnimationTime(restoredAnimationTime);
      const restoredRate = started.learning_class.checkpoint.voice_settings?.rate;
      if (typeof restoredRate === 'number' && restoredRate >= 0.6 && restoredRate <= 1.4) setVoiceRate(restoredRate);
      setPaused(started.session.paused === true || started.learning_class.checkpoint.paused === true);
      setView('classroom');
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The classroom could not be started.');
    } finally { setWorking(false); }
  }, []);

  useEffect(() => {
    if (!requestedClassId) {
      resumeClaimRef.current = null;
      return;
    }
    if (loading || resumeClaimRef.current === requestedClassId) return;
    const requestedClass = classes.find((item) => item.id === requestedClassId);
    if (!requestedClass) return;
    resumeClaimRef.current = requestedClassId;
    chooseExisting(requestedClass);
    if (resumeRequested && requestedClass.status === 'ready') void startClassById(requestedClass.id);
  }, [classes, chooseExisting, loading, requestedClassId, resumeRequested, startClassById]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true); setError('');
    try {
      const extraction = await api.extractClassSyllabus(file);
      setSyllabusFilename(extraction.filename); setSyllabusText(extraction.text); setSyllabusTopics(extraction.topics); setSource('merged'); setStep(3);
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The syllabus could not be extracted.');
    } finally { setWorking(false); }
  };

  const createClass = async () => {
    if (!goal.trim()) { setError('Tell me what you want to learn first.'); setStep(1); return; }
    if (source !== 'smart' && !syllabusText.trim()) { setError('Upload or paste a syllabus before choosing comparison.'); setStep(3); return; }
    setWorking(true); setError('');
    try {
      const created = await api.createLearningClass({ goal: goal.trim(), level, language, syllabus_source: source, syllabus_text: syllabusText, syllabus_filename: syllabusFilename, teaching_style: 'visual', curriculum_context: curriculumContext });
      setCurrentClass(created); setTopics(created.curriculum); setClasses((items) => [created, ...items.filter((item) => item.id !== created.id)]); setView('ready');
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Class preparation failed.');
    } finally { setWorking(false); }
  };

  const startClass = async () => {
    if (!currentClass) return;
    await startClassById(currentClass.id);
  };

  const saveCurriculum = async (nextTopics: string[]) => {
    if (!currentClass || nextTopics.length === 0) return;
    setWorking(true); setError('');
    try { const updated = await api.updateLearningClassCurriculum(currentClass.id, nextTopics); setCurrentClass(updated); setTopics(updated.curriculum); } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Curriculum could not be saved.'); } finally { setWorking(false); }
  };

  const moveTopic = (index: number, direction: -1 | 1) => {
    const next = [...topics]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setTopics(next); void saveCurriculum(next);
  };

  const saveCheckpoint = async (index: number, isPaused: boolean, masteryOverride?: Record<string, unknown>) => {
    if (!currentClass) return null;
    const checkpointScene = scenes[index];
    const lessonProgress = scenes.length > 0 ? Math.round(((index + 1) / scenes.length) * 100) : 0;
    const updated = await api.saveLearningClassCheckpoint(currentClass.id, {
      current_lesson: index,
      scene_id: checkpointScene?.id,
      stage: checkpointScene?.title,
      paused: isPaused,
      current_concept: checkpointScene?.topic,
      current_sentence: checkpointScene?.body,
      visual_state: checkpointScene ? {
        scene_id: checkpointScene.id,
        visual_type: checkpointScene.visual_type,
        title: checkpointScene.title,
        topic: checkpointScene.topic,
      } : null,
      animation_time: animationTimeRef.current,
      lesson_progress: lessonProgress,
      mastery: masteryOverride ?? currentClass.checkpoint.mastery ?? {},
      language,
      voice_settings: {
        language,
        speaking,
        listening,
        provider: language === 'te' || language === 'bilingual' ? 'piper' : 'browser-or-piper',
        rate: voiceRate,
      },
      difficulty: currentClass.level,
      pending_question: question.trim() || null,
    }).catch(() => null);
    if (updated) setCurrentClass(updated);
    return updated;
  };

  saveCheckpointRef.current = saveCheckpoint;

  useEffect(() => {
    if (view !== 'classroom' || paused || working || !currentClass) return undefined;
    const interval = window.setInterval(() => {
      animationTimeRef.current += 1000;
      setAnimationTime(animationTimeRef.current);
      void saveCheckpointRef.current?.(sceneIndex, false);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [currentClass, paused, sceneIndex, view, working]);

  const advanceScene = async (nextIndex: number) => {
    if (!currentClass || nextIndex < 0 || nextIndex >= scenes.length) return;
    if (nextIndex > sceneIndex && !sceneUnderstood) {
      const checkpointMessage = 'Complete the understanding checkpoint before moving to the next concept.';
      setError(checkpointMessage);
      setMessages((items) => [...items, { role: 'teacher', text: checkpointMessage }]);
      return;
    }
    animationTimeRef.current = 0;
    setAnimationTime(0);
    setSceneIndex(nextIndex);
    await saveCheckpoint(nextIndex, paused);
  };

  const togglePause = async () => {
    const activeSessionId = sessionId || currentClass?.checkpoint.session_id;
    if (!activeSessionId || !currentClass) {
      setError('This lesson has no active session checkpoint. Start the class again to enable pause and resume.');
      return;
    }
    setWorking(true);
    try {
      if (paused) await api.resumeAutonomousLesson(activeSessionId); else await api.pauseAutonomousLesson(activeSessionId);
      const nextPaused = !paused;
      setPaused(nextPaused);
      await saveCheckpoint(sceneIndex, nextPaused);
    } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'The lesson state could not be saved.'); } finally { setWorking(false); }
  };

  const askTeacher = async (requestedQuestion = question) => {
    const activeSessionId = sessionId || currentClass?.checkpoint.session_id;
    if (!activeSessionId || !requestedQuestion.trim()) return;
    const input = requestedQuestion.trim();
    const requestedRate = /\b(slow|slower|slowly|slow\s+ga)\b/i.test(input) ? 0.75 : /\b(fast|faster|quickly)\b/i.test(input) ? 1.2 : voiceRate;
    if (requestedRate !== voiceRate) setVoiceRate(requestedRate);
    const shouldResume = !paused || resumeAfterDoubtRef.current;
    resumeAfterDoubtRef.current = false;
    setQuestion(''); setMessages((items) => [...items, { role: 'student', text: input }]); setWorking(true);
    try {
      if (shouldResume) {
        setPaused(true);
        await saveCheckpoint(sceneIndex, true);
      }
      const response = await api.continueAutonomousLesson(activeSessionId, input);
      const text = readableContent(response);
      if (!text) throw new Error('The teacher returned an empty answer.');
      setMessages((items) => [...items, { role: 'teacher', text }]);
      void speak(text, { rate: requestedRate });
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The teacher could not respond.');
    } finally {
      if (shouldResume) {
        try {
          setPaused(false);
          await saveCheckpoint(sceneIndex, false);
        } catch {
          setError('The doubt was answered, but the lesson remains paused at this checkpoint.');
        }
      }
      setWorking(false);
    }
  };

  const startVoiceInput = () => {
    if (listening) {
      stopListening();
      return;
    }
    voice.stop();
    if (!paused) {
      resumeAfterDoubtRef.current = true;
      setPaused(true);
      void saveCheckpoint(sceneIndex, true);
    }
    startListening((transcript) => {
      setQuestion(transcript);
      void askTeacher(transcript);
    }, smartWakeEnabled ? { handsFree: true, wakeWord: 'smart', requireWakeWord: true } : undefined);
  };

  const leaveClassroom = async () => {
    voice.stop();
    stopListening();
    await saveCheckpoint(sceneIndex, paused);
    narratedSceneRef.current = null;
    setView('ready');
  };

  const resetBuilder = () => { setView('builder'); setStep(1); setCurrentClass(null); setGoal(''); setCurriculumContext({}); setSyllabusText(''); setSyllabusTopics([]); setSyllabusFilename(null); setSource('smart'); setError(''); };

  if (view === 'classroom' && currentClass) {
    return (
      <div className="flex h-screen w-full flex-col bg-[#07111f] px-3 py-2 text-white overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-2 py-1"><div className="flex items-center gap-3"><button type="button" onClick={() => void leaveClassroom()} className="rounded-xl p-1.5 text-white/60 hover:bg-white/10 transition" aria-label="Save checkpoint and return"><ArrowLeft size={18} /></button><div><p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-cyan-200/60">SMARTER classroom</p><h1 className="font-display text-sm font-semibold truncate max-w-md">{currentClass.title}</h1></div></div><div className="flex items-center gap-2"><Badge tone="sky">{languageLabel(currentClass.language)}</Badge><button type="button" onClick={() => speakDisplayedText(scene?.body ?? '')} className="rounded-xl border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 transition flex items-center gap-1.5" aria-label="Read board aloud"><Volume2 size={15} /> Read</button></div></header>
        <main className="grid flex-1 min-h-0 w-full max-w-[1700px] mx-auto gap-3 py-2 xl:grid-cols-[240px_minmax(0,1fr)_300px] overflow-hidden">
          <aside className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-1"><GlassCard className="border-white/10 bg-white/[0.035] p-3 text-white shrink-0"><div className="mb-2 flex items-center gap-2"><Sparkles size={15} className="text-cyan-200" /><span className="text-xs font-semibold">Teacher state</span></div><div className="rounded-xl bg-[#101d31] py-2 flex justify-center"><TeacherAvatar persona="friendly_mentor" state={teacherState} speaking={!paused && !working} size={120} /></div><p className="mt-2 text-center text-xs font-medium text-cyan-100 truncate">{paused ? 'Paused' : question ? 'Listening' : working ? 'Thinking' : 'Explaining'}</p></GlassCard><GlassCard className="border-white/10 bg-white/[0.035] p-3 text-white flex-1 min-h-[140px] flex flex-col"><p className="mb-2 flex items-center gap-2 text-xs font-semibold"><ListChecks size={14} className="text-teal-200" />Lesson map</p><div className="min-h-0 flex-1 overflow-y-auto space-y-1 pr-1">{scenes.map((item, index) => <button type="button" key={item.id} onClick={() => void advanceScene(index)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition', index === sceneIndex ? 'bg-cyan-200/15 text-cyan-100 font-medium' : 'text-white/45 hover:bg-white/5 hover:text-white')}><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-current text-[10px]">{index + 1}</span><span className="truncate">{item.title}</span></button>)}</div></GlassCard></aside>
          <section className="flex flex-col min-h-0 overflow-y-auto pr-1"><div className="flex-1 min-h-0"><BoardSurface scene={scene} sceneIndex={sceneIndex} sceneCount={scenes.length} paused={paused} level={currentClass.level} subject={currentClass.subject} onPrevious={() => void advanceScene(sceneIndex - 1)} onNext={() => void advanceScene(sceneIndex + 1)} /></div><div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2"><div className="flex items-center gap-2"><button type="button" onClick={() => void togglePause()} disabled={working} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-200 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50 transition hover:bg-cyan-300">{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</button><button type="button" onClick={() => speakDisplayedText(scene?.body ?? '')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"><Volume2 size={14} /> Read Board</button></div><div className="flex items-center gap-2 text-[11px] text-white/45"><span>Scene {sceneIndex + 1} of {scenes.length}</span><button type="button" onClick={() => void advanceScene(0)} className="rounded-md p-1 hover:bg-white/10 transition" title="Restart lesson"><RotateCcw size={14} /></button></div></div></section>
          <aside className="order-3"><GlassCard className="flex h-full min-h-[420px] flex-col border-white/10 bg-white/[0.035] p-4 text-white"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><MessageCircle size={17} className="text-cyan-200" />Ask your teacher</p><Badge tone="neutral">checkpoint saved</Badge></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-[#09111f] p-3">{messages.length === 0 && <div className="flex h-full min-h-40 flex-col items-center justify-center text-center text-sm text-white/45"><CircleHelp size={24} className="mb-2 text-cyan-200/70" />Interrupt anytime. The class will return to this scene.</div>}{messages.map((message, index) => <div key={`${message.role}-${index}`} className={cn('rounded-xl px-3 py-2 text-sm leading-6', message.role === 'student' ? 'ml-6 bg-cyan-200/10 text-cyan-50' : 'mr-3 bg-white/[0.06] text-white/75')}><p className="mb-1 text-[10px] uppercase tracking-wider text-white/35">{message.role === 'student' ? 'You' : 'Teacher'}</p>{message.text}</div>)}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setQuestion('Explain this more simply')} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:text-white">Explain simply</button><button type="button" onClick={() => setQuestion('Show me another example')} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:text-white">Another example</button><button type="button" onClick={startVoiceInput} disabled={!voice.supported && !listening} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:text-white disabled:opacity-50"><Mic size={12} className="mr-1 inline" />{listening ? 'Stop listening' : 'Ask by voice'}</button></div><div className="mt-3 flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void askTeacher(); }} placeholder="Ask a question or interrupt…" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-200/60" aria-label="Ask your teacher" /><Button size="sm" onClick={() => void askTeacher()} loading={working} aria-label="Send question"><Send size={16} /></Button></div></GlassCard></aside>
          <div className="order-4 space-y-3 xl:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div><p className="text-sm font-semibold">Voice classroom controls</p><p className="text-xs text-white/45">{listening ? 'Listening… speak in Telugu, English, or mixed speech.' : speaking ? 'Speaking — your microphone is ready to interrupt.' : voiceStatus}</p></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant={smartWakeEnabled ? 'primary' : 'secondary'} onClick={() => { if (smartWakeEnabled && listening) stopListening(); setSmartWakeEnabled((enabled) => !enabled); }} leftIcon={<Sparkles size={15} />}>Smart wake {smartWakeEnabled ? 'on' : 'off'}</Button><Button size="sm" variant={listening ? 'primary' : 'secondary'} onClick={startVoiceInput} disabled={!voice.supported && !listening} leftIcon={<Mic size={15} />}>{listening ? 'Stop listening' : smartWakeEnabled ? 'Listen for “Smart”' : 'Ask by voice'}</Button><Button size="sm" variant="ghost" onClick={() => void leaveClassroom()} leftIcon={<ArrowLeft size={15} />}>Save & leave</Button></div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55">TTS speed <input aria-label="Classroom voice speed" type="range" min="0.6" max="1.4" step="0.1" value={voiceRate} onChange={(event) => setVoiceRate(Number(event.target.value))} className="w-32 accent-cyan-300" /><span className="font-mono text-cyan-100">{voiceRate.toFixed(1)}x</span></label>
            <StudyPanel learningClass={currentClass} topic={scene?.topic ?? currentClass.subject} onMasterySaved={setCurrentClass} />
          </div>
        </main>
      </div>
    );
  }

  if (view === 'ready' && currentClass) {
    return (
      <div className="min-h-full bg-[#0a1020] px-4 py-6 text-white sm:px-8"><div className="mx-auto max-w-6xl"><button type="button" onClick={resetBuilder} className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 hover:text-white"><ArrowLeft size={16} />Build another class</button><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><GlassCard className="border-white/10 bg-[#111a2d] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-200/70">Class ready</p><h1 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">{currentClass.title}</h1><p className="mt-3 max-w-2xl text-white/60">{currentClass.goal} · {currentClass.level} · {languageLabel(currentClass.language)}</p></div><Badge tone="brand"><Check size={13} /> prepared</Badge></div><div className="mt-8"><PreparationRail stages={currentClass.preparation} /></div><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" onClick={() => void startClass()} loading={working} leftIcon={<Play size={18} />}>Enter classroom</Button><Button variant="secondary" onClick={() => setView('builder')} leftIcon={<Layers3 size={16} />}>Adjust setup</Button></div>{error && <p className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}</GlassCard><GlassCard className="border-white/10 bg-[#111a2d] p-6 sm:p-8"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/65">Curriculum decisions</p><h2 className="mt-2 font-display text-xl font-semibold">Your route through the subject</h2></div><BookOpen size={22} className="text-cyan-200" /></div><div className="space-y-2">{topics.map((topic, index) => <div key={`${topic}-${index}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-200/10 text-xs text-cyan-100">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-white/80">{topic}</span><button type="button" onClick={() => moveTopic(index, -1)} disabled={index === 0 || working} className="touch-target rounded-lg text-white/35 hover:text-white disabled:opacity-20" aria-label={`Move ${topic} up`}><ChevronUp size={15} /></button><button type="button" onClick={() => moveTopic(index, 1)} disabled={index === topics.length - 1 || working} className="touch-target rounded-lg text-white/35 hover:text-white disabled:opacity-20" aria-label={`Move ${topic} down`}><ChevronDown size={15} /></button><button type="button" onClick={() => { const next = topics.filter((_, itemIndex) => itemIndex !== index); setTopics(next); if (next.length) void saveCurriculum(next); }} disabled={topics.length <= 1 || working} className="touch-target rounded-lg text-white/35 hover:text-rose-200 disabled:opacity-20" aria-label={`Remove ${topic}`}><X size={15} /></button></div>)}<form onSubmit={(event) => { event.preventDefault(); if (newTopic.trim()) { const next = [...topics, newTopic.trim()]; setTopics(next); setNewTopic(''); void saveCurriculum(next); } }} className="mt-3 flex gap-2"><input value={newTopic} onChange={(event) => setNewTopic(event.target.value)} placeholder="Add a topic" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-200/60" /><Button size="sm" variant="secondary" type="submit" aria-label="Add topic"><Plus size={16} /></Button></form></div></GlassCard><GlassCard className="border-white/10 bg-[#111a2d] p-6 sm:p-8 lg:col-span-2"><div className="mb-4 flex items-center gap-2"><Target size={18} className="text-amber-200" /><h2 className="font-display text-xl font-semibold">Syllabus alignment</h2></div><ComparisonPanel learningClass={currentClass} /></GlassCard></div></div></div>
    );
  }

  return (
    <div className="min-h-full bg-[#0a1020] px-4 py-6 text-white sm:px-8"><div className="mx-auto max-w-6xl"><div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="rounded-3xl border border-white/10 bg-[#111a2d] p-5 lg:min-h-[680px]"><div className="mb-10"><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200/60">SMARTER / CLASSROOM</p><p className="mt-2 text-sm text-white/45">Build a prepared lesson, then learn on the board.</p></div><div className="space-y-5"><BuilderStep number={1} title="Learning goal" active={step === 1} complete={step > 1} /><BuilderStep number={2} title="Level & language" active={step === 2} complete={step > 2} /><BuilderStep number={3} title="Syllabus" active={step === 3} complete={false} /></div><div className="mt-12 border-t border-white/10 pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/35">Your classes</p>{loading ? <Spinner size={18} /> : classes.length === 0 ? <p className="text-xs leading-5 text-white/35">Prepared classes will stay here for your next session.</p> : <div className="space-y-2">{classes.slice(0, 4).map((learningClass) => <button type="button" key={learningClass.id} onClick={() => chooseExisting(learningClass)} className="w-full truncate rounded-lg px-2 py-2 text-left text-xs text-white/55 hover:bg-white/5 hover:text-white">{learningClass.subject}</button>)}</div>}</div></aside><main className="rounded-3xl border border-white/10 bg-[#111a2d] p-5 sm:p-8 lg:p-12"><div className="mb-10 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-200/70">Create your classroom</p><h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-5xl">Tell me what you want to learn. I’ll prepare the room.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-white/55">SMARTER builds the route, prepares the board, and keeps your next scene ready before you need it.</p></div><div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.05] p-3 text-cyan-100"><Sparkles size={22} /></div></div>{step === 1 && <section><label htmlFor="learning-goal" className="text-sm font-semibold text-white/80">What do you want to learn?</label><textarea id="learning-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Teach me Newton’s laws from the basics…" rows={4} className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-[#09111f] p-4 text-lg text-white outline-none placeholder:text-white/25 focus:border-cyan-200/60" /><div className="mt-4 flex flex-wrap gap-2">{['Physics from basics', 'Python for beginners', 'DBMS architecture', 'English grammar'].map((suggestion) => <SelectPill key={suggestion} selected={goal === suggestion} onClick={() => setGoal(suggestion)}>{suggestion}</SelectPill>)}</div><div className="mt-8 flex justify-end"><Button size="lg" onClick={() => { if (goal.trim()) { setStep(2); setError(''); } else setError('Tell me what you want to learn first.'); }} rightIcon={<ArrowRight size={18} />}>Continue</Button></div>{error && <p className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}</section>}{step === 2 && <section><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white/80">How should I teach it?</p><p className="mt-1 text-sm text-white/45">You can say “not sure”; the first checkpoint will help us adapt.</p></div><button type="button" onClick={() => setStep(1)} className="text-sm text-cyan-200 hover:underline">Edit goal</button></div><div className="mt-6"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/35">Education level</p><div className="flex flex-wrap gap-2">{LEVELS.map((item) => <SelectPill key={item} selected={level === item} onClick={() => setLevel(item)}>{item}</SelectPill>)}</div></div><div className="mt-8"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/35">Teaching language</p><div className="grid gap-2 sm:grid-cols-2">{LANGUAGES.map((item) => <button type="button" key={item.value} onClick={() => setLanguage(item.value)} className={cn('rounded-2xl border p-4 text-left transition', language === item.value ? 'border-cyan-200 bg-cyan-200/10' : 'border-white/10 bg-white/[0.03] hover:border-cyan-200/40')}><span className="font-semibold">{item.label}</span><span className="mt-1 block text-xs text-white/45">{item.hint}</span></button>)}</div></div><div className="mt-8 flex justify-between"><Button variant="ghost" onClick={() => setStep(1)} leftIcon={<ArrowLeft size={17} />}>Back</Button><Button size="lg" onClick={() => setStep(3)} rightIcon={<ArrowRight size={18} />}>Continue</Button></div></section>}{step === 3 && <section><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white/80">Use a syllabus?</p><p className="mt-1 text-sm text-white/45">Upload or paste it when you want SMARTER to show exact coverage and gaps.</p></div><button type="button" onClick={() => setStep(2)} className="text-sm text-cyan-200 hover:underline">Edit preferences</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{([['smart', 'SMART curriculum', 'Build a fresh adaptive route'], ['merged', 'Compare & merge', 'Keep your syllabus and add missing ideas'], ['student', 'Use my syllabus', 'Follow the uploaded order']] as Array<[ClassSource, string, string]>).map(([value, label, hint]) => <button type="button" key={value} onClick={() => setSource(value)} className={cn('rounded-2xl border p-4 text-left transition', source === value ? 'border-teal-200 bg-teal-200/10' : 'border-white/10 bg-white/[0.03] hover:border-teal-200/40')}><span className="font-semibold">{label}</span><span className="mt-1 block text-xs text-white/45">{hint}</span></button>)}</div>{source !== 'smart' && <><label htmlFor="syllabus-file" className="mt-5 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-200/30 bg-cyan-200/[0.04] px-4 py-7 text-sm text-cyan-100 hover:bg-cyan-200/[0.08]"><FileUp size={20} />{working ? 'Extracting syllabus…' : syllabusFilename ? `Loaded ${syllabusFilename}` : 'Upload PDF, DOCX, TXT, or image'}<input id="syllabus-file" type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} /></label><textarea value={syllabusText} onChange={(event) => { setSyllabusText(event.target.value); setSyllabusTopics(event.target.value.split('\n').map((line) => line.trim()).filter(Boolean)); }} placeholder="Or paste the syllabus here…" rows={5} className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-[#09111f] p-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-200/60" />{syllabusTopics.length > 0 && <p className="mt-2 text-xs text-teal-200">{syllabusTopics.length} source lines ready for comparison.</p>}</>}{error && <p className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}<div className="mt-8 flex justify-between"><Button variant="ghost" onClick={() => setStep(2)} leftIcon={<ArrowLeft size={17} />}>Back</Button><Button size="lg" onClick={() => void createClass()} loading={working} rightIcon={<ArrowRight size={18} />}>Prepare my class</Button></div></section>}</main></div></div></div>
  );
}
