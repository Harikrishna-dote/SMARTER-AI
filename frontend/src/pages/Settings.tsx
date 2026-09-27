import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor, LogOut, Globe, Save, Settings as SettingsIcon } from 'lucide-react';

import { GlassCard, Badge, Spinner, EmptyState, PageHeader } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

import { api } from '../lib/api';
import { type ThemeMode } from '../lib/types';
import { cn, initials, formatDateTime } from '../lib/utils';

import { useAppDispatch, useAppSelector } from '../store';
import { setTheme } from '../store/uiSlice';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function Settings() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getSettings();
        if (cancelled) return;
        setSettings(data ?? {});
        const stored = data?.preferred_language;
        setLanguage(typeof stored === 'string' ? stored : '');
      } catch {
        if (cancelled) return;
        setSettings({});
        toast({
          title: 'Could not load preferences',
          description: 'Showing an empty list. You can still save settings.',
          variant: 'error',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { preferred_language: language };
      const updated = await api.updateSettings(payload);
      setSettings(updated ?? { ...settings, preferred_language: language });
      toast({ title: 'Preferences saved', variant: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      toast({ title: 'Could not save preferences', description: message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const prefEntries = Object.entries(settings).filter(([k]) => k !== 'preferred_language');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader title="Settings" subtitle="Personalize your workspace." />

      {/* SECTION A — Appearance */}
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Appearance</h2>
        </div>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Choose how SMARTER AI looks.</p>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <motion.button
                key={value}
                type="button"
                onClick={() => dispatch(setTheme(value))}
                whileTap={{ scale: 0.97 }}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all duration-200',
                  active
                    ? 'border-brand-400/60 bg-brand-400/10 text-brand-700 shadow-glow dark:text-brand-300'
                    : 'glass glass-hover text-slate-600 dark:text-slate-300',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
                {active && <Badge className="mt-1">Active</Badge>}
              </motion.button>
            );
          })}
        </div>
      </GlassCard>

      {/* SECTION B — Profile */}
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Profile</h2>
        </div>
        {user ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-bold text-white shadow-glow">
                {initials(user.full_name)}
              </div>
              <div>
                <p className="font-display text-base font-semibold">{user.full_name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Member since {formatDateTime(user.created_at)}
                </p>
              </div>
            </div>
            <Button variant="danger" leftIcon={<LogOut className="h-4 w-4" />} onClick={logout}>
              Sign out
            </Button>
          </div>
        ) : (
          <EmptyState title="Not signed in" description="Sign in to view your profile." />
        )}
      </GlassCard>

      {/* SECTION C — Preferences */}
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-brand-400" />
          <h2 className="font-display text-lg font-semibold">Preferences</h2>
        </div>

        <div className="mb-5">
          <Input
            label="Preferred language"
            placeholder="e.g. English"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            leftIcon={<Globe className="h-4 w-4" />}
          />
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Stored settings</p>
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              <Spinner /> Loading preferences…
            </div>
          ) : prefEntries.length === 0 ? (
            <EmptyState
              icon={<SettingsIcon className="h-8 w-8" />}
              title="No preferences yet"
              description="Saved preferences will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
              {prefEntries.map(([key, value], i) => (
                <div
                  key={key}
                  className={cn(
                    'flex items-start justify-between gap-4 px-4 py-3 text-sm',
                    i !== 0 && 'border-t border-black/5 dark:border-white/5',
                  )}
                >
                  <span className="font-medium text-slate-600 dark:text-slate-300">{key}</span>
                  <span className="break-all text-right text-slate-500 dark:text-slate-400">
                    {stringifyValue(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="primary"
          loading={saving}
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
        >
          Save preferences
        </Button>
      </GlassCard>
    </div>
  );
}
