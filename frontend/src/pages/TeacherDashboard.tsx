import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  GraduationCap,
  BookOpen,
  Search,
  Filter,
  X,
  ChevronRight,
  Flame,
  Zap,
  Target,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

import { GlassCard, Badge, Spinner, EmptyState, PageHeader } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { User, StudyGroupResponse, StudentProgress } from '../lib/types';
import { cn } from '../lib/utils';

type Tab = 'students' | 'classes';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<StudyGroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    let active = true;
    (async () => {
      try {
        const [studentsData, classesData] = await Promise.all([
          api.listStudents(),
          api.listClasses(),
        ]);
        if (active) {
          setStudents(studentsData);
          setClasses(classesData);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : 'Failed to load data';
          toast({ title: 'Could not load dashboard', description: message, variant: 'error' });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.role, toast]);

  const loadProgress = async (student: User) => {
    setSelectedStudent(student);
    setProgressLoading(true);
    setProgress(null);
    try {
      const data = await api.getStudentProgress(student.id);
      setProgress(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load progress';
      toast({ title: 'Could not load progress', description: message, variant: 'error' });
    } finally {
      setProgressLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  const totalXp = students.reduce((sum, s) => sum + (s.xp || 0), 0);
  const avgLevel = students.length ? Math.round(students.reduce((sum, s) => sum + (s.level || 0), 0) / students.length) : 0;

  if (user?.role !== 'teacher') {
    return (
      <div className="flex items-center justify-center py-20">
        <EmptyState
          icon={<GraduationCap size={40} />}
          title="Teacher access required"
          description="You need teacher privileges to view this dashboard."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title="Teacher Dashboard" subtitle="Monitor your students and classes." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-400/15 text-brand-700">
              <Users size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{students.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Students</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky/15 text-sky">
              <BookOpen size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{classes.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Classes</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber/15 text-amber">
              <Zap size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{totalXp.toLocaleString()}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total XP</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-coral/15 text-coral">
              <TrendingUp size={19} />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">{avgLevel}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Level</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="flex gap-2">
        <Button
          variant={tab === 'students' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab('students')}
        >
          <Users size={16} /> Students
        </Button>
        <Button
          variant={tab === 'classes' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab('classes')}
        >
          <BookOpen size={16} /> Classes
        </Button>
      </div>

      {loading ? (
        <GlassCard className="flex items-center justify-center p-10">
          <Spinner size={28} className="text-brand-400" />
        </GlassCard>
      ) : tab === 'students' ? (
        <div className="flex flex-col gap-4">
          <GlassCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-black/5 bg-white/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </GlassCard>

          {filteredStudents.length === 0 ? (
            <GlassCard className="p-6">
              <EmptyState
                icon={<Users size={32} />}
                title="No students found"
                description={search ? 'Try adjusting your search query.' : 'No students have joined yet.'}
              />
            </GlassCard>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.map((student, index) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                >
                  <GlassCard className="h-full p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-400/15 text-sm font-bold text-brand-700">
                          {student.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{student.full_name}</p>
                          <p className="text-xs text-slate-500">{student.email}</p>
                        </div>
                      </div>
                      <Badge tone={student.is_active ? 'brand' : 'neutral'}>
                        {student.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-black/5 p-2 text-center dark:border-white/10">
                        <p className="font-display text-lg font-bold text-brand-400">{student.xp?.toLocaleString() ?? 0}</p>
                        <p className="text-xs text-slate-500">XP</p>
                      </div>
                      <div className="rounded-xl border border-black/5 p-2 text-center dark:border-white/10">
                        <p className="font-display text-lg font-bold text-sky">Lvl {student.level ?? 1}</p>
                        <p className="text-xs text-slate-500">Level</p>
                      </div>
                      <div className="rounded-xl border border-black/5 p-2 text-center dark:border-white/10">
                        <p className="font-display text-lg font-bold text-amber">{student.streak ?? 0}</p>
                        <p className="text-xs text-slate-500">Streak</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => loadProgress(student)}
                    >
                      View Progress <ArrowUpRight size={14} />
                    </Button>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.length === 0 ? (
            <GlassCard className="p-6 sm:col-span-2 lg:col-span-3">
              <EmptyState
                icon={<BookOpen size={32} />}
                title="No classes found"
                description="Classes and study groups will appear here once created."
              />
            </GlassCard>
          ) : (
            classes.map((cls, index) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <GlassCard className="h-full p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{cls.name}</h3>
                      {cls.subject && (
                        <p className="text-sm text-slate-500">{cls.subject}</p>
                      )}
                    </div>
                    <Badge tone={cls.is_public ? 'brand' : 'neutral'}>
                      {cls.is_public ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                  {cls.description && (
                    <p className="mt-2 text-sm text-slate-500">{cls.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users size={14} /> {cls.member_count} / {cls.max_members}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame size={14} /> Active
                    </span>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedStudent(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">{selectedStudent.full_name}</h2>
                <p className="text-sm text-slate-500">{selectedStudent.email}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="rounded-lg p-2 hover:bg-black/5">
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
                  <p className="text-sm text-slate-500">Streak</p>
                  <p className="font-display text-2xl font-bold text-amber">{progress.streak} days</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Accuracy</p>
                  <p className="font-display text-2xl font-bold text-coral">{Math.round(progress.accuracy * 100)}%</p>
                </GlassCard>
                <GlassCard className="p-4 sm:col-span-2">
                  <p className="text-sm text-slate-500">Topics Completed</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {progress.topics_completed.length > 0 ? (
                      progress.topics_completed.map((topic) => (
                        <Badge key={topic} tone="brand">{topic}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No topics completed yet.</p>
                    )}
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Weak Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {progress.weak_topics.length > 0 ? (
                      progress.weak_topics.map((topic) => (
                        <Badge key={topic} tone="coral">{topic}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No weak topics.</p>
                    )}
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-sm text-slate-500">Strong Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {progress.strong_topics.length > 0 ? (
                      progress.strong_topics.map((topic) => (
                        <Badge key={topic} tone="brand">{topic}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No strong topics yet.</p>
                    )}
                  </div>
                </GlassCard>
              </div>
            ) : (
              <EmptyState title="No progress data" description="This student has not started any lessons yet." />
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
