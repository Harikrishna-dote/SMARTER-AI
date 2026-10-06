import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Baby,
  TrendingUp,
  Flame,
  Zap,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  X,
} from 'lucide-react';

import { GlassCard, Badge, Spinner, EmptyState, PageHeader } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { User, StudentProgress } from '../lib/types';

export default function ParentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const children: User[] = [];
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'parent') setLoading(false);
  }, [user?.role]);

  const loadProgress = async (child: User) => {
    setSelectedChild(child);
    setProgressLoading(true);
    setProgress(null);
    try {
      const data = await api.getStudentProgress(child.id);
      setProgress(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load progress';
      toast({ title: 'Could not load progress', description: message, variant: 'error' });
    } finally {
      setProgressLoading(false);
    }
  };

  const avgXp = children.length ? Math.round(children.reduce((sum, c) => sum + (c.xp || 0), 0) / children.length) : 0;
  const avgLevel = children.length ? Math.round(children.reduce((sum, c) => sum + (c.level || 0), 0) / children.length) : 0;
  const avgStreak = children.length ? Math.round(children.reduce((sum, c) => sum + (c.streak || 0), 0) / children.length) : 0;

  if (user?.role !== 'parent') {
    return (
      <div className="flex items-center justify-center py-20">
        <EmptyState
          icon={<Baby size={40} />}
          title="Parent access required"
          description="You need parent privileges to view this dashboard."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title="Parent Dashboard" subtitle="Track your children's learning progress." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400/15 text-brand-700">
              <Users size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{children.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Children</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky/15 text-sky">
              <Zap size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{avgXp.toLocaleString()}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg XP</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber/15 text-amber">
              <TrendingUp size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{avgLevel}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Level</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-coral/15 text-coral">
              <Flame size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{avgStreak}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Streak</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {loading ? (
        <GlassCard className="flex items-center justify-center p-10">
          <Spinner size={28} className="text-brand-400" />
        </GlassCard>
      ) : children.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={<Baby size={32} />}
            title="No children linked"
            description="Parent-child linking is not configured yet. No student data is shown until an explicit relationship is available."
          />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child, index) => (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
            >
              <GlassCard className="h-full p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-sky/15 text-sm font-bold text-sky">
                      {child.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{child.full_name}</p>
                      <p className="text-xs text-slate-500">{child.email}</p>
                    </div>
                  </div>
                  <Badge tone={child.is_active ? 'brand' : 'neutral'}>
                    {child.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-black/5 p-2 text-center dark:border-white/10">
                    <p className="font-display text-lg font-bold text-sky">{child.xp?.toLocaleString() ?? 0}</p>
                    <p className="text-xs text-slate-500">XP</p>
                  </div>
                  <div className="rounded-xl border border-black/5 p-2 text-center dark:border-white/10">
                    <p className="font-display text-lg font-bold text-brand-400">Lvl {child.level ?? 1}</p>
                    <p className="text-xs text-slate-500">Level</p>
                  </div>
                  <div className="rounded-xl border border-black/5 p-2 text-center dark:border-white/10">
                    <p className="font-display text-lg font-bold text-amber">{child.streak ?? 0}</p>
                    <p className="text-xs text-slate-500">Streak</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => loadProgress(child)}
                >
                  View Details <ArrowUpRight size={14} />
                </Button>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {selectedChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedChild(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">{selectedChild.full_name}</h2>
                <p className="text-sm text-slate-500">{selectedChild.email}</p>
              </div>
              <button onClick={() => setSelectedChild(null)} className="rounded-lg p-2 hover:bg-black/5">
                <X size={20} />
              </button>
            </div>
            {progressLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size={28} className="text-brand-400" />
              </div>
            ) : progress ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Experience</p>
                  <p className="font-display text-2xl font-bold text-brand-400">{progress.xp.toLocaleString()}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Level</p>
                  <p className="font-display text-2xl font-bold text-sky">{progress.level}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Accuracy</p>
                  <p className="font-display text-2xl font-bold text-coral">{Math.round(progress.accuracy * 100)}%</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Streak</p>
                  <p className="font-display text-2xl font-bold text-amber">{progress.streak} days</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock size={14} /> Study Time
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold text-brand-400">
                    {Math.floor((progress.total_study_time_minutes || 0) / 60)}h {(progress.total_study_time_minutes || 0) % 60}m
                  </p>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle2 size={14} /> Lessons Completed
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold text-sky">{progress.lessons_completed || 0}</p>
                </GlassCard>
                <GlassCard className="p-4 sm:col-span-2">
                  <p className="text-sm text-slate-500">Weak Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {progress.weak_topics.length > 0 ? (
                      progress.weak_topics.map((topic) => (
                        <Badge key={topic} tone="coral">{topic}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No weak topics. Great job!</p>
                    )}
                  </div>
                </GlassCard>
                <GlassCard className="p-4 sm:col-span-2">
                  <p className="text-sm text-slate-500">Strong Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {progress.strong_topics.length > 0 ? (
                      progress.strong_topics.map((topic) => (
                        <Badge key={topic} tone="brand">{topic}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">Keep learning to discover strong topics!</p>
                    )}
                  </div>
                </GlassCard>
                <GlassCard className="p-4 sm:col-span-2">
                  <p className="text-sm text-slate-500">Achievements</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {progress.badges.length > 0 ? (
                      progress.badges.map((badge) => (
                        <Badge key={badge.id} tone="amber">{badge.label}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No badges earned yet.</p>
                    )}
                  </div>
                </GlassCard>
              </div>
            ) : (
              <EmptyState title="No progress data" description="This child has not started any lessons yet." />
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
