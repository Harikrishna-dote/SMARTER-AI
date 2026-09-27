import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  FileText,
  Brain,
  Bot,
  ArrowUpRight,
  Sparkles,
  Plus,
  GraduationCap,
  Trophy,
  Flame,
  BookOpen,
  Users,
} from 'lucide-react';
import { Badge, GlassCard, PageHeader, Spinner, EmptyState } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';
import type { ClassroomProgress, Conversation, DashboardStats, LearningClass } from '../lib/types';

const statConfig = [
  { key: 'conversations', label: 'Conversations', icon: MessageSquare, to: '/chat', tone: 'text-brand-400' },
  { key: 'documents', label: 'Documents', icon: FileText, to: '/documents', tone: 'text-sky' },
  { key: 'memories', label: 'Memories', icon: Brain, to: '/memory', tone: 'text-amber' },
  { key: 'agents', label: 'Agents', icon: Bot, to: '/agents', tone: 'text-coral' },
] as const;

const quickActions = [
  { label: 'New chat', icon: MessageSquare, to: '/chat', desc: 'Ask your tutor anything' },
  { label: 'AI Tutor Classroom', icon: GraduationCap, to: '/classroom', desc: 'Join a live AI teacher class' },
  { label: 'Translate', icon: ArrowUpRight, to: '/translate', desc: 'Convert & refine text' },
  { label: 'Upload doc', icon: FileText, to: '/documents', desc: 'Query your files' },
  { label: 'Build agent', icon: Bot, to: '/agents', desc: 'Automate a workflow' },
  { label: 'Study Groups', icon: Users, to: '/study-groups', desc: 'Collaborate with peers' },
  { label: 'Projects', icon: BookOpen, to: '/projects', desc: 'Build & showcase work' },
  { label: 'Career Coach', icon: Trophy, to: '/career', desc: 'Career guidance & interview prep' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [progress, setProgress] = useState<ClassroomProgress | null>(null);
  const [learningClasses, setLearningClasses] = useState<LearningClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, c, p, classes] = await Promise.all([
          api.dashboard(),
          api.listConversations(),
          api.classroomProgress().catch(() => null),
          api.listLearningClasses().catch(() => []),
        ]);
        if (!active) return;
        setStats(s);
        setRecent(c.slice(0, 5));
        setProgress(p);
        setLearningClasses(classes as LearningClass[]);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.full_name.split(' ')[0] ?? 'learner'}`}
        subtitle="Here’s what’s happening across your workspace."
        actions={
          <Link to="/chat">
            <Button leftIcon={<Plus size={16} />}>New chat</Button>
          </Link>
        }
      />

      {/* Gamification Stats */}
      {progress && (
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber/15 text-amber">
                <Trophy size={20} />
              </span>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Level {progress.level}</p>
                <p className="font-display text-xl font-bold">{progress.xp} XP</p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-2 rounded-full bg-amber transition-all"
                style={{ width: `${Math.min(100, (progress.xp_into_level / progress.xp_for_next_level) * 100)}%` }}
              />
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral/15 text-coral">
                <Flame size={20} />
              </span>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Streak</p>
                <p className="font-display text-xl font-bold">{progress.streak} days</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400/15 text-brand-500">
                <GraduationCap size={20} />
              </span>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Accuracy</p>
                <p className="font-display text-xl font-bold">{progress.accuracy}%</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {learningClasses.length > 0 && (
        <GlassCard className="border-brand-400/20 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><GraduationCap size={18} className="text-brand-400" />Continue a prepared class</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your classroom remembers the prepared route and last checkpoint.</p>
            </div>
            <Link to="/classroom" className="text-sm font-medium text-brand-500 hover:underline">Manage classes</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {learningClasses.slice(0, 3).map((learningClass) => {
              const checkpoint = learningClass.checkpoint;
              const sceneCount = learningClass.prepared_content.board_scenes?.length ?? 0;
              const progress = typeof checkpoint.lesson_progress === 'number'
                ? checkpoint.lesson_progress
                : sceneCount > 0
                  ? Math.round(((learningClass.current_lesson + 1) / sceneCount) * 100)
                  : 0;
              const masteryValues = checkpoint.mastery && typeof checkpoint.mastery === 'object'
                ? Object.values(checkpoint.mastery).filter((value): value is number => typeof value === 'number')
                : [];
              const mastery = masteryValues.length ? Math.round(masteryValues.map((value) => value <= 1 ? value * 100 : value).reduce((sum, value) => sum + value, 0) / masteryValues.length) : null;
              const estimatedMinutes = learningClass.prepared_content.lesson?.estimated_minutes;
              const remainingMinutes = typeof estimatedMinutes === 'number' ? Math.max(0, Math.ceil(estimatedMinutes * (1 - progress / 100))) : null;
              const visualState = checkpoint.visual_state && typeof checkpoint.visual_state === 'object' ? checkpoint.visual_state : {};
              const visualLabel = typeof visualState.title === 'string'
                ? visualState.title
                : typeof visualState.visual_type === 'string'
                  ? visualState.visual_type.replace(/_/g, ' ')
                  : typeof checkpoint.current_visual_scene === 'string'
                    ? checkpoint.current_visual_scene
                    : null;
              const voiceSettings = checkpoint.voice_settings && typeof checkpoint.voice_settings === 'object' ? checkpoint.voice_settings : {};
              const voiceParts = [
                typeof voiceSettings.language === 'string' ? voiceSettings.language : null,
                typeof voiceSettings.provider === 'string' ? voiceSettings.provider : null,
                typeof voiceSettings.rate === 'number' ? `${voiceSettings.rate.toFixed(1)}x` : null,
              ].filter((value): value is string => Boolean(value));
              return (
              <Link key={learningClass.id} to={`/classroom?class=${encodeURIComponent(learningClass.id)}&resume=1`} className="rounded-xl border border-black/10 p-3 transition hover:border-brand-400/50 dark:border-white/10">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{learningClass.subject}</span><Badge tone={learningClass.status === 'ready' ? 'brand' : 'neutral'}>{learningClass.status}</Badge></div>
                <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{checkpoint.current_concept || checkpoint.stage || learningClass.curriculum.slice(0, 2).join(' · ') || learningClass.goal}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400"><span>Lesson {learningClass.current_lesson + 1} · {progress}%</span><span>{mastery === null ? 'Mastery pending' : `Mastery ${mastery}%`}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-black/5 dark:bg-white/10"><div className="h-1.5 rounded-full bg-brand-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{remainingMinutes === null ? 'Prepared lesson' : `${remainingMinutes} min remaining`}</p>
                {visualLabel && <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">Visual: {visualLabel} Â· Animation {Math.max(0, Math.floor((checkpoint.animation_time ?? 0) / 1000))}s</p>}
                {voiceParts.length > 0 && <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">Voice: {voiceParts.join(' Â· ')}</p>}
                <p className="mt-2 text-xs font-medium text-brand-500">Continue exact checkpoint <ArrowUpRight size={13} className="inline" /></p>
              </Link>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <GlassCard key={i} className="h-28 animate-pulse" />
            ))
          : statConfig.map((s, i) => {
              const Icon = s.icon;
              const value = stats?.[s.key] ?? 0;
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={s.to}>
                    <GlassCard hover className="h-full p-5">
                      <div className="flex items-center justify-between">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl bg-white/10 ${s.tone}`}>
                          <Icon size={19} />
                        </span>
                        <ArrowUpRight size={16} className="text-slate-400" />
                      </div>
                      <p className="mt-4 font-display text-3xl font-bold">{value}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
                    </GlassCard>
                  </Link>
                </motion.div>
              );
            })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <GlassCard className="p-5 lg:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles size={18} className="text-brand-400" /> Quick actions
          </h2>
          <div className="grid gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.label} to={a.to}>
                  <div className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-brand-400/30 hover:bg-brand-400/5">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-400/15 text-brand-500">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="truncate text-xs text-slate-400">{a.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </GlassCard>

        {/* Recent conversations */}
        <GlassCard className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <MessageSquare size={18} className="text-brand-400" /> Recent conversations
            </h2>
            <Link to="/chat" className="text-sm font-medium text-brand-500 hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size={24} className="text-brand-400" />
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={28} />}
              title="No conversations yet"
              description="Start a chat with your AI tutor to see it here."
              action={
                <Link to="/chat">
                  <Button size="sm" leftIcon={<Plus size={15} />}>
                    Start chatting
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {recent.map((c) => (
                <Link key={c.id} to={`/chat?conversation=${c.id}`}>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 transition-all hover:border-brand-400/30 hover:bg-brand-400/5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-400">
                        <MessageSquare size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-slate-400">{formatRelativeTime(c.updated_at)}</p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
