import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { GlassCard } from '../ui/primitives';

interface SubtitlePanelProps {
  caption: string;
  captionChar: number;
}

export function SubtitlePanel({ caption, captionChar }: SubtitlePanelProps) {
  const captionWords = useMemo(() => caption.split(/(\s+)/), [caption]);
  const activeWordIndex = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < captionWords.length; i++) {
      const w = captionWords[i];
      if (captionChar <= acc + w.length && w.trim()) return i;
      acc += w.length;
    }
    return -1;
  }, [captionWords, captionChar]);

  return (
    <GlassCard className="p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare size={16} className="text-brand-400" /> Live captions
      </p>
      <div className="min-h-[64px] rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-100">
        {captionWords.map((w, i) => (
          <span key={i} className={i === activeWordIndex ? 'rounded bg-brand-400/40 px-0.5 text-white' : ''}>
            {w}
          </span>
        ))}
        {!caption && <span className="text-slate-400">Captions will appear here as your teacher speaks.</span>}
      </div>
    </GlassCard>
  );
}
