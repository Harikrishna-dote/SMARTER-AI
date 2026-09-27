import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Plus, Tag } from 'lucide-react';
import { GlassCard, Badge, Spinner, EmptyState, PageHeader } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { MemoryItem } from '../lib/types';
import { formatRelativeTime } from '../lib/utils';

function useMemoryList(): {
  items: MemoryItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
} {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMemory();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { items, loading, error, reload, setItems };
}

export default function Memory() {
  const { items, loading, setItems } = useMemoryList();
  const { toast, reducedMotion } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = content.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await api.createMemory({
        content: content.trim(),
        category: category.trim() || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setContent('');
      setCategory('');
      setOpen(false);
      toast({ title: 'Memory saved', description: 'Your tutor will recall this.', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Could not save memory',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const entrance = reducedMotion ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Memory"
        subtitle="Persistent knowledge your tutor recalls automatically."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
            Add memory
          </Button>
        }
      />

      {loading ? (
        <GlassCard className="flex min-h-[40vh] items-center justify-center p-10">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Spinner size={24} className="text-brand-400" />
            <p className="text-sm">Loading memories…</p>
          </div>
        </GlassCard>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Brain size={40} />}
          title="No memories yet"
          description="Add a fact or note for your tutor to remember."
          action={
            <Button leftIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
              Add memory
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {items.map((m) => (
              <motion.div
                key={m.id}
                layout={!reducedMotion}
                initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlassCard className="h-full p-5">
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      {m.category ? (
                        <Badge tone="brand">
                          <Tag size={12} />
                          {m.category}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatRelativeTime(m.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink dark:text-chalk">
                      {m.content}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !submitting && setOpen(false)}
        title="Add memory"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
              Save memory
            </Button>
          </>
        }
      >
        <motion.div {...entrance} className="flex flex-col gap-4">
          <TextArea
            label="Content"
            placeholder="What should your tutor remember?"
            value={content}
            onChange={setContent}
            rows={5}
            error={content.length === 0 && submitting ? 'Content is required' : null}
          />
          <Input
            label="Category"
            placeholder="e.g. preferences, facts, goals"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            leftIcon={<Tag size={16} />}
          />
        </motion.div>
      </Modal>
    </div>
  );
}
