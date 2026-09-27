import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Spinner } from './primitives';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95',
  secondary:
    'glass glass-hover text-ink dark:text-chalk',
  outline:
    'border border-brand-400/40 text-brand-700 hover:bg-brand-400/10 dark:text-brand-300',
  ghost: 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300',
  danger: 'bg-coral text-white shadow-glow-coral hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex touch-target items-center justify-center font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? <Spinner size={16} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </motion.button>
  ),
);
Button.displayName = 'Button';
