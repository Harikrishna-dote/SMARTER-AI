import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cn } from '../../lib/utils';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, rightSlot, className, id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border bg-white/70 px-3 transition-all dark:bg-white/5',
            'focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30',
            error ? 'border-coral/60' : 'border-black/10 dark:border-white/10',
          )}
        >
          {leftIcon && <span className="text-slate-400">{leftIcon}</span>}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400 dark:text-chalk',
              className,
            )}
            {...rest}
          />
          {rightSlot}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-coral">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

interface TextAreaProps extends FieldProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function TextArea({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
}: TextAreaProps) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>}
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'w-full resize-y rounded-xl border bg-white/70 px-3 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-slate-400 dark:bg-white/5 dark:text-chalk',
          'focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
          error ? 'border-coral/60' : 'border-black/10 dark:border-white/10',
          className,
        )}
      />
      {error ? (
        <p className="mt-1 text-xs text-coral">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
