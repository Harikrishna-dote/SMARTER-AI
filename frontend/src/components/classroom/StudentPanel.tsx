import {
  Turtle,
  Lightbulb,
  BookOpen,
  ListChecks,
  FileText,
  PenLine,
  StretchHorizontal,
  Sparkles,
  Repeat,
  Hand,
  Send,
  Square,
  Play,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { GlassCard } from '../ui/primitives';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useVoice } from '../../hooks/useVoice';

interface StudentPanelProps {
  studentInput: string;
  setStudentInput: React.Dispatch<React.SetStateAction<string>>;
  onSend: (text: string) => void;
  busy: boolean;
  onQuickAction: (kind: string) => void;
  onGenerateQuiz: () => void;
  onGenerateHomework: () => void;
  onGenerateNotes: () => void;
  onMic: () => void;
  onStop?: () => void;
  streaming?: boolean;
  voice: ReturnType<typeof useVoice>;
}

const QUICK_ACTIONS = [
  { k: 'start', label: 'Start', icon: Play },
  { k: 'understood', label: 'Understood', icon: CheckCircle2 },
  { k: 'next', label: 'Next', icon: ArrowRight },
  { k: 'doubt', label: 'Doubt', icon: Hand },
  { k: 'slower', label: 'Slower', icon: Turtle },
  { k: 'example', label: 'Example', icon: Lightbulb },
  { k: 'summary', label: 'Summary', icon: BookOpen },
  { k: 'quiz', label: 'Quiz', icon: ListChecks, action: 'quiz' as const },
  { k: 'homework', label: 'Homework', icon: FileText, action: 'homework' as const },
  { k: 'notes', label: 'Notes', icon: PenLine, action: 'notes' as const },
  { k: 'diagram', label: 'Diagram', icon: StretchHorizontal },
  { k: 'code', label: 'Code', icon: Sparkles },
  { k: 'revision', label: 'Revise', icon: Repeat },
];

export function StudentPanel({
  studentInput,
  setStudentInput,
  onSend,
  busy,
  onQuickAction,
  onGenerateQuiz,
  onGenerateHomework,
  onGenerateNotes,
  onMic,
  onStop,
  streaming = false,
  voice,
}: StudentPanelProps) {
  return (
    <GlassCard className="p-3">
      {streaming && onStop && (
        <div className="mb-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            leftIcon={<Square size={16} />}
            onClick={onStop}
            className="border-coral/40 text-coral hover:bg-coral/10"
          >
            Stop teaching
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((b) => {
          const Icon = b.icon;
          return (
            <button
              key={b.k}
              onClick={() => {
                if (b.action === 'quiz') onGenerateQuiz();
                else if (b.action === 'homework') onGenerateHomework();
                else if (b.action === 'notes') onGenerateNotes();
                else onQuickAction(b.k);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-brand-400/10 hover:text-brand-700 dark:border-white/10 dark:text-slate-300"
            >
              <Icon size={14} /> {b.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Input
          placeholder="Type start, understood, next, or ask a doubt..."
          value={studentInput}
          onChange={(e) => setStudentInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend(studentInput);
          }}
          rightSlot={
            <button
              onClick={() => onSend(studentInput)}
              disabled={busy}
              className="rounded-lg p-1.5 text-brand-500 hover:bg-brand-400/10"
            >
              <Send size={16} />
            </button>
          }
        />
        <Button variant="secondary" size="md" onClick={onMic} disabled={!voice.recognitionSupported} leftIcon={<Hand size={16} />}>
          Hand
        </Button>
      </div>
    </GlassCard>
  );
}
