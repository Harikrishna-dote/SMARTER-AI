import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ScanLine, X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { GlassCard, Badge, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Input';
import type { OCRBox, OCRResponse } from '../../lib/types';

interface OCRScannerProps {
  language: string;
  onScanComplete: (result: OCRResponse, selectedText: string) => void;
  onClose: () => void;
  onTextSelect?: (text: string, boxes: OCRBox[]) => void;
}

export function OCRScanner({ language, onScanComplete, onClose, onTextSelect }: OCRScannerProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResponse | null>(null);
  const [detectedText, setDetectedText] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const acceptFile = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (!f.type.startsWith('image/')) {
        toast({ title: 'Invalid file', description: 'Please upload an image file.', variant: 'error' });
        return;
      }
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
      setResult(null);
      setDetectedText('');
      setSelected(new Set());
    },
    [previewUrl, toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile],
  );

  const runScan = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await api.ocrImage(file, language);
      setResult(res);
      setDetectedText(res.text);
      setSelected(new Set());
      onScanComplete(res, res.text);
      toast({ title: 'Scan complete', description: `Detected ${res.boxes.length} text region(s).`, variant: 'success' });
    } catch {
      toast({ title: 'OCR failed', description: 'Could not read the image. Please try another.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [file, language, onScanComplete, toast]);

  const toggleBox = useCallback(
    (index: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    },
    [],
  );

  const selectedText = useMemo(() => {
    if (!result) return detectedText;
    if (selected.size === 0) return detectedText;
    return result.boxes
      .filter((_, i) => selected.has(i))
      .map((b) => b.text)
      .join(' ');
  }, [result, selected, detectedText]);

  const selectedBoxes = useMemo(
    () => (result ? result.boxes.filter((_, i) => selected.has(i)) : []),
    [result, selected],
  );

  const commitSelection = useCallback(() => {
    if (result) onTextSelect?.(selectedText, selectedBoxes);
  }, [result, selectedText, selectedBoxes, onTextSelect]);

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Scan Image</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload an image to extract text via OCR
          </p>
        </div>
        <button
          onClick={onClose}
          className="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
          aria-label="Close scanner"
        >
          <X size={18} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />

      {!previewUrl ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all',
            isDragging
              ? 'border-brand-400 bg-brand-400/10'
              : 'border-black/10 hover:border-brand-400/60 dark:border-white/10',
          )}
        >
          <div className="rounded-2xl bg-brand-400/10 p-4 text-brand-600 dark:text-brand-300">
            <Upload size={28} />
          </div>
          <div>
            <p className="font-semibold">Drop an image here</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">or click to browse</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10">
            <img src={previewUrl} alt="Upload preview" className="max-h-[360px] w-full object-contain" />
            {result?.boxes.map((box, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleBox(i)}
                onMouseUp={commitSelection}
                title={box.text}
                className={cn(
                  'absolute border-2 transition-colors',
                  selected.has(i)
                    ? 'border-amber bg-amber/30'
                    : 'border-sky/70 bg-sky/10 hover:bg-sky/25',
                )}
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runScan} loading={loading} leftIcon={!loading && <ScanLine size={16} />}>
              {loading ? 'Scanning…' : 'Scan'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFile(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setResult(null);
                setDetectedText('');
                setSelected(new Set());
              }}
              leftIcon={<ImageIcon size={16} />}
            >
              Change image
            </Button>
            {selected.size > 0 && (
              <Badge tone="amber">
                {selected.size} selected
              </Badge>
            )}
          </div>

          <TextArea
            label="Detected text"
            value={selectedText}
            onChange={setDetectedText}
            rows={5}
            placeholder="Detected text will appear here. Click boxes on the image to select specific regions."
          />

          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-2"
              >
                <Button size="sm" variant="outline" onClick={commitSelection} leftIcon={<CheckCircle2 size={14} />}>
                  Use selected text
                </Button>
                <button
                  className="text-sm text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSelected(new Set())}
                >
                  Clear selection
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {result && result.boxes.length === 0 && (
            <EmptyState title="No text found" description="We couldn't detect any text in this image." />
          )}
        </div>
      )}
    </GlassCard>
  );
}
