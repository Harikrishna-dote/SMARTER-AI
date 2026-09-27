import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Sun, Moon, Monitor, LogOut, ChevronDown } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setSidebar, setTheme, toggleCommand } from '../../store/uiSlice';
import { useAuth } from '../../hooks/useAuth';
import { NAV_ITEMS } from './navConfig';
import { cn, initials } from '../../lib/utils';
import type { ThemeMode } from '../../lib/types';

const themeOptions: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export function Topbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const theme = useAppSelector((s) => s.ui.theme);
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.is_admin ?? false;

  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-white/40 px-4 py-3 backdrop-blur-xl dark:bg-black/30">
      <button
        className="rounded-lg p-2 text-slate-600 hover:bg-black/5 lg:hidden dark:text-slate-300 dark:hover:bg-white/10"
        onClick={() => dispatch(setSidebar(true))}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <button
        onClick={() => dispatch(toggleCommand())}
        className="focus-ring flex h-10 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-white/60 px-3 text-sm text-slate-400 transition-colors hover:border-brand-400/40 dark:border-white/10 dark:bg-white/5"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Search everything…</span>
        <kbd className="hidden rounded border border-black/10 px-1.5 text-[10px] font-medium sm:inline dark:border-white/10">
          ⌘K
        </kbd>
      </button>

      {/* Theme switch */}
      <div className="flex items-center rounded-xl border border-black/10 bg-white/60 p-0.5 dark:border-white/10 dark:bg-white/5">
        {themeOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => dispatch(setTheme(opt.value))}
              title={opt.label}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-lg transition-colors',
                theme === opt.value
                  ? 'bg-brand-400/20 text-brand-700 dark:text-brand-300'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
              )}
              aria-label={opt.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="focus-ring flex items-center gap-2 rounded-xl border border-black/10 bg-white/60 p-1 pr-2 dark:border-white/10 dark:bg-white/5"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
            {user ? initials(user.full_name) : '?'}
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                className="glass-strong absolute right-0 z-20 mt-2 w-56 rounded-xl p-2"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{user?.full_name}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email}</p>
                </div>
                <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                {items.slice(0, 5).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      onClick={() => {
                        navigate(item.to);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <Icon size={15} className="text-slate-400" />
                      {item.label}
                    </button>
                  );
                })}
                <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-coral hover:bg-coral/10"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Search results are handled by the Command Palette */}
    </header>
  );
}
