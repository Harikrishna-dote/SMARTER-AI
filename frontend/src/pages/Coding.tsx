import { useEffect, useState } from 'react';
import { Plus, Play, Bug, Code2 } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { TextArea } from '../components/ui/Input';
import { api } from '../lib/api';
import type { CodingSessionResponse } from '../lib/types';

const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'rust', 'go'] as const;

function formatCodingError(error: Record<string, unknown>): string {
  if (typeof error.message === 'string') return error.message;
  if (typeof error.error === 'string') return error.error;
  if (typeof error.detail === 'string') return error.detail;
  return JSON.stringify(error);
}

export default function Coding() {
  const [sessions, setSessions] = useState<CodingSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ language: 'python', problem: '' });
  const [code, setCode] = useState('');
  const [activeSession, setActiveSession] = useState<CodingSessionResponse | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      const data = await api.listCodingSessions();
      setSessions(data);
    } catch {
      setError('Failed to load coding sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.problem.trim()) return;
    try {
      const session = await api.createCodingSession({ language: form.language, problem: form.problem });
      setSessions((s) => [session, ...s]);
      setActiveSession(session);
      setCode(session.code || '');
      setShowModal(false);
      setForm({ language: 'python', problem: '' });
    } catch {
      setError('Failed to create session');
    }
  };

  const handleRun = async () => {
    if (!activeSession) return;
    setRunning(true);
    try {
      // First save the code
      await api.updateCodingSession(activeSession.id, code);
      // Then run it
      const updated = await api.runCodingSession(activeSession.id);
      setActiveSession(updated);
      setSessions((s) => s.map((x) => x.id === updated.id ? updated : x));
    } catch {
      setError('Failed to run code');
    } finally {
      setRunning(false);
    }
  };


  const selectSession = (s: CodingSessionResponse) => {
    setActiveSession(s);
    setCode(s.code || '');
  };

  const activeErrors = activeSession?.errors
    .map(formatCodingError)
    .filter((message) => message.trim().length > 0) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coding Playground"
        subtitle="Practice coding problems and debug your solutions"
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowModal(true)}>New Session</Button>
        }
      />

      {error && <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size={24} /></div>
          ) : sessions.length === 0 ? (
            <GlassCard>
              <EmptyState icon={<Code2 size={28} />} title="No sessions" description="Create a coding session to start practicing." />
            </GlassCard>
          ) : (
            sessions.map((s) => (
              <GlassCard
                key={s.id}
                hover
                className={`cursor-pointer p-4 ${activeSession?.id === s.id ? 'border-brand-400' : ''}`}
                onClick={() => selectSession(s)}
              >
                <h3 className="font-semibold text-sm">{s.problem}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Badge tone="sky">{s.language}</Badge>
                  {s.completed && <Badge tone="brand">Completed</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
              </GlassCard>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {activeSession ? (
            <div className="space-y-4">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{activeSession.problem}</h2>
                    <p className="text-xs text-slate-500">{activeSession.language} · {activeSession.completed ? 'Completed' : 'In Progress'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" leftIcon={<Play size={14} />} onClick={handleRun} loading={running}>Run</Button>
                    <Button size="sm" variant="ghost" leftIcon={<Bug size={14} />} onClick={handleRun} loading={running}>Debug</Button>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-5">
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Code Editor</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={14}
                  className="font-mono w-full rounded-xl border border-black/10 bg-black/90 px-4 py-3 text-sm text-green-400 outline-none dark:bg-black"
                />
                {activeSession.output !== null && activeSession.output !== "" && (
                  <div className="mt-4 rounded-xl border border-green-500/30 bg-green-950/20 p-4">
                    <p className="text-xs font-bold uppercase text-green-500">Output</p>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-sm text-green-100">{activeSession.output}</pre>
                  </div>
                )}
                {activeErrors.length > 0 && (
                  <div className="mt-4 rounded-xl border border-coral/50 bg-coral/10 p-4">
                    <p className="text-xs font-bold uppercase text-coral">Errors</p>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-sm text-coral">
                      {activeErrors.join('\n')}
                    </pre>
                  </div>
                )}
              </GlassCard>
            </div>
          ) : (
            <GlassCard>
              <EmptyState icon={<Code2 size={28} />} title="Select a session" description="Choose a coding session from the left or create a new one to start coding." />
            </GlassCard>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Coding Session" footer={
        <>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.problem.trim()}>Create</Button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Language</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm dark:bg-white/5">
              {LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
            </select>
          </div>
          <TextArea label="Problem" value={form.problem} onChange={(value) => setForm({ ...form, problem: value })} placeholder="Describe the problem or paste a prompt" />
        </div>
      </Modal>
    </div>
  );
}
