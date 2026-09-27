import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { GlassCard } from '../components/ui/primitives';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from './Login';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState({ full_name: false, email: false, password: false, confirm: false });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const fullNameError = touched.full_name && !form.full_name.trim() ? 'Full name is required' : null;
  const emailError = touched.email && !form.email.trim() ? 'Email is required' : null;
  const passwordError = touched.password && form.password.length < 8 ? 'Password must be at least 8 characters' : null;
  const confirmError = touched.confirm && form.confirm !== form.password ? 'Passwords do not match' : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched({ full_name: true, email: true, password: true, confirm: true });
      setError(null);

      const trimmedFullName = form.full_name.trim();
      const trimmedEmail = form.email.trim().toLowerCase();
      const trimmedPassword = form.password.trim();
      const trimmedConfirm = form.confirm.trim();

      if (!trimmedFullName) {
        setError('Please enter your full name.');
        return;
      }
      if (!trimmedEmail) {
        setError('Please enter your email address.');
        return;
      }
      if (trimmedPassword.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (trimmedPassword !== trimmedConfirm) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        await register({ full_name: trimmedFullName, email: trimmedEmail, password: trimmedPassword });
        setDone(true);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [form, register, navigate],
  );

  return (
    <AuthLayout>
      <GlassCard strong className="w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Free to start. No credit card required.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral"
            role="alert"
          >
            <AlertCircle size={16} /> {error}
          </motion.div>
        )}
        {done && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-400/10 px-3 py-2 text-sm text-brand-600 dark:text-brand-300">
            <CheckCircle2 size={16} /> Account created - redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Full name"
            required
            autoComplete="name"
            placeholder="Ada Lovelace"
            leftIcon={<UserIcon size={16} />}
            value={form.full_name}
            onChange={set('full_name')}
            onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
            error={fullNameError ?? undefined}
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={16} />}
            value={form.email}
            onChange={set('email')}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={emailError ?? undefined}
          />
          <Input
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            leftIcon={<Lock size={16} />}
            value={form.password}
            onChange={set('password')}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={passwordError ?? undefined}
          />
          <Input
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Re-enter password"
            leftIcon={<Lock size={16} />}
            value={form.confirm}
            onChange={set('confirm')}
            onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            error={confirmError ?? undefined}
          />
          <Button type="submit" fullWidth size="lg" loading={loading} rightIcon={<ArrowRight size={18} />}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-500 hover:underline">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </AuthLayout>
  );
}
