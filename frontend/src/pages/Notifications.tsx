import { useEffect, useState } from 'react';
import { Bell, CheckCheck, CheckCircle2 } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import type { NotificationResponse } from '../lib/types';

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.listNotifications();
      setNotifications(data);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((n) => n.map((x) => x.id === id ? { ...x, is_read: true } : x));
    } catch {
      setError('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((n) => n.map((x) => ({ ...x, is_read: true })));
    } catch {
      setError('Failed to mark all as read');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" leftIcon={<CheckCheck size={16} />} onClick={markAllRead}>
              Mark all as read
            </Button>
          ) : null
        }
      />

      {error && <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : notifications.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Bell size={28} />} title="No notifications" description="You're all caught up. Notifications will appear here when available." />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <GlassCard key={n.id} className={`p-4 ${n.is_read ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{n.title}</h3>
                    <Badge tone={n.is_read ? 'neutral' : 'brand'}>{n.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read && (
                  <Button size="sm" variant="ghost" leftIcon={<CheckCircle2 size={14} />} onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
