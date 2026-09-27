import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  hover?: boolean;
  strong?: boolean;
  children?: ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ hover = false, strong = false, className, children, ...rest }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-2xl',
        hover && 'glass-hover',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  ),
);
GlassCard.displayName = 'GlassCard';

export function Badge({
  children,
  tone = 'brand',
  className,
}: {
  children: ReactNode;
  tone?: 'brand' | 'coral' | 'amber' | 'sky' | 'neutral';
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-400/15 text-brand-700 dark:text-brand-300 border-brand-400/30',
    coral: 'bg-coral/15 text-coral border-coral/30',
    amber: 'bg-amber/15 text-amber border-amber/30',
    sky: 'bg-sky/15 text-sky border-sky/30',
    neutral: 'bg-black/5 text-slate-600 border-black/10 dark:bg-white/10 dark:text-slate-300 dark:border-white/10',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/10 px-6 py-14 text-center dark:border-white/10">
      {icon && <div className="text-slate-400">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
