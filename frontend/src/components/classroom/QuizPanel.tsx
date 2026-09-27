import { ListChecks } from 'lucide-react';
import { Spinner, EmptyState, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';
import type { GeneratedQuiz, HomeworkEvaluation } from '../../lib/types';

interface QuizPanelProps {
  quiz: GeneratedQuiz | null;
  loading: boolean;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  evaluation: HomeworkEvaluation | null;
  onGenerate: () => void;
  onSubmit: () => void;
}

export function QuizPanel({
  quiz,
  loading,
  answers,
  setAnswers,
  evaluation,
  onGenerate,
  onSubmit,
}: QuizPanelProps) {
  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (!quiz)
    return (
      <EmptyState
        icon={<ListChecks size={28} />}
        title="No quiz yet"
        description="Test your understanding."
        action={<Button size="sm" onClick={onGenerate}>Generate quiz</Button>}
      />
    );
  return (
    <div className="space-y-4">
      {quiz.questions.map((q) => (
        <div key={q.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
          <p className="mb-2 text-sm font-medium">{q.question}</p>
          <div className="space-y-1">
            {q.options.length > 0 ? (
              q.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                  {opt}
                </label>
              ))
            ) : (
              <Input
                placeholder="Your answer"
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
          </div>
          {evaluation && (
            <p
              className={cn(
                'mt-2 text-xs',
                evaluation.items.find((i) => i.question === q.question)?.correct ? 'text-brand-400' : 'text-coral',
              )}
            >
              {evaluation.items.find((i) => i.question === q.question)?.feedback}
            </p>
          )}
        </div>
      ))}
      {evaluation ? (
        <Badge tone={evaluation.overall_score >= 70 ? 'brand' : 'coral'}>Score: {evaluation.overall_score}%</Badge>
      ) : (
        <Button size="sm" onClick={onSubmit} disabled={Object.keys(answers).length === 0}>
          Submit quiz
        </Button>
      )}
    </div>
  );
}
