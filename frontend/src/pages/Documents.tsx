import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  UploadCloud,
  Send,
  File as FileIcon,
  Loader2,
} from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { cn, formatRelativeTime } from '../lib/utils';
import type { DocumentItem } from '../lib/types';

export default function Documents() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState<DocumentItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listDocuments();
      setDocs(list);
      setActive((cur) => cur ?? list[0] ?? null);
    } catch {
      toast({ title: 'Could not load documents', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const created = await api.uploadDocument(files[0]);
      setDocs((prev) => [created, ...prev]);
      setActive(created);
      toast({ title: 'Document uploaded', description: created.filename, variant: 'success' });
    } catch {
      toast({ title: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload files and ask questions grounded in their content."
        actions={
          <Button leftIcon={<UploadCloud size={16} />} onClick={() => fileRef.current?.click()} loading={uploading}>
            Upload
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
        onChange={(e) => onUpload(e.target.files)}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <GlassCard className="p-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-400/40 bg-brand-400/5 px-3 py-6 text-center transition-colors hover:bg-brand-400/10"
          >
            <UploadCloud size={22} className="text-brand-400" />
            <p className="text-sm font-medium">Drop or click to upload</p>
            <p className="text-xs text-slate-400">PDF, DOCX, TXT, images</p>
          </div>
          <div className="no-scrollbar max-h-[60vh] space-y-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size={20} className="text-brand-400" />
              </div>
            ) : docs.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">No documents yet</p>
            ) : (
              docs.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setActive(d)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    active?.id === d.id ? 'bg-brand-400/15 text-brand-700 dark:text-brand-300' : 'hover:bg-black/5 dark:hover:bg-white/5',
                  )}
                >
                  <FileText size={15} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.filename}</p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(d.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Reader / chat */}
        <GlassCard className="flex min-h-[400px] flex-col p-5">
          {!active ? (
            <EmptyState
              icon={<FileIcon size={28} />}
              title="No document selected"
              description="Upload a document to preview its text and chat with it."
            />
          ) : (
            <DocChat key={active.id} doc={active} />
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function DocChat({ doc }: { doc: DocumentItem }) {
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = async () => {
    const q = question.trim();
    if (!q || thinking) return;
    setThinking(true);
    setAnswer(null);
    try {
      const res = await api.chatWithDocument(doc.id, q);
      setAnswer(res.answer);
      setQuestion('');
    } catch {
      toast({ title: 'Could not answer', variant: 'error' });
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">{doc.filename}</h2>
          <Badge tone="neutral">{doc.content_type}</Badge>
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/5 p-3 dark:bg-white/5">
        {answer ? (
          <div className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-brand-600 dark:text-brand-300">Answer</p>
            <p className="whitespace-pre-wrap leading-relaxed">{answer}</p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">
            Ask a question about this document to get a grounded answer.
          </p>
        )}
        {thinking && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          rows={1}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          placeholder="Ask about this document…"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:bg-white/5"
        />
        <Button onClick={ask} disabled={!question.trim()} loading={thinking} leftIcon={<Send size={16} />}>
          Ask
        </Button>
      </div>
    </>
  );
}
