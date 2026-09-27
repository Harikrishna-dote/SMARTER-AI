import { useEffect, useState } from 'react';
import { Users, Plus, MessageSquare, FileText, LogOut, Sparkles } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, TextArea } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { StudyGroupResponse, GroupDiscussionResponse, SharedNoteResponse } from '../lib/types';

export default function StudyGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StudyGroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeGroup, setActiveGroup] = useState<StudyGroupResponse | null>(null);
  const [discussions, setDiscussions] = useState<GroupDiscussionResponse[]>([]);
  const [notes, setNotes] = useState<SharedNoteResponse[]>([]);
  const [form, setForm] = useState({ name: '', description: '', subject: '', is_public: true });
  const [discussionContent, setDiscussionContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [error, setError] = useState('');

  const loadGroups = async () => {
    try {
      const data = await api.listStudyGroups();
      setGroups(data);
    } catch {
      setError('Failed to load study groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroupDetails = async (group: StudyGroupResponse) => {
    setActiveGroup(group);
    setDiscussions([]);
    setNotes([]);
    try {
      const [d, n] = await Promise.all([
        api.listGroupDiscussions(group.id),
        api.listSharedNotes(group.id),
      ]);
      setDiscussions(d);
      setNotes(n);
    } catch {
      setError('Failed to load group details');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await api.createStudyGroup({
        name: form.name,
        description: form.description || null,
        subject: form.subject || null,
        is_public: form.is_public,
      });
      setForm({ name: '', description: '', subject: '', is_public: true });
      setShowCreate(false);
      loadGroups();
    } catch {
      setError('Failed to create study group');
    }
  };

  const handleJoin = async (groupId: string) => {
    try {
      await api.joinStudyGroup(groupId);
      setGroups((g) =>
        g.map((grp) =>
          grp.id === groupId ? { ...grp, member_count: grp.member_count + 1 } : grp,
        ),
      );
      if (activeGroup?.id === groupId) {
        loadGroupDetails({ ...activeGroup, member_count: activeGroup.member_count + 1 });
      }
    } catch {
      setError('Failed to join group');
    }
  };

  const handleDiscussion = async () => {
    if (!discussionContent.trim() || !activeGroup) return;
    try {
      await api.createGroupDiscussion(activeGroup.id, { content: discussionContent });
      setDiscussionContent('');
      loadGroupDetails(activeGroup);
    } catch {
      setError('Failed to add discussion');
    }
  };

  const handleNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim() || !activeGroup) return;
    try {
      await api.createSharedNote(activeGroup.id, { title: noteTitle, content: noteContent, tags: [] });
      setNoteTitle('');
      setNoteContent('');
      loadGroupDetails(activeGroup);
    } catch {
      setError('Failed to add note');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Groups"
        subtitle="Collaborate with peers and learn together"
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            Create Group
          </Button>
        }
      />

      {error && <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size={24} /></div>
          ) : groups.length === 0 ? (
            <GlassCard>
              <EmptyState icon={<Users size={28} />} title="No study groups" description="Create or join a study group to get started." />
            </GlassCard>
          ) : (
            groups.map((g) => (
              <GlassCard
                key={g.id}
                hover
                className={`cursor-pointer p-4 ${activeGroup?.id === g.id ? 'border-brand-400' : ''}`}
                onClick={() => loadGroupDetails(g)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-ink dark:text-chalk">{g.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{g.subject || 'General'}</p>
                  </div>
                  <Badge tone={g.is_public ? 'sky' : 'neutral'}>{g.is_public ? 'Public' : 'Private'}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{g.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users size={13} /> {g.member_count} members</span>
                  <span>Owner: {g.owner_id === user?.id ? 'You' : g.owner_id}</span>
                </div>
              </GlassCard>
            ))
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {activeGroup ? (
            <>
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{activeGroup.name}</h2>
                    <p className="text-xs text-slate-500">{activeGroup.subject || 'General'} · {activeGroup.member_count} members</p>
                  </div>
                  <Button size="sm" variant="outline" leftIcon={<LogOut size={14} />} onClick={() => handleJoin(activeGroup.id)}>
                    Join
                  </Button>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{activeGroup.description}</p>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquare size={16} /> Discussions</h3>
                <div className="space-y-2">
                  {discussions.map((d) => (
                    <div key={d.id} className="rounded-xl border border-black/10 bg-white/50 p-3 dark:bg-white/5">
                      <p className="text-sm">{d.content}</p>
                      <p className="mt-1 text-xs text-slate-400">by {d.user_name || 'User'} · {new Date(d.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {discussions.length === 0 && <p className="text-xs text-slate-400">No discussions yet.</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={discussionContent}
                    onChange={(e) => setDiscussionContent(e.target.value)}
                    placeholder="Write a discussion..."
                    className="h-10 flex-1 rounded-xl border border-black/10 bg-white/70 px-3 text-sm dark:bg-white/5"
                  />
                  <Button size="sm" onClick={handleDiscussion} disabled={!discussionContent.trim()}>Post</Button>
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><FileText size={16} /> Shared Notes</h3>
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-xl border border-black/10 bg-white/50 p-3 dark:bg-white/5">
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{n.content}</p>
                      <p className="mt-1 text-xs text-slate-400">by {n.user_name || 'User'} · v{n.version}</p>
                    </div>
                  ))}
                  {notes.length === 0 && <p className="text-xs text-slate-400">No shared notes yet.</p>}
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title"
                    className="h-10 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm dark:bg-white/5"
                  />
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Note content"
                    rows={3}
                    className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm dark:bg-white/5"
                  />
                  <Button size="sm" onClick={handleNote} disabled={!noteTitle.trim() || !noteContent.trim()}>Share Note</Button>
                </div>
              </GlassCard>
            </>
          ) : (
            <GlassCard>
              <EmptyState icon={<Sparkles size={28} />} title="Select a group" description="Choose a study group from the left to view discussions and notes." />
            </GlassCard>
          )}
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Study Group" footer={
        <>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.name.trim()}>Create</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Group name" />
          <TextArea label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="What is this group about?" />
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="accent-brand-400" />
            Public group
          </label>
        </div>
      </Modal>
    </div>
  );
}
