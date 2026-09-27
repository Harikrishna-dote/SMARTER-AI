import { Languages, Mic, Volume2, VolumeX } from 'lucide-react';
import { GlassCard, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { useVoice } from '../../hooks/useVoice';
import type { LanguageOption } from '../../lib/types';

interface VoicePanelProps {
  voice: ReturnType<typeof useVoice>;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  voiceSpeed: number;
  setVoiceSpeed: React.Dispatch<React.SetStateAction<number>>;
  languages: LanguageOption[];
  language: string;
  onChangeLanguage: (language: string) => void;
}

export function VoicePanel({
  voice,
  ttsEnabled,
  onToggleTts,
  voiceSpeed,
  setVoiceSpeed,
  languages,
  language,
  onChangeLanguage,
}: VoicePanelProps) {
  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-center justify-between text-sm font-medium">
        <span className="flex items-center gap-2">
          <Mic size={16} className="text-brand-400" /> Voice
        </span>
        <Button
          size="sm"
          variant={voice.listening ? 'danger' : 'secondary'}
          onClick={() => (voice.listening ? voice.stopListening() : voice.startListening(() => undefined))}
          disabled={!voice.supported}
        >
          {voice.listening ? 'Listening…' : 'Mic ready'}
        </Button>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Voice speed</span>
          <span>{voiceSpeed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.6}
          max={1.4}
          step={0.1}
          value={voiceSpeed}
          onChange={(e) => setVoiceSpeed(Number(e.target.value))}
          className="w-full accent-brand-400"
        />
      </div>
      <div>
        <label className="mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Languages size={14} /> Language (applies live)
        </label>
        <select
          className="h-10 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
          value={language}
          onChange={(e) => onChangeLanguage(e.target.value)}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <Button
        variant="outline"
        size="sm"
        fullWidth
        leftIcon={voice.speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
        onClick={onToggleTts}
      >
        {ttsEnabled ? 'Voice on' : 'Voice off'}
      </Button>
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        <Badge tone="brand">{language}</Badge>
      </div>
    </GlassCard>
  );
}
