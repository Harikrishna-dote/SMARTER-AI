import { useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { GlassCard } from '../components/ui/primitives';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const emailError = touched.email && !email.trim() ? 'Email is required' : null;
  const passwordError = touched.password && !password ? 'Password is required' : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched({ email: true, password: true });
      setError(null);

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      if (!trimmedEmail) {
        setError('Please enter your email address.');
        return;
      }
      if (!trimmedPassword) {
        setError('Please enter your password.');
        return;
      }

      setLoading(true);
      try {
        await login({ email: trimmedEmail, password: trimmedPassword });
        navigate(from, { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, navigate, from],
  );

  return (
    <AuthLayout>
      <GlassCard strong className="w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in to continue your learning journey
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={16} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={emailError ?? undefined}
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="********"
            leftIcon={<Lock size={16} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={passwordError ?? undefined}
          />
          <Button type="submit" fullWidth size="lg" loading={loading} rightIcon={<ArrowRight size={18} />}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-500 hover:underline">
            Create an account
          </Link>
        </p>
      </GlassCard>
    </AuthLayout>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-sky/15 blur-3xl animate-float" />
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient shadow-glow">
            <Sparkles size={20} className="text-white" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">SMARTER AI</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
