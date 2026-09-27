import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import { dismissToast } from '../../store/uiSlice';

const variants = {
  default: { icon: Info, color: 'text-sky', ring: 'border-sky/30' },
  success: { icon: CheckCircle2, color: 'text-brand-400', ring: 'border-brand-400/30' },
  error: { icon: XCircle, color: 'text-coral', ring: 'border-coral/30' },
  info: { icon: AlertTriangle, color: 'text-amber', ring: 'border-amber/30' },
};

export function Toaster() {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((s) => s.ui.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2 safe-bottom">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const v = variants[t.variant] ?? variants.default;
          const Icon = v.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className={`glass-strong pointer-events-auto flex items-start gap-3 rounded-xl border ${v.ring} p-3 pr-2`}
              onAnimationComplete={() => {
                setTimeout(() => dispatch(dismissToast(t.id)), t.duration ?? 4000);
              }}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${v.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dispatch(dismissToast(t.id))}
                className="rounded-md p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
