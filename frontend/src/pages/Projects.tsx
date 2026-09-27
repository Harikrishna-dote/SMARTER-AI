import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Target, Sparkles } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, TextArea } from '../components/ui/Input';
import { api } from '../lib/api';
import type { ProjectResponse } from '../lib/types';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
const STATUSES = ['draft', 'in_progress', 'completed', 'archived'] as const;

export default function Projects() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', subject: '', difficulty: 'intermediate', career_goal: '', milestones: '' });

  const load = async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', subject: '', difficulty: 'intermediate', career_goal: '', milestones: '' });
    setShowModal(true);
  };

  const openEdit = (p: ProjectResponse) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      subject: p.subject || '',
      difficulty: p.difficulty,
      career_goal: p.career_goal || '',
      milestones: JSON.stringify(p.milestones || []),
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    try {
      const payload = {
        title: form.title,
        description: form.description,
        subject: form.subject || null,
        difficulty: form.difficulty,
        career_goal: form.career_goal || null,
        milestones: form.milestones ? JSON.parse(form.milestones) : [],
      };
      if (editing) {
        await api.updateProject(editing.id, payload);
      } else {
        await api.createProject(payload);
      }
      setShowModal(false);
      load();
    } catch {
      setError('Failed to save project');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch {
      setError('Failed to delete project');
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = { draft: 'neutral', in_progress: 'amber', completed: 'brand', archived: 'coral' };
    return map[status] || 'neutral';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Manage your learning projects and track progress"
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={openCreate}>New Project</Button>
        }
      />

      {error && <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : projects.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Target size={28} />} title="No projects yet" description="Create your first project to start tracking your progress." action={<Button size="sm" leftIcon={<Plus size={15} />} onClick={openCreate}>New Project</Button>} />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <GlassCard key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(p.id)} className="rounded-lg p-1.5 text-coral hover:bg-coral/10"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="neutral">{p.difficulty}</Badge>
                <Badge tone={statusColor(p.status) as any}>{p.status.replace('_', ' ')}</Badge>
                {p.subject && <Badge tone="sky">{p.subject}</Badge>}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{Math.round(p.progress)}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-2 rounded-full bg-brand-400 transition-all" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
              {p.career_goal && <p className="mt-2 text-xs text-slate-500"><Target size={12} className="inline mr-1" />{p.career_goal}</p>}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'New Project'} size="lg" footer={
        <>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim()}>{editing ? 'Update' : 'Create'}</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Project title" />
          <TextArea label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Project description" />
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Computer Science" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Difficulty</label>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm dark:bg-white/5">
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <Input label="Career Goal" value={form.career_goal} onChange={(e) => setForm({ ...form, career_goal: e.target.value })} placeholder="e.g. Full-stack developer" />
          <TextArea label="Milestones (JSON)" value={form.milestones} onChange={(value) => setForm({ ...form, milestones: value })} placeholder='[{"title": "Setup", "completed": true}]' rows={3} />
        </div>
      </Modal>
    </div>
  );
}
