import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Save, Languages } from 'lucide-react';
import { GlassCard, Badge, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import type { WordAnalysisDetail } from '../../lib/types';

interface WordAnalysisPanelProps {
  analysis: WordAnalysisDetail | null;
  sourceLanguage: string;
  targetLanguage: string;
  onSaveVocabulary: () => void;
  onSpeak: (text: string, lang: string) => void;
}

const difficultyTone: Record<string, 'brand' | 'amber' | 'coral' | 'sky' | 'neutral'> = {
  beginner: 'brand',
  easy: 'brand',
  intermediate: 'amber',
  medium: 'amber',
  advanced: 'coral',
  hard: 'coral',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

export function WordAnalysisPanel({
  analysis,
  sourceLanguage,
  targetLanguage,
  onSaveVocabulary,
  onSpeak,
}: WordAnalysisPanelProps) {
  if (!analysis) {
    return (
      <GlassCard className="p-5">
        <EmptyState
          title="No word selected"
          description="Click a word in the translation to see its detailed analysis, pronunciation, and examples."
        />
      </GlassCard>
    );
  }

  const tone = difficultyTone[analysis.difficulty?.toLowerCase()] ?? 'neutral';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={analysis.original}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
      >
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-3xl font-bold">{analysis.original}</h2>
                <button
                  onClick={() => onSpeak(analysis.pronunciation || analysis.original, sourceLanguage)}
                  className="focus-ring rounded-lg p-1.5 text-brand-600 hover:bg-brand-400/10 dark:text-brand-300"
                  aria-label="Pronounce word"
                >
                  <Volume2 size={18} />
                </button>
              </div>
              {analysis.translation && (
                <p className="mt-1 flex items-center gap-1.5 text-lg text-slate-600 dark:text-slate-300">
                  <Languages size={16} className="text-brand-500" />
                  {analysis.translation}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {analysis.part_of_speech && <Badge tone="sky">{analysis.part_of_speech}</Badge>}
              {analysis.difficulty && <Badge tone={tone}>{analysis.difficulty}</Badge>}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {analysis.pronunciation && (
              <Section title="Pronunciation">
                <p className="text-sm text-slate-600 dark:text-slate-300">{analysis.pronunciation}</p>
              </Section>
            )}
            {analysis.ipa && (
              <Section title="IPA">
                <p className="text-sm text-slate-600 dark:text-slate-300">/{analysis.ipa}/</p>
              </Section>
            )}
            {analysis.meaning && (
              <Section title="Meaning">
                <p className="text-sm text-slate-600 dark:text-slate-300">{analysis.meaning}</p>
              </Section>
            )}
            {analysis.root_word && (
              <Section title="Root word">
                <p className="text-sm text-slate-600 dark:text-slate-300">{analysis.root_word}</p>
              </Section>
            )}
          </div>

          {(analysis.synonyms?.length > 0 || analysis.antonyms?.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {analysis.synonyms?.length > 0 && (
                <Section title="Synonyms">
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.synonyms.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-brand-400/10 px-2.5 py-0.5 text-xs text-brand-700 dark:text-brand-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
              {analysis.antonyms?.length > 0 && (
                <Section title="Antonyms">
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.antonyms.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-coral/10 px-2.5 py-0.5 text-xs text-coral"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {analysis.examples?.length > 0 && (
            <div className="mt-4">
              <Section title="Examples">
                <ul className="space-y-1.5">
                  {analysis.examples.map((ex, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300"
                    >
                      <span className="text-slate-400">•</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}

          {analysis.usage && (
            <div className="mt-4">
              <Section title="Usage notes">
                <p className="text-sm text-slate-600 dark:text-slate-300">{analysis.usage}</p>
              </Section>
            </div>
          )}

          {analysis.word_origin && (
            <div className="mt-4">
              <Section title="Word origin">
                <p className="text-sm text-slate-600 dark:text-slate-300">{analysis.word_origin}</p>
              </Section>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={onSaveVocabulary} leftIcon={<Save size={14} />}>
              Save to vocabulary
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSpeak(analysis.translation, targetLanguage)}
              leftIcon={<Volume2 size={14} />}
            >
              Speak translation
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
