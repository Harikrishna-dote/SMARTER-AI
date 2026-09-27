import { useEffect, useState } from 'react';
import { Shield, Save, Eye, EyeOff, BarChart3, Users, MessageSquare, Globe } from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { PrivacySettingsResponse } from '../lib/types';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends only' },
  { value: 'private', label: 'Private' },
];

const DATA_SHARING_OPTIONS = [
  { value: 'essential', label: 'Essential only' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'full', label: 'Full' },
];

function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-black/10 p-3 transition-all hover:border-brand-400/40 dark:border-white/10">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </label>
  );
}

function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function Privacy() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PrivacySettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getPrivacySettings();
        if (!cancelled) setSettings(data);
      } catch {
        if (!cancelled) {
          toast({ title: 'Could not load privacy settings', variant: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        profile_visibility: settings.profile_visibility,
        show_xp: settings.show_xp,
        show_badges: settings.show_badges,
        show_progress: settings.show_progress,
        allow_study_group_invites: settings.allow_study_group_invites,
        allow_mentor_messages: settings.allow_mentor_messages,
        data_sharing: settings.data_sharing,
        allow_analytics: settings.allow_analytics,
      };
      const updated = await api.updatePrivacySettings(payload);
      setSettings(updated);
      toast({ title: 'Privacy settings saved', variant: 'success' });
    } catch {
      toast({ title: 'Could not save settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PageHeader title="Privacy" subtitle="Control your data and visibility." />
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-brand-400" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PageHeader title="Privacy" subtitle="Control your data and visibility." />
        <GlassCard>
          <EmptyState
            icon={<Shield className="h-8 w-8" />}
            title="Could not load settings"
            description="Please try again later."
          />
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Privacy"
        subtitle="Control your data and visibility."
        actions={
          <Button
            loading={saving}
            leftIcon={<Save className="h-4 w-4" />}
            onClick={handleSave}
          >
            Save settings
          </Button>
        }
      />

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Visibility</h2>
        </div>
        <div className="grid gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Profile visibility
            </label>
            <select
              value={settings.profile_visibility}
              onChange={(e) => setSettings((s) => s ? { ...s, profile_visibility: e.target.value } : s)}
              className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:bg-white/5 dark:text-chalk"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Eye className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Profile Display</h2>
        </div>
        <div className="flex flex-col gap-2">
          <Switch
            checked={settings.show_xp}
            onChange={(val) => setSettings((s) => s ? { ...s, show_xp: val } : s)}
            label="Show XP"
            description="Display your experience points on your profile."
          />
          <Switch
            checked={settings.show_badges}
            onChange={(val) => setSettings((s) => s ? { ...s, show_badges: val } : s)}
            label="Show badges"
            description="Display your earned badges on your profile."
          />
          <Switch
            checked={settings.show_progress}
            onChange={(val) => setSettings((s) => s ? { ...s, show_progress: val } : s)}
            label="Show progress"
            description="Display your learning progress publicly."
          />
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Communications</h2>
        </div>
        <div className="flex flex-col gap-2">
          <Switch
            checked={settings.allow_study_group_invites}
            onChange={(val) => setSettings((s) => s ? { ...s, allow_study_group_invites: val } : s)}
            label="Study group invites"
            description="Allow others to invite you to study groups."
          />
          <Switch
            checked={settings.allow_mentor_messages}
            onChange={(val) => setSettings((s) => s ? { ...s, allow_mentor_messages: val } : s)}
            label="Mentor messages"
            description="Allow mentors to send you direct messages."
          />
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Data & Analytics</h2>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Data sharing level
            </label>
            <select
              value={settings.data_sharing}
              onChange={(e) => setSettings((s) => s ? { ...s, data_sharing: e.target.value } : s)}
              className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:bg-white/5 dark:text-chalk"
            >
              {DATA_SHARING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Switch
            checked={settings.allow_analytics}
            onChange={(val) => setSettings((s) => s ? { ...s, allow_analytics: val } : s)}
            label="Allow analytics"
            description="Help improve the platform by sharing anonymous usage data."
          />
        </div>
      </GlassCard>
    </div>
  );
}
