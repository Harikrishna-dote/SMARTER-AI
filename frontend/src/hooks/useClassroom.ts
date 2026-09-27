import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setAutonomousSession, clearAutonomousSession, setActiveClassroomId } from '../store/classroomSlice';
import { api } from '../lib/api';
import {
  adaptiveConversationInstruction,
  estimateConversationSignal,
  type ConversationSignal,
} from '../features/classroom/conversationIntelligence';
import { useToast } from './useToast';
import { useVoice } from './useVoice';
import { AvatarEngine } from '../features/avatar/avatarEngine';
import type {
  AvatarType,

  ClassroomConfig,
  ClassroomLanguage,
  ClassroomProgress,
  GeneratedHomework,
  GeneratedLesson,
  GeneratedNotes,
  GeneratedQuiz,
  HomeworkEvaluation,
  LanguageOption,
  LearningMode,
  TeachingStyle,
  TutorProfile,
} from '../lib/types';

export const AVATARS: { value: AvatarType; label: string }[] = [
  { value: 'friendly_mentor', label: 'Friendly Mentor' },
  { value: 'male_teacher', label: 'Male Teacher' },
  { value: 'female_teacher', label: 'Female Teacher' },
  { value: 'professor', label: 'Professor' },
  { value: 'school_teacher', label: 'School Teacher' },
  { value: 'kids_teacher', label: 'Kids Teacher' },
];

export const MODES: { value: LearningMode; label: string }[] = [
  { value: 'school', label: 'School' },
  { value: 'college', label: 'College' },
  { value: 'competitive_exam', label: 'Competitive Exam' },
  { value: 'programming', label: 'Programming' },
  { value: 'interview', label: 'Interview' },
  { value: 'language_learning', label: 'Language Learning' },
  { value: 'research', label: 'Research' },
  { value: 'professional_certification', label: 'Certification' },
];

export const STYLES: { value: TeachingStyle; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'very_detailed', label: 'Very Detailed' },
  { value: 'quick_revision', label: 'Quick Revision' },
  { value: 'visual', label: 'Visual' },
  { value: 'story_based', label: 'Story Based' },
  { value: 'practical', label: 'Practical' },
  { value: 'exam_oriented', label: 'Exam Oriented' },
  { value: 'concept_based', label: 'Concept Based' },
];

type ClassroomLanguageOption = LanguageOption & { code: ClassroomLanguage };

export const DEFAULT_LANGUAGES: ClassroomLanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bilingual', name: 'English + Telugu' },
];

const LANGUAGE_CODE_MAP: Record<string, ClassroomLanguage> = {
  'English': 'en',
  'Telugu': 'te',
  'Hindi': 'hi',
  'English + Telugu': 'bilingual',
};

