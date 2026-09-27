import { StretchHorizontal } from 'lucide-react';
import { GlassCard, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { GeneratedLesson } from '../../lib/types';

interface LessonTimelineProps {
  lesson: GeneratedLesson;
  currentStep: number;
  onMarkStep: () => void;
  onNext: () => void;
}

export function LessonTimeline({ lesson, currentStep, onMarkStep, onNext }: LessonTimelineProps) {
  return (
    <GlassCard className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <StretchHorizontal size={16} className="text-brand-400" /> Lesson timeline
        </p>
        <span className="text-xs text-slate-400">
          {lesson.estimated_minutes} min · <Badge tone="sky">{lesson.difficulty}</Badge>
        </span>
      </div>
      <ol className="space-y-2">
        {lesson.outline.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                i === currentStep
                  ? 'bg-brand-gradient text-white'
                  : i < currentStep
                    ? 'bg-brand-400/20 text-brand-300'
                    : 'bg-black/10 text-slate-400 dark:bg-white/10',
              )}
            >
              {i + 1}
            </span>
            <div>
              <p className={cn('text-sm font-medium', i === currentStep && 'text-brand-300')}>{step.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{step.content}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onMarkStep}>
          Mark step done
        </Button>
        <Button size="sm" onClick={onNext}>
          Next concept
        </Button>
      </div>
    </GlassCard>
  );
}
