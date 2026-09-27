import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Upload, Mic, Copy, Download, Volume2 } from 'lucide-react';
import { GlassCard, PageHeader, Spinner } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { TextArea } from '../components/ui/Input';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import { formatBytes, downloadBlob } from '../lib/utils';

export default function Voice() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [synthesizing, setSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAudioFile(file);
    setTranscription('');
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    try {
      const text = await api.transcribe(audioFile);
      setTranscription(text);
      toast({ title: 'Transcription complete', variant: 'success' as const });
    } catch {
      toast({ title: 'Transcription failed', description: 'Please try again with a different file.', variant: 'error' as const });
    } finally {
      setTranscribing(false);
    }
  };

  const handleCopy = async () => {
    if (!transcription) return;
    await navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = async () => {
    if (!ttsText.trim()) return;
    setSynthesizing(true);
    try {
      const blob = await api.synthesize(ttsText);
      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      toast({ title: 'Speech generated', variant: 'success' as const });
    } catch {
      toast({ title: 'Speech synthesis failed', description: 'Please try again.', variant: 'error' as const });
    } finally {
      setSynthesizing(false);
    }
  };

  const handleDownload = () => {
    if (audioBlob) {
      downloadBlob(audioBlob, 'speech.mp3');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Voice"
        subtitle="Speech-to-text and natural text-to-speech, with English, Hindi, and Telugu."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <GlassCard className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15 text-brand-700 dark:text-brand-300">
              <Mic size={18} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Speech to Text</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Convert audio into text</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="space-y-4">
            <Button
              variant="secondary"
              fullWidth
              leftIcon={<Upload size={16} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {audioFile ? audioFile.name : 'Choose audio file'}
            </Button>

            {audioFile && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatBytes(audioFile.size)}
              </p>
            )}

            <Button
              fullWidth
              onClick={handleTranscribe}
              loading={transcribing}
              disabled={!audioFile}
            >
              Transcribe
            </Button>

            {(transcription || transcribing) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                <div className="glass rounded-xl p-4 whitespace-pre-wrap text-sm text-ink dark:text-chalk">
                  {transcribing ? (
                    <span className="inline-flex items-center gap-2 text-slate-400">
                      <Spinner size={14} /> Transcribing...
                    </span>
                  ) : (
                    transcription || 'No text transcribed yet.'
                  )}
                </div>
                {transcription && !transcribing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2"
                    leftIcon={copied ? <Copy size={14} /> : <Copy size={14} />}
                    onClick={handleCopy}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </motion.div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15 text-brand-700 dark:text-brand-300">
              <Volume2 size={18} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Text to Speech</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Generate speech from text</p>
            </div>
          </div>

          <div className="space-y-4">
            <TextArea
              label=""
              value={ttsText}
              onChange={setTtsText}
              placeholder="Enter text to speak..."
              rows={5}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                fullWidth
                onClick={handleSpeak}
                loading={synthesizing}
                disabled={!ttsText.trim()}
              >
                Speak
              </Button>
            </div>

            {(audioUrl || synthesizing) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-white/70 p-3 dark:bg-white/5"
              >
                {synthesizing ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Spinner size={14} /> Generating speech...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <audio controls src={audioUrl ?? ''} className="w-full" />
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      leftIcon={<Download size={14} />}
                      onClick={handleDownload}
                    >
                      Download audio
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
