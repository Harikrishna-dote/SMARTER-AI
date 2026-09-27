import { motion } from 'framer-motion';
import { Trophy, Target, BookOpen, BrainCircuit } from 'lucide-react';
import { Badge, EmptyState } from '../ui/primitives';
import type { ClassroomProgress } from '../../lib/types';

interface ProgressPanelProps {
  progress: ClassroomProgress | null;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>
        <Icon size={20} className={color.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export function ProgressPanel({ progress }: ProgressPanelProps) {
  if (!progress)
    return <EmptyState icon={<Trophy size={28} />} title="No progress yet" description="Complete lessons to earn XP." />;
    
  const pct = Math.round((progress.xp_into_level / progress.xp_for_next_level) * 100);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Current Level</p>
          <p className="text-4xl font-bold">{progress.level}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Total XP</p>
          <p className="text-xl font-bold">{progress.xp}</p>
        </div>
      </div>
      
      <div className="h-3 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <motion.div className="h-full bg-brand-gradient" animate={{ width: `${pct}%` }} />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Target} label="Accuracy" value={`${progress.accuracy}%`} color="bg-brand-500" />
        <StatCard icon={Trophy} label="Streak" value={`${progress.streak} days`} color="bg-amber-500" />
        <StatCard icon={BookOpen} label="Topics" value={String(progress.topics_completed.length)} color="bg-sky-500" />
        <StatCard icon={BrainCircuit} label="Mastery" value={progress.strong_topics.length > 0 ? `${Math.round((progress.strong_topics.length / Math.max(1, progress.topics_completed.length)) * 100)}%` : '0%'} color="bg-emerald-500" />
      </div>

      {progress.strong_topics.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Strong topics</p>
          <div className="flex flex-wrap gap-2">
            {progress.strong_topics.map((t) => (
              <Badge key={t} tone="brand">{t}</Badge>
            ))}
          </div>
        </div>
      )}
      
      {progress.weak_topics.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Areas for improvement</p>
          <div className="flex flex-wrap gap-2">
            {progress.weak_topics.map((t) => (
              <Badge key={t} tone="amber">{t}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
