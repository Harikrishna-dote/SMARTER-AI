import { FileText } from 'lucide-react';
import { Spinner, EmptyState, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Input';
import { cn } from '../../lib/utils';
import type { GeneratedHomework, HomeworkEvaluation } from '../../lib/types';

interface HomeworkPanelProps {
  homework: GeneratedHomework | null;
  loading: boolean;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  evaluation: HomeworkEvaluation | null;
  onGenerate: () => void;
  onSubmit: () => void;
}

export function HomeworkPanel({
  homework,
  loading,
  answers,
  setAnswers,
  evaluation,
  onGenerate,
  onSubmit,
}: HomeworkPanelProps) {
  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (!homework)
    return (
      <EmptyState
        icon={<FileText size={28} />}
        title="No homework yet"
        description="Get personalized practice."
        action={<Button size="sm" onClick={onGenerate}>Generate homework</Button>}
      />
    );
  return (
    <div className="space-y-4">
      {homework.tasks.map((t) => (
        <div key={t.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
          <p className="text-sm">{t.question}</p>
          {t.hint && <p className="mt-1 text-xs text-slate-400">Hint: {t.hint}</p>}
          <TextArea
            className="mt-2"
            rows={2}
            placeholder="Your answer"
            value={answers[t.id] ?? ''}
            onChange={(v) => setAnswers((a) => ({ ...a, [t.id]: v }))}
          />
          {evaluation && (
            <p
              className={cn(
                'mt-1 text-xs',
                evaluation.items.find((i) => i.question === t.question)?.correct ? 'text-brand-400' : 'text-coral',
              )}
            >
              {evaluation.items.find((i) => i.question === t.question)?.feedback}
            </p>
          )}
        </div>
      ))}
      {evaluation ? (
        <Badge tone={evaluation.overall_score >= 70 ? 'brand' : 'coral'}>Score: {evaluation.overall_score}%</Badge>
      ) : (
        <Button size="sm" onClick={onSubmit} disabled={Object.keys(answers).length === 0}>
          Submit homework
        </Button>
      )}
    </div>
  );
}
