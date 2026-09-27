import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Bookmark, Star, X, Trash2, Languages, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { GlassCard, Badge, Spinner, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../lib/utils';
import type {
  TranslationHistoryItem,
  BookmarkResponse,
  SavedPhraseResponse,
} from '../../lib/types';

type Section = 'history' | 'bookmarks' | 'favorites';

interface HistoryPanelProps {
  onClose: () => void;
  onLoadHistory: (item: TranslationHistoryItem) => void;
}

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'history', label: 'History', icon: <History size={16} /> },
  { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark size={16} /> },
  { id: 'favorites', label: 'Favorites', icon: <Star size={16} /> },
];

export function HistoryPanel({ onClose, onLoadHistory }: HistoryPanelProps) {
  const { toast } = useToast();
  const [section, setSection] = useState<Section>('history');
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([]);
  const [favorites, setFavorites] = useState<SavedPhraseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, b, f] = await Promise.all([
        api.translationHistory(),
        api.bookmarkList(),
        api.favoritesList(),
      ]);
      setHistory(h);
      setBookmarks(b);
      setFavorites(f);
    } catch {
      toast({ title: 'Failed to load saved items', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const clearAll = useCallback(async () => {
    setBusy(true);
    try {
      await api.clearTranslationHistory();
      setHistory([]);
      toast({ title: 'History cleared', variant: 'success' });
    } catch {
      toast({ title: 'Could not clear history', variant: 'error' });
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const deleteBookmark = useCallback(
    async (id: string) => {
      try {
        await api.deleteBookmark(id);
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      } catch {
        toast({ title: 'Could not delete bookmark', variant: 'error' });
      }
    },
    [toast],
  );

  const deleteFavorite = useCallback(
    async (id: string) => {
      try {
        await api.deleteFavorite(id);
        setFavorites((prev) => prev.filter((f) => f.id !== id));
      } catch {
        toast({ title: 'Could not delete favorite', variant: 'error' });
      }
    },
    [toast],
  );

  return (
    <GlassCard className="flex h-[70vh] flex-col p-0">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <History size={18} className="text-brand-500" />
          <h2 className="font-display text-lg font-bold">Saved & History</h2>
        </div>
        <button
          onClick={onClose}
          className="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-black/10 px-3 py-2 dark:border-white/10">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              section === s.id
                ? 'bg-brand-400/15 text-brand-700 dark:text-brand-300'
                : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} className="text-brand-500" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {section === 'history' && (
                <HistorySection
                  items={history}
                  onLoad={onLoadHistory}
                  onClear={clearAll}
                  busy={busy}
                />
              )}
              {section === 'bookmarks' && (
                <BookmarkSection items={bookmarks} onDelete={deleteBookmark} />
              )}
              {section === 'favorites' && (
                <FavoriteSection items={favorites} onDelete={deleteFavorite} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </GlassCard>
  );
}

function HistorySection({
  items,
  onLoad,
  onClear,
  busy,
}: {
  items: TranslationHistoryItem[];
  onLoad: (item: TranslationHistoryItem) => void;
  onClear: () => void;
  busy: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<History size={28} />}
        title="No history yet"
        description="Your recent translations will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="danger" onClick={onClear} loading={busy} leftIcon={!busy && <Trash2 size={14} />}>
          Clear all
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onLoad(item)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-left transition-colors hover:border-brand-400/50 dark:border-white/10 dark:bg-white/5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.original_content}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {item.translated_content}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <Badge tone="neutral">
                    <Languages size={11} /> {item.source_language.toUpperCase()} → {item.target_language.toUpperCase()}
                  </Badge>
                  <span>{formatRelativeTime(item.created_at)}</span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookmarkSection({
  items,
  onDelete,
}: {
  items: BookmarkResponse[];
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark size={28} />}
        title="No bookmarks"
        description="Bookmark translations to find them here later."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((b) => (
        <li
          key={b.id}
          className="rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{b.original_text}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{b.translated_text}</p>
            </div>
            <button
              onClick={() => onDelete(b.id)}
              className="focus-ring shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-coral/10 hover:text-coral"
              aria-label="Delete bookmark"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {b.note && <p className="mt-1 text-xs text-slate-400">{b.note}</p>}
          {b.tags && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {b.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <Badge key={t} tone="amber">
                    {t}
                  </Badge>
                ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function FavoriteSection({
  items,
  onDelete,
}: {
  items: SavedPhraseResponse[];
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Star size={28} />}
        title="No favorites"
        description="Save useful phrases as favorites to revisit them."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li
          key={f.id}
          className="rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{f.phrase}</p>
                {f.category && <Badge tone="brand">{f.category}</Badge>}
              </div>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{f.translation}</p>
              {f.context && <p className="mt-1 text-xs text-slate-400">{f.context}</p>}
              <p className="mt-1 text-xs text-slate-400">Used {f.usage_count}×</p>
            </div>
            <button
              onClick={() => onDelete(f.id)}
              className="focus-ring shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-coral/10 hover:text-coral"
              aria-label="Delete favorite"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
