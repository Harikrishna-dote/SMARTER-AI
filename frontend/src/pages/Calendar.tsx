import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, TextArea } from '../components/ui/Input';
import { api } from '../lib/api';
import type { CalendarEventResponse } from '../lib/types';

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', event_type: 'study', start_time: '', end_time: '', reminder_minutes: '15' });

  const load = async () => {
    try {
      const data = await api.listCalendarEvents();
      setEvents(data);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.start_time || !form.end_time) return;
    try {
      await api.createCalendarEvent({
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        start_time: form.start_time,
        end_time: form.end_time,
        reminder_minutes: Number(form.reminder_minutes),
      });
      setForm({ title: '', description: '', event_type: 'study', start_time: '', end_time: '', reminder_minutes: '15' });
      setShowModal(false);
      load();
    } catch {
      setError('Failed to create event');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.completeCalendarEvent(id);
      setEvents((e) => e.map((ev) => ev.id === id ? { ...ev, is_completed: true } : ev));
    } catch {
      setError('Failed to complete event');
    }
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Manage your schedule and deadlines"
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowModal(true)}>Add Event</Button>
        }
      />

      {error && <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : events.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<CalendarIcon size={28} />} title="No events" description="Add your first calendar event to stay organized." action={<Button size="sm" leftIcon={<Plus size={15} />} onClick={() => setShowModal(true)}>Add Event</Button>} />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <GlassCard key={ev.id} className={`p-4 ${ev.is_completed ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{ev.title}</h3>
                    <Badge tone={ev.is_completed ? 'brand' : 'amber'}>{ev.event_type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{ev.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(ev.start_time)}</span>
                    <span>to {formatTime(ev.end_time)}</span>
                    <span>Reminder: {ev.reminder_minutes}m</span>
                  </div>
                </div>
                {!ev.is_completed && (
                  <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 size={14} />} onClick={() => handleComplete(ev.id)}>
                    Complete
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Event" footer={
        <>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.title.trim() || !form.start_time || !form.end_time}>Create</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" />
          <TextArea label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Event description" rows={3} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Event Type</label>
            <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm dark:bg-white/5">
              <option value="study">Study</option>
              <option value="exam">Exam</option>
              <option value="deadline">Deadline</option>
              <option value="reminder">Reminder</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input label="Start Time" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <Input label="End Time" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          <Input label="Reminder (minutes)" type="number" value={form.reminder_minutes} onChange={(e) => setForm({ ...form, reminder_minutes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
