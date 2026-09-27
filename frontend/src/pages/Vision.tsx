import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, ImageUp, ScanText, Sparkles, UploadCloud, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GlassCard, PageHeader } from '../components/ui/primitives';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import { cn, formatBytes } from '../lib/utils';

type Mode = 'ocr' | 'analyze';

export default function Vision() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = useCallback((selected: File | null) => {
    if (!selected) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setResult('');
  }, [previewUrl]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      handleFileSelected(selected);
      e.target.value = '';
    },
    [handleFileSelected],
  );

  const resetFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setResult('');
  }, [previewUrl]);

  const run = useCallback(
    async (mode: Mode) => {
      if (!file) {
        toast({
          title: 'No image selected',
          description: 'Upload an image first to extract text or analyze it.',
          variant: 'info',
        });
        return;
      }

      setLoadingMode(mode);
      setResult('');
      try {
        const output = mode === 'ocr' ? await api.ocr(file) : await api.analyzeImage(file);
        setResult(output);
        toast({
          title: mode === 'ocr' ? 'Text extracted' : 'Image analyzed',
          variant: 'success',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        toast({ title: 'Request failed', description: message, variant: 'error' });
      } finally {
        setLoadingMode(null);
      }
    },
    [file, toast],
  );

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      toast({ title: 'Copied to clipboard', variant: 'success' });
    } catch {
      toast({ title: 'Copy failed', variant: 'error' });
    }
  }, [result, toast]);

  const hasFile = Boolean(file);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Vision"
        subtitle="Extract text and analyze images, screenshots, and whiteboards."
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInputChange}
      />

      <GlassCard className="p-5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center transition-all',
            'border-brand-400/30 hover:border-brand-400/60 hover:bg-brand-400/5',
            'focus-ring cursor-pointer',
          )}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-400/15 text-brand-400 transition-transform group-hover:scale-105">
            <UploadCloud size={26} />
          </span>
          <span className="font-display text-lg font-semibold">Drop or click to upload an image</span>
          <span className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            PNG, JPG, WEBP or GIF. We'll extract text or describe what we see.
          </span>
        </button>
      </GlassCard>

      {hasFile && previewUrl && (
        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
              <img
                src={previewUrl}
                alt={file?.name ?? 'Selected image preview'}
                className="max-h-64 w-full object-contain sm:w-64"
              />
              <button
                type="button"
                onClick={resetFile}
                aria-label="Remove image"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 focus-ring"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-4">
              <div>
                <p className="break-all font-medium text-ink dark:text-chalk">{file?.name}</p>
                {file && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {formatBytes(file.size)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  loading={loadingMode === 'ocr'}
                  disabled={loadingMode !== null}
                  leftIcon={<ScanText size={18} />}
                  onClick={() => run('ocr')}
                >
                  Extract text (OCR)
                </Button>
                <Button
                  variant="secondary"
                  loading={loadingMode === 'analyze'}
                  disabled={loadingMode !== null}
                  leftIcon={<Sparkles size={18} />}
                  onClick={() => run('analyze')}
                >
                  Analyze image
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {!hasFile && (
        <GlassCard className="flex flex-col items-center justify-center gap-3 p-5 text-center">
          <span className="text-slate-400">
            <ImageUp size={28} />
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No image yet. Upload one above to get started.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="primary"
              disabled
              leftIcon={<ScanText size={18} />}
              onClick={() => run('ocr')}
            >
              Extract text (OCR)
            </Button>
            <Button
              variant="secondary"
              disabled
              leftIcon={<Sparkles size={18} />}
              onClick={() => run('analyze')}
            >
              Analyze image
            </Button>
          </div>
        </GlassCard>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlassCard className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Result</h2>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Copy size={16} />}
                onClick={copyResult}
              >
                Copy
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink dark:text-chalk">
              {result}
            </pre>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
