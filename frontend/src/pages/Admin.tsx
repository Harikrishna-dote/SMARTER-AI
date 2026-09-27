import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Activity,
  Shield,
  MessageSquare,
  MessagesSquare,
  FileText,
  Brain,
  Bot,
  HardDrive,
  Cpu,
  Sparkles,
  ShieldCheck,
  Search,
  X,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  UserCog,
  BarChart3,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

import { GlassCard, Badge, Spinner, EmptyState, PageHeader } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { AdminStats, AdminUserListItem, PlatformActivity } from '../lib/types';
import { cn, formatBytes } from '../lib/utils';

type AdminTab = 'overview' | 'users' | 'activity';

const statCards = [
  { key: 'users', label: 'Users', Icon: Users, tone: 'text-brand-400' },
  { key: 'active_users', label: 'Active users', Icon: Activity, tone: 'text-sky' },
  { key: 'admins', label: 'Admins', Icon: Shield, tone: 'text-amber' },
  { key: 'conversations', label: 'Conversations', Icon: MessageSquare, tone: 'text-brand-400' },
  { key: 'messages', label: 'Messages', Icon: MessagesSquare, tone: 'text-sky' },
  { key: 'documents', label: 'Documents', Icon: FileText, tone: 'text-amber' },
  { key: 'memories', label: 'Memories', Icon: Brain, tone: 'text-brand-400' },
  { key: 'agents', label: 'Agents', Icon: Bot, tone: 'text-coral' },
] as const;

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [activity, setActivity] = useState<PlatformActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await api.adminStats();
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin stats';
      toast({ title: 'Could not load admin stats', description: message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await api.listUsers({
        search: userSearch || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      toast({ title: 'Could not load users', description: message, variant: 'error' });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const data = await api.platformActivity();
      setActivity(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load activity';
      toast({ title: 'Could not load activity', description: message, variant: 'error' });
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.is_admin) return;
    if (tab === 'overview') loadOverview();
    if (tab === 'users') loadUsers();
    if (tab === 'activity') loadActivity();
  }, [user?.is_admin, tab]);

  const handleToggleActive = async (u: AdminUserListItem) => {
    try {
      await api.toggleUserActive({ user_id: u.id, is_active: !u.is_active });
      toast({ title: `User ${u.is_active ? 'deactivated' : 'activated'}`, variant: 'success' });
      loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user';
      toast({ title: 'Could not update user', description: message, variant: 'error' });
    }
  };

  const handleRoleChange = async (u: AdminUserListItem, newRole: string) => {
    try {
      await api.updateUserRole({ user_id: u.id, role: newRole });
      toast({ title: 'Role updated', variant: 'success' });
      loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      toast({ title: 'Could not update role', description: message, variant: 'error' });
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="flex items-center justify-center py-20">
        <EmptyState
          icon={<ShieldCheck size={40} />}
          title="Admin access required"
          description="You need administrator privileges to view this page."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title="Admin" subtitle="Platform overview and system health." />

      <div className="flex gap-2">
        <Button variant={tab === 'overview' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('overview')}>
          <BarChart3 size={16} /> Overview
        </Button>
        <Button variant={tab === 'users' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('users')}>
          <UserCog size={16} /> Users
        </Button>
        <Button variant={tab === 'activity' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('activity')}>
          <Activity size={16} /> Activity
        </Button>
      </div>

      {tab === 'overview' && (
        <>
          {loading ? (
            <GlassCard className="flex items-center justify-center p-10">
              <Spinner size={28} className="text-brand-400" />
            </GlassCard>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card, index) => {
                  const Icon = card.Icon;
                  const value = stats?.[card.key] ?? 0;
                  return (
                    <motion.div
                      key={card.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <GlassCard className="h-full p-5">
                        <div className="flex items-center justify-between">
                          <span className={cn('grid h-10 w-10 place-items-center rounded-xl bg-white/10', card.tone)}>
                            <Icon size={19} />
                          </span>
                        </div>
                        <p className="mt-4 font-display text-3xl font-bold">{value.toLocaleString()}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <GlassCard className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-brand-400" />
                    <h2 className="font-display text-lg font-semibold">Storage</h2>
                  </div>
                  {stats && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-black/5 p-3 dark:border-white/10">
                        <span className="text-sm font-medium">Total</span>
                        <span className="font-display text-lg font-bold text-brand-400">
                          {formatBytes(stats.storage.total_bytes)}
                        </span>
                      </div>
                      {[
                        { label: 'Database', bytes: stats.storage.database_bytes, files: stats.storage.database_files },
                        { label: 'Uploads', bytes: stats.storage.uploads_bytes, files: stats.storage.uploads_files },
                        { label: 'Extracted', bytes: stats.storage.extracted_bytes, files: stats.storage.extracted_files },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10"
                        >
                          <span className="text-sm font-medium">{row.label}</span>
                          <span className="text-right text-sm text-slate-500 dark:text-slate-400">
                            {formatBytes(row.bytes)} / {row.files.toLocaleString()} files
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>

                <GlassCard className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-brand-400" />
                    <h2 className="font-display text-lg font-semibold">AI configuration</h2>
                  </div>
                  {stats?.ai && Object.keys(stats.ai).length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
                      {Object.entries(stats.ai).map(([key, value], index) => (
                        <div
                          key={key}
                          className={cn(
                            'flex items-start justify-between gap-4 px-4 py-2.5 text-sm',
                            index !== 0 && 'border-t border-black/5 dark:border-white/5',
                          )}
                        >
                          <span className="font-medium text-slate-600 dark:text-slate-300">{key}</span>
                          <span className="break-all text-right text-slate-500 dark:text-slate-400">
                            {stringifyValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No AI configuration found.</p>
                  )}
                </GlassCard>

                <GlassCard className="p-5 lg:col-span-2">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-400" />
                    <h2 className="font-display text-lg font-semibold">Features</h2>
                  </div>
                  {stats?.features && Object.keys(stats.features).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.features).map(([key, value]) => (
                        <Badge key={key} tone="brand">
                          {key}: {stringifyValue(value)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No feature flags found.</p>
                  )}
                </GlassCard>
              </div>

              {stats?.requested_by && (
                <p className="text-xs text-slate-400">
                  Requested by <span className="font-mono">{stats.requested_by}</span>
                </p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'users' && (
        <div className="flex flex-col gap-4">
          <GlassCard className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-xl border border-black/5 bg-white/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl border border-black/5 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
              >
                <option value="all">All roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="administrator">Administrator</option>
                <option value="institution">Institution</option>
                <option value="mentor">Mentor</option>
              </select>
              <Button variant="primary" size="sm" onClick={loadUsers}>
                Search
              </Button>
            </div>
          </GlassCard>

          {usersLoading ? (
            <GlassCard className="flex items-center justify-center p-10">
              <Spinner size={28} className="text-brand-400" />
            </GlassCard>
          ) : users.length === 0 ? (
            <GlassCard className="p-6">
              <EmptyState
                icon={<Users size={32} />}
                title="No users found"
                description="Try adjusting your search or filter criteria."
              />
            </GlassCard>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/5 dark:border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/5 text-xs uppercase text-slate-500 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">XP / Level</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {users.map((u, index) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.3 }}
                      className="hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className="rounded-lg border border-black/5 bg-white/50 px-2 py-1 text-xs outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="parent">Parent</option>
                          <option value="administrator">Administrator</option>
                          <option value="institution">Institution</option>
                          <option value="mentor">Mentor</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-brand-400">{u.xp?.toLocaleString() ?? 0} XP</span>
                        <span className="ml-2 text-slate-500">Lvl {u.level ?? 1}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.is_active ? 'brand' : 'neutral'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(u)}
                          className="h-8 w-8 p-0"
                        >
                          {u.is_active ? <ToggleRight size={16} className="text-brand-400" /> : <ToggleLeft size={16} className="text-slate-400" />}
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <>
          {activityLoading ? (
            <GlassCard className="flex items-center justify-center p-10">
              <Spinner size={28} className="text-brand-400" />
            </GlassCard>
          ) : activity ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Active Today', value: activity.active_today, Icon: Activity, tone: 'text-brand-400' },
                { label: 'Active This Week', value: activity.active_this_week, Icon: Users, tone: 'text-sky' },
                { label: 'Active This Month', value: activity.active_this_month, Icon: TrendingUp, tone: 'text-amber' },
                { label: 'Total Logins', value: activity.total_logins, Icon: Shield, tone: 'text-coral' },
                { label: 'Conversations Today', value: activity.conversations_today, Icon: MessageSquare, tone: 'text-brand-400' },
                { label: 'Messages Today', value: activity.messages_today, Icon: MessagesSquare, tone: 'text-sky' },
                { label: 'Lessons Completed Today', value: activity.lessons_completed_today, Icon: CheckCircle2, tone: 'text-amber' },
                { label: 'Quizzes Taken Today', value: activity.quizzes_taken_today, Icon: FileText, tone: 'text-coral' },
              ].map((item, index) => {
                const Icon = item.Icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3 }}
                  >
                    <GlassCard className="h-full p-5">
                      <div className="flex items-center gap-3">
                        <div className={cn('grid h-10 w-10 place-items-center rounded-xl bg-white/10', item.tone)}>
                          <Icon size={19} />
                        </div>
                        <div>
                          <p className="font-display text-2xl font-bold">{item.value.toLocaleString()}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}

              <GlassCard className="p-5 sm:col-span-2 lg:col-span-4">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand-400" />
                  <h2 className="font-display text-lg font-semibold">Top Subjects</h2>
                </div>
                {activity.top_subjects && activity.top_subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activity.top_subjects.map((subject) => (
                      <Badge key={subject.subject} tone="brand">
                        {subject.subject}: {subject.count}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No subject data available.</p>
                )}
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="p-6">
              <EmptyState
                icon={<Activity size={32} />}
                title="No activity data"
                description="Platform activity metrics will appear here."
              />
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
