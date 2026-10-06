import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setActiveConversationId } from '../store/chatSlice';
import {
  Bot,
  Copy,
  Mic,
  Plus,
  Send,
  Sparkles,
  Square,
  User as UserIcon,
  FileUp,
  Image as ImageIcon,
  TextCursorInput,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { useVoice } from '../hooks/useVoice';
import { cn } from '../lib/utils';
import { AIResponseRenderer } from '../components/chat/AIResponseRenderer';
import { appendStreamChunk } from '../lib/responseFormatting';
import type { Message, TeachingMode } from '../lib/types';

const MODES: { value: TeachingMode; label: string }[] = [
  { value: 'explain', label: 'Explain' },
  { value: 'solve', label: 'Solve' },
  { value: 'practice', label: 'Practice' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'revise', label: 'Revise' },
  { value: 'translate', label: 'Translate' },
];

type TutorLanguage = 'English' | 'Telugu' | 'Bilingual';

interface UiMessage extends Message {
  streaming?: boolean;
}

function isMessage(value: unknown): value is Message {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Message).id === 'string' &&
      typeof (value as Message).role === 'string' &&
      typeof (value as Message).content === 'string',
  );
}

function spokenLanguageForText(text: string, preferred: string): string {
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (preferred === 'bilingual' || (hasTelugu && hasLatin)) return 'bilingual';
  if (preferred === 'te' || hasTelugu) return 'te';
  return 'en';
}

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const dispatch = useDispatch();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(params.get('conversation'));

  useEffect(() => {
    dispatch(setActiveConversationId(activeId));
    return () => { dispatch(setActiveConversationId(null)); };
  }, [activeId, dispatch]);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<TeachingMode>('explain');
  const [speed, setSpeed] = useState<'instant' | 'balanced' | 'deep'>('instant');
  const [tutorLanguage, setTutorLanguage] = useState<TutorLanguage>('English');
  const [voiceOutput, setVoiceOutput] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [showInputOptions, setShowInputOptions] = useState(false);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);

  const speechLanguage = tutorLanguage === 'Telugu' ? 'te' : tutorLanguage === 'Bilingual' ? 'bilingual' : 'en';
  const voice = useVoice(speechLanguage);
  const recording = voice.listening;

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const paramId = params.get('conversation');
    setActiveId(paramId);
  }, [params]);

  const messagesCache = useRef<Record<string, UiMessage[]>>({});

  const loadMessages = useCallback(
    async (id: string) => {
      // If cached, show immediately
      if (messagesCache.current[id]) {
        setMessages(messagesCache.current[id]);
      } else {
        setMessages([]);
      }
      
      try {
        const msgs = await api.listMessages(id);
        const formattedMsgs = msgs.map((m) => ({ ...m, streaming: false }));
        messagesCache.current[id] = formattedMsgs;
        setMessages(formattedMsgs);
      } catch (err) {
        if (!messagesCache.current[id]) setMessages([]);
        const message = err instanceof Error ? err.message : 'Could not load messages.';
        toast({ title: 'Conversation unavailable', description: message, variant: 'error' });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  const send = useCallback(async (directText?: string) => {
    const text = (directText ?? input).trim();
    if (!text || streaming) return;
    const speechRate = /\b(slow|slower|slowly|slow\s+ga)\b/i.test(text) ? 0.75 : /\b(fast|faster|quickly)\b/i.test(text) ? 1.2 : 1;

    let convId = activeId;
    const assistantId = `local-assistant-${Date.now()}`;
    let placeholderAdded = false;

    try {
      if (!convId) {
        const c = await api.createConversation('New conversation');
        convId = c.id;
        setParams({ conversation: c.id }, { replace: true });
        setActiveId(c.id);
      }

      setInput('');
      const documentId = pendingDocumentId;
      setPendingDocumentId(null);
      const now = new Date().toISOString();
      const userMsg: UiMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        metadata: {},
        created_at: now,
      };
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        metadata: {},
        created_at: now,
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      placeholderAdded = true;

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      for await (const evt of api.streamMessage(
        convId,
        {
          message: text,
          tutor: { teaching_mode: mode, response_speed: speed, language: tutorLanguage },
          use_memory: true,
          document_id: documentId ?? undefined,
          voice_response: voiceOutput,
        },
        controller.signal,
      )) {
        if (evt.type === 'token' && typeof evt.content === 'string') {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: appendStreamChunk(m.content, evt.content) } : m)),
          );
        }
 else if (evt.type === 'error') {
          const message = typeof evt.message === 'string' ? evt.message : 'An error occurred.';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: message, streaming: false }
                : m,
            ),
          );
        } else if (evt.type === 'done' && isMessage(evt.message)) {
          const finalMsg = evt.message;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...finalMsg, streaming: false } : m)),
          );
          if (voiceOutput && finalMsg.content.trim()) void voice.speak(finalMsg.content, { language: spokenLanguageForText(finalMsg.content, speechLanguage), rate: speechRate });
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errorMessage = err instanceof Error ? err.message : 'Connection failed.';
        if (placeholderAdded) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${errorMessage}`, streaming: false } : m)),
          );
        } else {
          setInput(text);
        }
        toast({ title: 'Message failed', description: errorMessage, variant: 'error' });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, activeId, mode, speed, tutorLanguage, voiceOutput, voice, speechLanguage, pendingDocumentId, setParams, toast]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    voice.stopListening();
    voice.stop();
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }, [voice]);

  const toggleVoice = useCallback(() => {
    if (!voice.supported) {
      toast({ title: 'Voice input not supported', description: 'Allow microphone access or try a Chromium-based browser.', variant: 'error' });
      return;
    }
    if (recording) {
      voice.stopListening();
      return;
    }
    voice.startListening(
      (transcript) => setInput((prev) => (prev ? `${prev} ${transcript}` : transcript)),
    );
  }, [recording, toast, voice]);

  const toggleVoiceOutput = useCallback(() => {
    if (voice.speaking) voice.stop();
    setVoiceOutput((enabled) => !enabled);
  }, [voice]);

  const handleUpload = useCallback(async (file: File) => {
    try {
      setShowInputOptions(false);
      const doc = await api.uploadDocument(file);
      toast({ title: 'File uploaded', description: `Analysing: ${doc.filename}`, variant: 'info' });
      setPendingDocumentId(doc.id);
      setInput(`Analyse this document: ${doc.filename}`);
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    }
  }, [toast]);

  const handleScan = useCallback(async (file: File) => {
    try {
      setShowInputOptions(false);
      const text = await api.ocr(file);
      setInput(`Analyse this scanned text: ${text.substring(0, 100)}...`);
    } catch {
      toast({ title: 'Scan failed', variant: 'error' });
    }
  }, [toast]);

  return (
    <div className="flex h-full min-h-0 w-full bg-white dark:bg-[#212121]">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* ChatGPT Style Clean Top Navigation */}
        <div className="flex h-14 items-center justify-between border-b border-black/10 px-4 dark:border-white/10 bg-white dark:bg-[#212121] z-10">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10 transition"
              >
                <span className="grid h-6 w-6 place-medium place-items-center rounded bg-emerald-600 text-white text-xs">
                  <Sparkles size={14} />
                </span>
                <span>AI Tutor ({mode.charAt(0).toUpperCase() + mode.slice(1)})</span>
                <span className="text-xs text-slate-400">▾</span>
              </button>
              {/* Dropdown for Modes */}
              <div className="absolute left-0 top-full mt-1 hidden w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl group-hover:block dark:border-white/10 dark:bg-[#2f3036] z-50">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition',
                      mode === m.value
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
                    )}
                  >
                    <span>{m.label}</span>
                    {mode === m.value && <span className="text-[10px]">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed & Language selectors tucked cleanly */}
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value as 'instant' | 'balanced' | 'deep')}
              aria-label="Response speed"
              className="h-8 rounded-md border border-black/10 bg-transparent px-2 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <option value="instant" className="dark:bg-[#2f3036]">Instant</option>
              <option value="balanced" className="dark:bg-[#2f3036]">Balanced</option>
              <option value="deep" className="dark:bg-[#2f3036]">Deep</option>
            </select>

            <select
              value={tutorLanguage}
              onChange={(event) => setTutorLanguage(event.target.value as TutorLanguage)}
              aria-label="Tutor language"
              className="h-8 rounded-md border border-black/10 bg-transparent px-2 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <option value="English" className="dark:bg-[#2f3036]">English</option>
              <option value="Telugu" className="dark:bg-[#2f3036]">తెలుగు</option>
              <option value="Bilingual" className="dark:bg-[#2f3036]">Bilingual</option>
            </select>

            <IconButton
              onClick={toggleVoiceOutput}
              active={voiceOutput}
              label={voiceOutput ? 'Voice output on' : 'Voice output off'}
            >
              {voiceOutput ? <Volume2 size={16} className={voice.speaking ? 'animate-pulse' : undefined} /> : <VolumeX size={16} />}
            </IconButton>
          </div>
        </div>

        <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyThread onPrompt={setInput} />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onCopy={() => toast({ title: 'Copied', variant: 'success' })}
                  onSpeak={() => voice.speak(m.content, { language: spokenLanguageForText(m.content, speechLanguage) })}
                />
              ))}
            </div>
          )}
        </div>

        {/* ChatGPT Style Bottom Input Bar */}
        <div className="safe-bottom border-t border-transparent bg-white px-3 py-3 sm:px-4 sm:py-4 dark:bg-[#212121]">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex flex-col rounded-2xl border border-black/15 bg-white shadow-lg dark:border-white/15 dark:bg-[#2f3036] px-4 py-3 focus-within:border-emerald-500">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message AI Tutor..."
                className="max-h-40 min-h-10 w-full resize-none bg-transparent text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              
              <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button 
                      type="button"
                      className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 transition"
                      onClick={() => setShowInputOptions(!showInputOptions)}
                      title="Attach file or image"
                      aria-label="Attach file or image"
                    >
                      <Plus size={18} />
                    </button>
                    {showInputOptions && (
                       <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 dark:border-white/10 dark:bg-[#2f3036]">
                         <label className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer dark:text-slate-200 dark:hover:bg-white/10">
                             <FileUp size={15}/> Upload File
                             <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                         </label>
                         <label className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer dark:text-slate-200 dark:hover:bg-white/10">
                             <ImageIcon size={15}/> Upload Image
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                         </label>
                         <label className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer dark:text-slate-200 dark:hover:bg-white/10">
                             <TextCursorInput size={15}/> Scan Text
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleScan(e.target.files[0])} />
                         </label>
                       </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-lg transition',
                      recording ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
                    )}
                    title={recording ? 'Stop listening' : 'Voice input'}
                      aria-label={recording ? 'Stop listening' : 'Voice input'}
                  >
                    <Mic size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">ChatGPT style pure tutor</span>
                  {streaming ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="grid h-11 w-11 place-items-center rounded-lg bg-rose-600 text-white transition hover:bg-rose-700"
                      aria-label="Stop generation"
                    >
                      <Square size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={!input.trim()}
                      className="grid h-11 w-11 place-items-center rounded-lg bg-black text-white hover:opacity-80 disabled:opacity-30 dark:bg-white dark:text-slate-950 transition"
                      aria-label="Send message"
                    >
                      <Send size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function IconButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-lg border transition-colors',
        active
          ? 'border-coral bg-coral/10 text-coral'
          : 'border-black/10 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-[#2f3036] dark:text-slate-300 dark:hover:bg-white/10',
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function EmptyThread({ onPrompt }: { onPrompt: (value: string) => void }) {
  const examples = [
    'Teach neural networks in Telugu',
    'Create a quiz on photosynthesis',
    'Explain recursion with a visual example',
    'Make a weekly roadmap for Python',
  ];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-emerald-600 text-white">
          <Bot size={24} />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">How can I help you learn?</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ask for a lesson, quiz, translation, coding help, or a personalized study plan.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {examples.map((example) => (
          <button
            type="button"
            key={example}
            onClick={() => onPrompt(example)}
            className="focus-ring min-h-14 rounded-lg border border-black/10 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/10 dark:bg-[#202123] dark:text-slate-200 dark:hover:bg-[#2f3036]"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      {children}
    </span>
  );
}

function MessageBubble({ message, onCopy, onSpeak }: { message: UiMessage; onCopy: () => void; onSpeak: () => void }) {
  const isUser = message.role === 'user';
  const speed = (message.metadata?.response_speed as string) ?? null;

  return (
    <div className={cn('group flex gap-3 border-b border-black/5 py-5 last:border-b-0 dark:border-white/10', isUser && 'justify-end border-b-0 py-3')}>
      {!isUser && (
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-emerald-600 text-white">
          <Bot size={16} />
        </span>
      )}
      <div className={cn('min-w-0', isUser ? 'max-w-[82%]' : 'flex-1')}>
        <div
          className={cn(
            'text-sm leading-7',
            isUser
              ? 'whitespace-pre-wrap rounded-2xl bg-[#f4f4f4] px-4 py-2.5 text-slate-950 dark:bg-[#2f3036] dark:text-slate-100'
              : 'text-slate-900 dark:text-slate-100',
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <AIResponseRenderer content={message.content} streaming={message.streaming} />
          )}
        </div>
        {!isUser && message.content && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            {speed && <MiniBadge>{speed}</MiniBadge>}
            {!!message.metadata?.total_seconds && (
              <span>{Number(message.metadata.total_seconds).toFixed(1)}s</span>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(message.content);
                onCopy();
              }}
              className="focus-ring grid h-9 w-9 place-items-center rounded-md opacity-100 transition-opacity hover:bg-slate-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-white/10"
              aria-label="Copy"
              title="Copy"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={onSpeak}
              className="focus-ring grid h-9 w-9 place-items-center rounded-md opacity-100 transition-opacity hover:bg-slate-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-white/10"
              aria-label="Read answer aloud"
              title="Read answer aloud"
            >
              <Volume2 size={13} />
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300">
          <UserIcon size={16} />
        </span>
      )}
    </div>
  );
}