function createClientId(prefix = 'msg'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveLanguageCode(language: string): ClassroomLanguage {
  const known = DEFAULT_LANGUAGES.find((item) => item.code === language);
  if (known) return known.code;
  return LANGUAGE_CODE_MAP[language] ?? 'en';
}

function styleToResponseStyle(style: TeachingStyle): TutorProfile['response_style'] {
  const map: Record<TeachingStyle, TutorProfile['response_style']> = {
    slow: 'friendly',
    normal: 'friendly',
    fast: 'concise',
    very_detailed: 'step_by_step',
    quick_revision: 'concise',
    visual: 'friendly',
    story_based: 'friendly',
    practical: 'friendly',
    exam_oriented: 'exam_ready',
    concept_based: 'step_by_step',
  };
  return map[style];
}

function classroomTeachingInstruction(config: ClassroomConfig, message: string): string {
  const languageName = DEFAULT_LANGUAGES.find((l) => l.code === config.language)?.name ?? 'English';
  const bilingualRule =
    config.language === 'bilingual'
      ? 'Use bilingual teaching: first simple English, then clear Telugu for every key idea.'
      : `Teach in ${languageName}.`;

  return [
    `Student request: ${message}`,
    `Topic: ${config.topic || 'General learning'}. Student level: ${config.level || 'Adaptive'}.`,
    bilingualRule,
    'Answer instantly and dynamically for this exact request.',
    'Behave like a real teacher, not a chatbot. If the student interrupts with a question, answer it and then return to the lesson state.',
    'Always teach in this order:',
    '1. Definition: one clear meaning of the concept.',
    '2. Simple explanation: one small concept chunk, not a wall of text.',
    '3. Examples: at least two examples, including one realistic real-life example.',
    '4. Practice/check: one small question or task for the student.',
    '5. Visual support: after the text explanation, briefly say what the realistic board/animation should show.',
    'After the concept chunk, ask if the student has doubts. If they understand, move to the next topic only after they say understood/next.',
    'Do not start by asking the student what they want. Do not lead with GIFs, videos, or photos. Text teaching comes first; visuals are supporting aids.',
    'Never leave the answer half-complete. Finish the current concept chunk fully.',
  ].join('\n');
}

export function toTutorProfile(config: ClassroomConfig): TutorProfile {
  const languageName = DEFAULT_LANGUAGES.find((l) => l.code === config.language)?.name ?? 'English';
  return {
    subject: config.topic || 'General',
    level: config.level || 'Adaptive',
    teaching_mode: 'explain',
    language: languageName,
    response_style: styleToResponseStyle(config.teaching_style),
    response_speed: 'balanced',
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type ClassroomTab = 'chat' | 'notes' | 'quiz' | 'homework' | 'progress';
export type LessonPhase =
  | 'setup'
  | 'awaiting_acceptance'
  | 'teaching'
  | 'awaiting_doubt'
  | 'clarifying'
  | 'completed';

function isAcceptanceMessage(text: string): boolean {
  if (/हाँ|ठीक|शुरू|तैयार|आगे|जारी/.test(text)) return true;
  return /\b(yes|start|begin|ready|accept|ok|okay|go ahead|continue)\b/i.test(text)
    || /అవును|సరే|ప్రారంభించు|మొదలు|స్టార్ట్|కొనసాగించు|ముందుకు/.test(text);
}

function isUnderstoodMessage(text: string): boolean {
  if (/समझ गया|समझ गई|स्पष्ट|कोई संदेह नहीं|आगे|अगला|जारी/.test(text)) return true;
  return /\b(understood|clear|got it|no doubt|no doubts|next|continue|move on|i understand)\b/i.test(text)
    || /అర్థమైంది|స్పష్టం|సందేహం లేదు|తర్వాత|ముందుకు|కొనసాగించు/.test(text);
}
function languageInstruction(config: ClassroomConfig): string {
  if (config.language === 'te') return 'Teach naturally in Telugu. Keep technical terms accurate and simple.';
  if (config.language === 'hi') return 'Teach naturally in Hindi. Keep technical terms accurate and simple.';
  if (config.language === 'bilingual') {
    return 'Teach each key idea first in simple English, then in clear Telugu. Keep both short enough for voice.';
  }
  return 'Teach naturally in English.';
}

function lessonPlanIntro(config: ClassroomConfig, lesson: GeneratedLesson | null): string {
  const topic = config.topic || 'this topic';
  const outline = lesson?.outline?.length
    ? lesson.outline
    : [
        { step: 1, title: 'Introduction', content: `Set the goal for ${topic}.`, minutes: 3 },
        { step: 2, title: 'Core Concept', content: `Explain the main idea of ${topic}.`, minutes: 8 },
        { step: 3, title: 'Example and Practice', content: `Use realistic examples and guided practice.`, minutes: 8 },
        { step: 4, title: 'Check and Next Step', content: 'Check doubts, summarize, and recommend what comes next.', minutes: 5 },
      ];
  const plan = outline
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.title}: ${item.content}`)
    .join('\n');

  if (config.language === 'te') {
    return [
      `నమస్తే. ఈ రోజు మనం "${topic}" నేర్చుకుందాం.`,
      'ముందుగా చిన్న ప్లాన్ చెబుతాను. మీరు ఒప్పుకుంటేనే పాఠం ప్రారంభిస్తాను.',
      plan,
      'ప్రారంభించాలంటే "సరే", "స్టార్ట్", లేదా "అవును" అని టైప్ చేయండి లేదా మైక్ ద్వారా చెప్పండి.',
    ].join('\n');
  }

  if (config.language === 'bilingual') {
    return [
      `Welcome. Today we will learn "${topic}" with a clear teacher-style plan.`,
      'First I will show the plan. If you agree, I will start the lesson.',
      plan,
      'Reply or say "start", "yes", or "ready" to begin.',
      '',
      `తెలుగులో: ఈ రోజు మనం "${topic}" నేర్చుకుందాం. ప్రారంభించాలంటే "సరే" లేదా "స్టార్ట్" అని చెప్పండి.`,
    ].join('\n');
  }

  return [
    `Welcome. Today we will learn "${topic}" with a clear teacher-style plan.`,
    'First I will show the plan. If you agree, I will start the lesson.',
    plan,
    'Reply or say "start", "yes", or "ready" to begin.',
  ].join('\n');
}
function stepInstruction(config: ClassroomConfig, lesson: GeneratedLesson | null, stepIndex: number): string {
  const outline = lesson?.outline ?? [];
  const step = outline[stepIndex] ?? {
    step: stepIndex + 1,
    title: `Step ${stepIndex + 1}`,
    content: `Teach ${config.topic || 'the topic'} clearly with examples.`,
    minutes: 6,
  };
  const total = Math.max(outline.length, 1);
  const doubtLine = config.language === 'te'
    ? 'చివర్లో తప్పనిసరిగా అడుగు: "ఏమైనా సందేహం ఉందా? అర్థమైతే అర్థమైంది లేదా తర్వాత అని చెప్పండి."'
    : config.language === 'bilingual'
      ? 'End by asking in English and Telugu: "Any doubt? If you understood, say understood/next. ఏమైనా సందేహం ఉందా? అర్థమైతే అర్థమైంది లేదా తర్వాత అని చెప్పండి."'
      : 'End by asking: "Any doubt? If you understood, say understood or next."';
  return [
    `Lesson engine state: Explain Concept -> Visual Demonstration -> Real-Life Analogy -> Worked Example -> Guided Practice -> Doubt Check.`,
    `Topic: ${config.topic || 'General learning'}. Step ${stepIndex + 1} of ${total}: ${step.title}.`,
    `Step goal: ${step.content}`,
    languageInstruction(config),
    'Teach this step fully, not halfway. Use simple language first, then add depth.',
    'Required order: definition, learning goal, prior-knowledge bridge, simple explanation, realistic example, worked example, guided practice, mini check.',
    'After text teaching, describe a useful animation/photo/board visual that would make the idea feel real.',
    'Do not move to the next lesson step yet.',
    doubtLine,
  ].join('\n');
}

function clarificationInstruction(config: ClassroomConfig, lesson: GeneratedLesson | null, doubt: string, stepIndex: number): string {
  const step = lesson?.outline?.[stepIndex];
  return [
    `Student doubt: ${doubt}`,
    `Current topic: ${config.topic || 'General learning'}. Current step: ${step?.title ?? `Step ${stepIndex + 1}`}.`,
    languageInstruction(config),
    'Clarify the doubt more easily than before. Use a simpler explanation, one real-life analogy, one tiny example, and a supporting animation/photo/diagram description after the text.',
    'Never shame the student. Treat the doubt as normal.',
    'End by asking whether it is clear now. If clear, ask the student to say understood or next.',
  ].join('\n');
}

function completionInstruction(config: ClassroomConfig, lesson: GeneratedLesson | null): string {
  const objectives = lesson?.learning_objectives?.length
    ? lesson.learning_objectives.join(', ')
    : `understand and apply ${config.topic}`;
  return [
    `Lesson completed for topic: ${config.topic || 'General learning'}.`,
    languageInstruction(config),
    `Objectives covered: ${objectives}.`,
    'Give a friendly summary, three key points, one mini revision question, one homework suggestion, and a recommended next lesson.',
    'Congratulate the student naturally and invite final doubts.',
  ].join('\n');
}

export interface UseClassroom {
  config: ClassroomConfig;
  setConfig: React.Dispatch<React.SetStateAction<ClassroomConfig>>;
  started: boolean;
  setStarted: React.Dispatch<React.SetStateAction<boolean>>;
  conversationId: string | null;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  messages: ChatMessage[];
  teacherText: string;
  streaming: boolean;
  avatarState: import('../components/classroom/TeacherAvatar').AvatarState;
  setAvatarState: React.Dispatch<React.SetStateAction<import('../components/classroom/TeacherAvatar').AvatarState>>;
  caption: string;
  captionChar: number;
  lesson: GeneratedLesson | null;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  lessonPhase: LessonPhase;
  lessonPlanText: string;
  paused: boolean;
  tab: ClassroomTab;
  setTab: React.Dispatch<React.SetStateAction<ClassroomTab>>;
  studentInput: string;
  setStudentInput: React.Dispatch<React.SetStateAction<string>>;
  ttsEnabled: boolean;
  setTtsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  voiceSpeed: number;
  setVoiceSpeed: React.Dispatch<React.SetStateAction<number>>;
  languages: LanguageOption[];
  scrollRef: React.RefObject<HTMLDivElement>;
  voice: ReturnType<typeof useVoice>;
  conversationSignal: ConversationSignal;
  handsFreeMode: boolean;
  setHandsFreeMode: React.Dispatch<React.SetStateAction<boolean>>;
  progress: ClassroomProgress | null;
  notes: GeneratedNotes | null;
  notesLoading: boolean;
  quiz: GeneratedQuiz | null;
  quizLoading: boolean;
  quizAnswers: Record<string, string>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quizEval: HomeworkEvaluation | null;
  homework: GeneratedHomework | null;
  homeworkLoading: boolean;
  homeworkAnswers: Record<string, string>;
  setHomeworkAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  homeworkEval: HomeworkEvaluation | null;
  busy: boolean;
  autonomousSessionId: string | null;
  autonomousStage: string | null;
  autonomousProgress: number;
  avatarMode: '2d' | '3d';
  setAvatarMode: React.Dispatch<React.SetStateAction<'2d' | '3d'>>;
  avatarEngine: AvatarEngine;
  sendMessage: (text: string, isResume?: boolean, conversationIdOverride?: string) => Promise<void>;
  startLesson: () => void;
  startAutonomousLesson: () => Promise<void>;
  continueAutonomousLesson: (studentInput?: string) => Promise<void>;
  pauseAutonomousLesson: () => Promise<void>;
  resumeAutonomousLesson: () => Promise<void>;
  acceptLessonPlan: () => void;
  stopTeaching: () => void;
  resumeTeaching: (prompt?: string) => void;
  quickAction: (kind: string) => void;
  generateNotes: () => void;
  generateQuiz: () => void;
  submitQuiz: () => void;
  generateHomework: () => void;
  submitHomework: () => void;
  onMic: () => void;
}

export function useClassroom(): UseClassroom {
  const { toast } = useToast();
  const dispatch = useDispatch();

  const [config, setConfig] = useState<ClassroomConfig>({
    avatar_type: 'friendly_mentor',
    learning_mode: 'school',
    teaching_style: 'normal',
    language: 'en',
    topic: '',
    subject: '',
    level: 'Adaptive',
  });
  const [started, setStarted] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teacherText, setTeacherText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [avatarState, setAvatarState] = useState<import('../components/classroom/TeacherAvatar').AvatarState>('idle');
  const [avatarMode, setAvatarMode] = useState<'2d' | '3d'>('2d');
  const avatarEngineRef = useRef<AvatarEngine | null>(null);
  if (!avatarEngineRef.current) {
    avatarEngineRef.current = new AvatarEngine({
      persona: config.avatar_type,
      language: config.language,
      quality: 'medium',
    });
  }
  const [caption, setCaption] = useState('');
  const [captionChar, setCaptionChar] = useState(0);
  const [lesson, setLesson] = useState<GeneratedLesson | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('setup');
  const [lessonPlanText, setLessonPlanText] = useState('');
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState<ClassroomTab>('chat');
  const [studentInput, setStudentInput] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [conversationSignal, setConversationSignal] = useState<ConversationSignal>(() =>
    estimateConversationSignal(''),
  );
  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [notes, setNotes] = useState<GeneratedNotes | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizEval, setQuizEval] = useState<HomeworkEvaluation | null>(null);
  const [homework, setHomework] = useState<GeneratedHomework | null>(null);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [homeworkAnswers, setHomeworkAnswers] = useState<Record<string, string>>({});
  const [homeworkEval, setHomeworkEvaluation] = useState<HomeworkEvaluation | null>(null);
  const [progress, setProgress] = useState<ClassroomProgress | null>(null);
  const [pendingResume, setPendingResume] = useState<string | null>(null);
  const [autonomousSessionId, setAutonomousSessionId] = useState<string | null>(null);
  const [autonomousStage, setAutonomousStage] = useState<string | null>(null);
  const [autonomousProgress, setAutonomousProgress] = useState(0);

  useEffect(() => {
    dispatch(setActiveClassroomId(autonomousSessionId));
    return () => { dispatch(setActiveClassroomId(null)); };
  }, [autonomousSessionId, dispatch]);

  const busy = streaming;
  const languageCode = resolveLanguageCode(config.language);
  const voice = useVoice(languageCode);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, teacherText]);

  useEffect(() => {
    api.translationLanguages().then(setLanguages).catch(() => undefined);
    api.classroomProgress().then(setProgress).catch(() => undefined);
  }, []);

  const awardXp = useCallback(
    async (update: {
      xp_delta: number;
      action: string;
      topic?: string;
      quiz_score?: number;
      homework_correct?: number;
      homework_total?: number;
    }) => {
      try {
        const next = await api.classroomUpdateProgress(update);
        setProgress(next);
      } catch {
        /* non-critical */
      }
    },
    [],
  );

  const speakCaption = useCallback(
    (text: string) => {
      setCaption(text);
      setCaptionChar(0);
      if (!ttsEnabled) return;
      voice.speak(text, {
        rate: voiceSpeed,
        onBoundary: (charIndex) => setCaptionChar(charIndex),
        onEnd: () => setCaptionChar(text.length),
      });
    },
    [ttsEnabled, voiceSpeed, voice],
  );

  const stopTeaching = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    voice.stop();
    setStreaming(false);
    setAvatarState('idle');
    setPaused(true);
    dispatch(clearAutonomousSession());
  }, [voice, dispatch]);

  const startLesson = useCallback(async () => {
    if (!config.topic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic to begin the lesson.', variant: 'error' });
      return;
    }
    try {
      dispatch(clearAutonomousSession());
      const conv = await api.createConversation(`Classroom: ${config.topic}`);
      setConversationId(conv.id);
      setStarted(true);
      setMessages([]);
      setTeacherText('');
      setAvatarState('greeting');
      setPaused(false);
      setCurrentStep(0);
      setLessonPhase('awaiting_acceptance');
      setPendingResume(null);
      setTab('chat');
      setNotes(null);
      setQuiz(null);
      setQuizAnswers({});
      setQuizEval(null);
      setHomework(null);
      setHomeworkAnswers({});
      setHomeworkEvaluation(null);

      const lessonPlan = await api.classroomLesson(config, config.topic).catch(() => null);
      setLesson(lessonPlan);

      await awardXp({ xp_delta: 10, action: 'practice', topic: config.topic });

      const planText = lessonPlanIntro(config, lessonPlan);
      setLessonPlanText(planText);
      setTeacherText(planText);
      setMessages([{ id: createClientId(), role: 'assistant', content: planText }]);
      speakCaption(planText);
    } catch (err) {
      toast({
        title: 'Could not start lesson',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      });
    }
  }, [config, awardXp, speakCaption, toast, dispatch]);

  const streamTeacherResponse = useCallback(
    async ({
      prompt,
      userText,
      isResume = false,
      conversationIdOverride,
      phaseOnDone = 'awaiting_doubt',
    }: {
      prompt: string;
      userText?: string;
      isResume?: boolean;
      conversationIdOverride?: string;
      phaseOnDone?: LessonPhase;
    }) => {
      const activeConversationId = conversationIdOverride ?? conversationId;
      if (!activeConversationId || !prompt.trim() || streaming) return;
      if (userText?.trim()) {
        const userMsg: ChatMessage = { id: createClientId(), role: 'user', content: userText };
        setMessages((m) => [...m, userMsg]);
      }
      setStudentInput('');
      setStreaming(true);
      setLessonPhase(phaseOnDone === 'awaiting_doubt' ? 'teaching' : phaseOnDone);
      setAvatarState('listening');
      setTeacherText('');
      const controller = new AbortController();
      abortRef.current = controller;
      let buffer = '';
      try {
        const payload = {
          message: prompt,
          use_memory: true,
          tutor: toTutorProfile(config),
          voice_response: ttsEnabled,
        };
        for await (const event of api.streamMessage(activeConversationId, payload, controller.signal)) {
          if (controller.signal.aborted) {
            setPendingResume(prompt);
            break;
          }
          if (event.type === 'token') {
            buffer += event.content;
            setTeacherText(buffer);
            setAvatarState('explaining');
          } else if (event.type === 'error') {
            toast({ title: 'Teacher error', description: String(event.message), variant: 'error' });
          } else if (event.type === 'done') {
            const assistantMsg: ChatMessage = {
              id: event.message?.id ?? createClientId(),
              role: 'assistant',
              content: buffer,
            };
            setMessages((m) => [...m, assistantMsg]);
            if (!isResume && pendingResume) setPendingResume(null);
          }
        }
        if (!controller.signal.aborted && buffer) {
          speakCaption(buffer);
          setAvatarState(phaseOnDone === 'completed' ? 'celebrating' : 'encouraging');
          setLessonPhase(phaseOnDone);
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          toast({
            title: 'Connection issue',
            description: err instanceof Error ? err.message : 'Failed to reach the teacher.',
            variant: 'error',
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setStreaming(false);
          abortRef.current = null;
        }
      }
    },
    [conversationId, config, streaming, speakCaption, toast, pendingResume, ttsEnabled],
  );

  const teachStep = useCallback(
    async (stepIndex: number, userText?: string, conversationIdOverride?: string) => {
      setPaused(false);
      setCurrentStep(stepIndex);
      await streamTeacherResponse({
        prompt: stepInstruction(config, lesson, stepIndex),
        userText,
        conversationIdOverride,
        phaseOnDone: 'awaiting_doubt',
      });
    },
    [config, lesson, streamTeacherResponse],
  );

  const completeLesson = useCallback(
    async (userText?: string) => {
      await streamTeacherResponse({
        prompt: completionInstruction(config, lesson),
        userText,
        phaseOnDone: 'completed',
      });
      await awardXp({ xp_delta: 25, action: 'practice', topic: config.topic });
    },
    [awardXp, config, lesson, streamTeacherResponse],
  );

  const sendMessage = useCallback(
    async (text: string, isResume = false, conversationIdOverride?: string) => {
      const request = text.trim();
      const activeConversationId = conversationIdOverride ?? conversationId;
      if (!request || streaming) return;
      const signal = estimateConversationSignal(request);
      setConversationSignal(signal);
      setAvatarState(signal.avatarState);
      if (signal.detectedLanguage === 'te' || signal.detectedLanguage === 'hi') {
        const detectedLanguage = signal.detectedLanguage;
        setConfig((current) =>
          current.language === 'bilingual' || current.language === detectedLanguage
            ? current
            : { ...current, language: detectedLanguage },
        );
      } else if (signal.detectedLanguage === 'mixed') {
        setConfig((current) => (current.language === 'bilingual' ? current : { ...current, language: 'bilingual' }));
      }

      if (autonomousSessionId) {
        const userMsg: ChatMessage = { id: createClientId(), role: 'user', content: request };
        setMessages((m) => [...m, userMsg]);
        setStudentInput('');
        setStreaming(true);
        setAvatarState('thinking');
        try {
          const result = await api.continueAutonomousLesson(autonomousSessionId, request);
          setAutonomousStage(result.stage || result.next_stage || null);
          setAutonomousProgress(result.progress_percent || autonomousProgress);
          const content = result.content || result.message || 'Continuing...';
          const responseText = typeof content === 'string' ? content : JSON.stringify(content);
          setTeacherText(responseText);
          setMessages((m) => [...m, { id: createClientId(), role: 'assistant', content: responseText }]);
          speakCaption(responseText);
          setLessonPhase(result.resume_lesson ? 'clarifying' : result.is_completed ? 'completed' : 'awaiting_doubt');
          setAvatarState(result.type === 'lesson_paused' ? 'idle' : result.is_completed ? 'celebrating' : 'encouraging');
          if (result.type === 'lesson_paused') setPaused(true);
          if (result.is_completed) {
            await awardXp({ xp_delta: 25, action: 'practice', topic: config.topic });
          }
        } catch (err) {
          toast({
            title: 'Lesson error',
            description: err instanceof Error ? err.message : 'Try again.',
            variant: 'error',
          });
        } finally {
          setStreaming(false);
        }
        return;
      }

      if (!activeConversationId) return;

      if (lessonPhase === 'awaiting_acceptance') {
        if (isAcceptanceMessage(request)) {
          await teachStep(0, request, activeConversationId);
          return;
        }
        const guide =
          config.language === 'te'
            ? 'పాఠం ప్రారంభించడానికి "సరే" లేదా "స్టార్ట్" అని చెప్పండి. ప్లాన్ మార్చాలంటే మీకు కావలసిన మార్పు చెప్పండి.'
            : config.language === 'bilingual'
              ? 'Say "start" when you are ready. తెలుగులో: సిద్ధంగా ఉంటే "సరే" లేదా "స్టార్ట్" అని చెప్పండి.'
              : 'Say "start", "yes", or "ready" when you want me to begin. You can also tell me what to change in the plan.';        setMessages((m) => [
          ...m,
          { id: createClientId(), role: 'user', content: request },
          { id: createClientId(), role: 'assistant', content: guide },
        ]);
        setTeacherText(guide);
        speakCaption(guide);
        return;
      }

      if (lessonPhase === 'awaiting_doubt' && isUnderstoodMessage(request)) {
        const nextStep = currentStep + 1;
        const totalSteps = Math.max(lesson?.outline.length ?? 0, 1);
        if (nextStep < totalSteps) {
          await teachStep(nextStep, request, activeConversationId);
        } else {
          await completeLesson(request);
        }
        return;
      }

      if (lessonPhase === 'awaiting_doubt') {
        await streamTeacherResponse({
          prompt: `${adaptiveConversationInstruction(signal)}\n\n${clarificationInstruction(config, lesson, request, currentStep)}`,
          userText: request,
          conversationIdOverride: activeConversationId,
          phaseOnDone: 'awaiting_doubt',
        });
        return;
      }

      await streamTeacherResponse({
        prompt: isResume ? request : `${adaptiveConversationInstruction(signal)}\n\n${classroomTeachingInstruction(config, request)}`,
        userText: request,
        isResume,
        conversationIdOverride: activeConversationId,
        phaseOnDone: 'awaiting_doubt',
      });
    },
    [
      completeLesson,
      config,
      conversationId,
      currentStep,
      autonomousProgress,
      autonomousSessionId,
      awardXp,
      lesson,
      lessonPhase,
      speakCaption,
      streaming,
      streamTeacherResponse,
      teachStep,
    ],
  );

  const resumeTeaching = useCallback(
    async (resumePrompt?: string) => {
      if (!conversationId) return;
      setPaused(false);
      setAvatarState('explaining');
      const languageName = DEFAULT_LANGUAGES.find((l) => l.code === config.language)?.name ?? 'English';
      const prompt =
        resumePrompt ??
        `Resume the lesson on ${config.topic} exactly where you left off in step ${currentStep + 1}. Continue teaching from that point without repeating what was already covered. Teach in ${languageName}.`;
      await streamTeacherResponse({ prompt, isResume: true, phaseOnDone: 'awaiting_doubt' });
    },
    [conversationId, config.language, config.topic, currentStep, streamTeacherResponse],
  );

  const acceptLessonPlan = useCallback(async () => {
    if (!conversationId || streaming) return;
    await teachStep(0, config.language === 'te' ? 'సరే, ప్రారంభించండి.' : 'Yes, start the lesson.', conversationId);
  }, [config.language, conversationId, streaming, teachStep]);

  const quickAction = useCallback(
    (kind: string) => {
      const languageName = DEFAULT_LANGUAGES.find((l) => l.code === config.language)?.name ?? 'English';
      const map: Record<string, string> = {
        start: config.language === 'te' ? 'సరే, స్టార్ట్ చేయండి.' : 'Yes, start the lesson.',
        understood: config.language === 'te' ? 'అర్థమైంది. తర్వాతి టాపిక్‌కు వెళ్లండి.' : 'I understood. Please move to the next topic.',
        slower: 'Please explain that again, slower, with an extra simple example.',
        example: 'Can you give me another real-life example for this?',
        translate: `Please translate your last explanation into ${languageName} and keep it simple.`,
        summary: 'Please give me a short summary of what we have covered so far.',
        revision: 'Give me a quick revision of the key points to remember.',
        diagram: 'Draw or describe a clear diagram / flowchart for this concept.',
        code: 'Explain this with a short code example where relevant.',
        next: 'I understood. Please move to the next topic.',
        doubt: 'I have a doubt - please clarify.',
      };
      sendMessage(map[kind] ?? '');
    },
    [config.language, sendMessage],
  );

  const generateNotes = useCallback(async () => {
    setNotesLoading(true);
    setTab('notes');
    try {
      setNotes(await api.classroomNotes(config, config.topic));
    } catch (err) {
      toast({ title: 'Could not generate notes', description: String((err as Error).message), variant: 'error' });
    } finally {
      setNotesLoading(false);
    }
  }, [config, toast]);

  const generateQuiz = useCallback(async () => {
    setQuizLoading(true);
    setTab('quiz');
    setQuiz(null);
    setQuizAnswers({});
    setQuizEval(null);
    try {
      const q = await api.classroomQuiz(config, config.topic, 5);
      setQuiz(q);
    } catch (err) {
      toast({ title: 'Could not generate quiz', description: String((err as Error).message), variant: 'error' });
    } finally {
      setQuizLoading(false);
    }
  }, [config, toast]);

  const submitQuiz = useCallback(async () => {
    if (!quiz) return;
    const items = quiz.questions.map((q) => ({
      question: q.question,
      answer: quizAnswers[q.id] ?? '',
      expected: q.answer,
    }));
    try {
      const evaluation = await api.classroomEvaluate(config, items, config.topic);
      setQuizEval(evaluation);
      await awardXp({ xp_delta: 20, action: 'quiz', topic: config.topic, quiz_score: evaluation.overall_score });
      if (evaluation.overall_score >= 70) setAvatarState('celebrating');
    } catch (err) {
      toast({ title: 'Could not evaluate quiz', description: String((err as Error).message), variant: 'error' });
    }
  }, [quiz, quizAnswers, config, awardXp, toast]);

  const generateHomework = useCallback(async () => {
    setHomeworkLoading(true);
    setTab('homework');
    setHomework(null);
    setHomeworkAnswers({});
    setHomeworkEvaluation(null);
    try {
      setHomework(await api.classroomHomework(config, config.topic, 'medium'));
    } catch (err) {
      toast({ title: 'Could not set homework', description: String((err as Error).message), variant: 'error' });
    } finally {
      setHomeworkLoading(false);
    }
  }, [config, toast]);

  const submitHomework = useCallback(async () => {
    if (!homework) return;
    const items = homework.tasks.map((t) => ({
      question: t.question,
      answer: homeworkAnswers[t.id] ?? '',
      expected: t.hint,
    }));
    try {
      const evaluation = await api.classroomEvaluate(config, items, config.topic);
      setHomeworkEvaluation(evaluation);
      const correct = evaluation.items.filter((i) => i.correct).length;
      await awardXp({
        xp_delta: 15,
        action: 'homework',
        topic: config.topic,
        homework_correct: correct,
        homework_total: evaluation.items.length,
      });
    } catch (err) {
      toast({ title: 'Could not evaluate homework', description: String((err as Error).message), variant: 'error' });
    }
  }, [homework, homeworkAnswers, config, awardXp, toast]);

  const onMic = useCallback(() => {
    if (voice.listening) {
      voice.stopListening();
      return;
    }
    voice.startListening(
      (text) => {
        if (text) sendMessage(text);
      },
      {
        handsFree: handsFreeMode,
        onInterimTranscript: (text) => {
          const signal = estimateConversationSignal(text);
          setConversationSignal(signal);
          setAvatarState(signal.avatarState);
        },
      },
    );
  }, [voice, sendMessage, handsFreeMode]);

  const startAutonomousLesson = useCallback(async () => {
    if (!config.topic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic to begin the lesson.', variant: 'error' });
      return;
    }
    try {
      setStreaming(true);
      setAvatarState('greeting');
      const result = await api.startAutonomousLesson(config, config.topic);
      dispatch(setAutonomousSession({ id: result.session_id, config }));
      setAutonomousSessionId(result.session_id);
      setAutonomousStage(result.stage || 'greeting');
      setAutonomousProgress(result.progress_percent || 0);
      setStarted(true);
      setPaused(false);
      setTab('chat');
      setNotes(null);
      setQuiz(null);
      setQuizAnswers({});
      setQuizEval(null);
      setHomework(null);
      setHomeworkAnswers({});
      setHomeworkEvaluation(null);
      setPendingResume(null);
      await awardXp({ xp_delta: 10, action: 'practice', topic: config.topic });

      const content = result.content || result.message || 'Welcome! Let\'s start learning.';
      setTeacherText(typeof content === 'string' ? content : JSON.stringify(content));
      setMessages([{ id: createClientId(), role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) }]);
      speakCaption(typeof content === 'string' ? content : JSON.stringify(content));
      setStreaming(false);
    } catch (err) {
      setStreaming(false);
      toast({
        title: 'Could not start autonomous lesson',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      });
    }
  }, [config, speakCaption, toast, awardXp]);

  const continueAutonomousLesson = useCallback(async (studentInput?: string) => {
    if (!autonomousSessionId) return;
    try {
      const request = studentInput?.trim();
      if (request) {
        setMessages((m) => [...m, { id: createClientId(), role: 'user', content: request }]);
      }
      setStudentInput('');
      setStreaming(true);
      setAvatarState('explaining');
      const result = await api.continueAutonomousLesson(autonomousSessionId, request);
      setAutonomousStage(result.stage || null);
      setAutonomousProgress(result.progress_percent || 0);
      const content = result.content || result.message || 'Continuing...';
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      setTeacherText(text);
      setMessages((m) => [...m, { id: createClientId(), role: 'assistant', content: text }]);
      speakCaption(text);
      setAvatarState(result.is_completed ? 'celebrating' : 'encouraging');
      setLessonPhase(result.resume_lesson ? 'clarifying' : result.is_completed ? 'completed' : 'awaiting_doubt');
      setStreaming(false);

      if (result.is_completed) {
        await awardXp({ xp_delta: 25, action: 'practice', topic: config.topic });
      }
    } catch (err) {
      setStreaming(false);
      toast({
        title: 'Lesson error',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      });
    }
  }, [autonomousSessionId, config.topic, speakCaption, toast, awardXp]);

  const pauseAutonomousLesson = useCallback(async () => {
    if (!autonomousSessionId) return;
    try {
      await api.pauseAutonomousLesson(autonomousSessionId);
      setPaused(true);
      setAvatarState('idle');
      voice.stop();
    } catch {
      toast({ title: 'Could not pause lesson', variant: 'error' });
    }
  }, [autonomousSessionId, voice, toast]);

  const resumeAutonomousLesson = useCallback(async () => {
    if (!autonomousSessionId) return;
    try {
      setPaused(false);
      setAvatarState('explaining');
      const result = await api.resumeAutonomousLesson(autonomousSessionId);
      setAutonomousStage(result.stage || null);
      setAutonomousProgress(result.progress_percent || 0);
      const content = result.content || result.message || 'Resuming lesson...';
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      setTeacherText(text);
      setMessages((m) => [...m, { id: createClientId(), role: 'assistant', content: text }]);
      speakCaption(text);
    } catch {
      toast({ title: 'Could not resume lesson', variant: 'error' });
    }
  }, [autonomousSessionId, speakCaption, toast]);

  return {
    config,
    setConfig,
    started,
    setStarted,
    conversationId,
    setConversationId,
    messages,
    teacherText,
    streaming,
    avatarState,
    setAvatarState,
    caption,
    captionChar,
    lesson,
    currentStep,
    setCurrentStep,
    lessonPhase,
    lessonPlanText,
    paused,
    tab,
    setTab,
    studentInput,
    setStudentInput,
    ttsEnabled,
    setTtsEnabled,
    voiceSpeed,
    setVoiceSpeed,
    handsFreeMode,
    setHandsFreeMode,
    languages,
    scrollRef,
    voice,
    conversationSignal,
    progress,
    notes,
    notesLoading,
    quiz,
    quizLoading,
    quizAnswers,
    setQuizAnswers,
    quizEval,
    homework,
    homeworkLoading,
    homeworkAnswers,
    setHomeworkAnswers,
    homeworkEval,
    busy,
    sendMessage,
    startLesson,
    startAutonomousLesson,
    continueAutonomousLesson,
    pauseAutonomousLesson,
    resumeAutonomousLesson,
    acceptLessonPlan,
    stopTeaching,
    resumeTeaching,
    quickAction,
    generateNotes,
    generateQuiz,
    submitQuiz,
    generateHomework,
    submitHomework,
    onMic,
    autonomousSessionId,
    autonomousStage,
    autonomousProgress,
    avatarMode,
    setAvatarMode,
    avatarEngine: avatarEngineRef.current,
  };
}
