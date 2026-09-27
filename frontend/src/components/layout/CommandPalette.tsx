import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Fuse from 'fuse.js';
import { Search, CornerDownLeft, FileText, MessageSquare } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setCommandOpen } from '../../store/uiSlice';
import { NAV_ITEMS } from './navConfig';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { SearchResultItem } from '../../lib/types';

export function CommandPalette() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((s) => s.ui.commandOpen);
  const isAdmin = useAppSelector((s) => s.auth.user?.is_admin ?? false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<SearchResultItem[]>([]);

  const pages = useMemo(
    () => NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => ({
      id: `page-${i.to}`,
      title: i.label,
      type: 'page' as const,
      href: i.to,
      description: i.description,
      snippet: '',
    })),
    [isAdmin],
  );

  const fuse = useMemo(
    () => new Fuse([...pages, ...remote], { keys: ['title', 'description', 'snippet'], threshold: 0.4 }),
    [pages, remote],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .searchIndex()
      .then((items) => !cancelled && setRemote(items))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const results = query.trim() ? fuse.search(query).map((r) => r.item) : [...pages, ...remote].slice(0, 8);

  const go = (href: string) => {
    dispatch(setCommandOpen(false));
    setQuery('');
    navigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[active];
      if (item) go(item.href);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => dispatch(setCommandOpen(false))} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="glass-strong relative w-full max-w-xl overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search size={18} className="text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages, documents, conversations…"
                className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded border border-black/10 px-1.5 py-0.5 text-[10px] dark:border-white/10">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">No results for “{query}”</p>
              )}
              {results.map((r, i) => {
                const Icon = r.type === 'document' ? FileText : r.type === 'chat' ? MessageSquare : Search;
                return (
                  <button
                    key={r.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      i === active ? 'bg-brand-400/15' : 'hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <Icon size={16} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      {r.snippet && (
                        <span className="block truncate text-xs text-slate-400">{r.snippet}</span>
                      )}
                    </span>
                    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-400 dark:bg-white/10">
                      {r.type}
                    </span>
                    {i === active && <CornerDownLeft size={14} className="text-brand-400" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
