import { useEffect, useState } from 'react';
import { Briefcase, Plus, PlayCircle, Target, Sparkles } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, TextArea } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { InterviewSessionResponse } from '../lib/types';

export default function Career() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<InterviewSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ interview_type: 'behavioral', role: 'software-engineer' });

  const load = async () => {
    try {
      const data = await api.listInterviewSessions();
      setSessions(data);
    } catch {
      setError('Failed to load interview sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.role.trim()) return;
    try {
      await api.createInterviewSession({ interview_type: form.interview_type, role: form.role });
      setShowModal(false);
      setForm({ interview_type: 'behavioral', role: 'software-engineer' });
      load();
    } catch {
      setError('Failed to create interview session');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career Coach"
        subtitle="Prepare for interviews and track your career goals"
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowModal(true)}>New Session</Button>
        }
      />

      {error && <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">{error}</div>}

      <GlassCard className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-display font-semibold"><Target size={18} className="text-brand-400" /> Career Goals</h3>
        {user?.career_goals?.length ? (
          <div className="flex flex-wrap gap-2">
            {user.career_goals.map((goal) => (
              <Badge key={goal} tone="coral">{goal}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No career goals set. Update your profile to add goals.</p>
        )}
      </GlassCard>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : sessions.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Briefcase size={28} />} title="No interview sessions" description="Start a new interview practice session to prepare for your career goals." action={<Button size="sm" leftIcon={<PlayCircle size={15} />} onClick={() => setShowModal(true)}>Start Session</Button>} />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <GlassCard key={s.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{s.role}</h3>
                  <p className="text-xs text-slate-500">{s.interview_type} interview</p>
                </div>
                <Badge tone={s.completed ? 'brand' : 'amber'}>{s.completed ? 'Completed' : 'In Progress'}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Sparkles size={12} /> Score: {s.score} / 100
              </div>
              <p className="mt-2 text-xs text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Interview Session" footer={
        <>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.role.trim()}>Start</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Target Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Data Scientist" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Interview Type</label>
            <select value={form.interview_type} onChange={(e) => setForm({ ...form, interview_type: e.target.value })} className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm dark:bg-white/5">
              <option value="behavioral">Behavioral</option>
              <option value="technical">Technical</option>
              <option value="system_design">System Design</option>
              <option value="case_study">Case Study</option>
              <option value="hr">HR</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
