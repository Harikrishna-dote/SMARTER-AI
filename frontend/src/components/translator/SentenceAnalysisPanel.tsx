import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Languages } from 'lucide-react';
import { GlassCard, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import type { SentenceAnalysisDetail, WordMeaning } from '../../lib/types';

interface SentenceAnalysisPanelProps {
  analysis: SentenceAnalysisDetail | null;
  sourceLanguage: string;
  targetLanguage: string;
  onSpeak: (text: string, lang: string) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

function VersionRow({
  label,
  value,
  lang,
  onSpeak,
}: {
  label: string;
  value: string;
  lang: string;
  onSpeak: (text: string, lang: string) => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-black/5 px-3 py-2 dark:bg-white/5">
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{value}</p>
      </div>
      <button
        onClick={() => onSpeak(value, lang)}
        className="focus-ring shrink-0 rounded-lg p-1.5 text-brand-600 hover:bg-brand-400/10 dark:text-brand-300"
        aria-label={`Speak ${label}`}
      >
        <Volume2 size={15} />
      </button>
    </div>
  );
}

export function SentenceAnalysisPanel({
  analysis,
  sourceLanguage,
  targetLanguage,
  onSpeak,
}: SentenceAnalysisPanelProps) {
  if (!analysis) {
    return (
      <GlassCard className="p-5">
        <EmptyState
          title="No sentence analyzed"
          description="Select a sentence to view its breakdown, grammar notes, and style variations."
        />
      </GlassCard>
    );
  }

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
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-display text-xl font-semibold">{analysis.original}</p>
              {analysis.translation && (
                <p className="mt-1 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Languages size={15} className="text-brand-500" />
                  {analysis.translation}
                </p>
              )}
            </div>
            <button
              onClick={() => onSpeak(analysis.original, sourceLanguage)}
              className="focus-ring shrink-0 rounded-lg p-1.5 text-brand-600 hover:bg-brand-400/10 dark:text-brand-300"
              aria-label="Speak sentence"
            >
              <Volume2 size={18} />
            </button>
          </div>

          {(analysis.word_by_word?.length > 0) && (
            <div className="mt-4 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
              <Section title="Word-by-word breakdown">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-black/5 text-left text-xs uppercase tracking-wide text-slate-400 dark:bg-white/5">
                        <th className="px-3 py-2 font-semibold">Word</th>
                        <th className="px-3 py-2 font-semibold">Meaning</th>
                        <th className="px-3 py-2 font-semibold">Translation</th>
                        <th className="px-3 py-2 font-semibold">Transliteration</th>
                        <th className="px-3 py-2 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.word_by_word.map((w: WordMeaning, i) => (
                        <tr key={i} className="border-t border-black/5 dark:border-white/5">
                          <td className="px-3 py-2 font-medium">{w.source}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{w.meaning}</td>
                          <td className="px-3 py-2 text-brand-700 dark:text-brand-300">{w.translation}</td>
                          <td className="px-3 py-2 text-slate-500">{w.transliteration}</td>
                          <td className="px-3 py-2 text-slate-500">{w.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

          {analysis.grammar_notes?.length > 0 && (
            <div className="mt-4">
              <Section title="Grammar notes">
                <ul className="space-y-1.5">
                  {analysis.grammar_notes.concat(analysis.grammar ?? []).map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="text-brand-500">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}

          <div className="mt-4 grid gap-2">
            <VersionRow label="Overall meaning" value={analysis.overall_meaning || analysis.meaning} lang={targetLanguage} onSpeak={onSpeak} />
            <VersionRow label="Formal" value={analysis.formal_version} lang={targetLanguage} onSpeak={onSpeak} />
            <VersionRow label="Informal" value={analysis.informal_version} lang={targetLanguage} onSpeak={onSpeak} />
            <VersionRow label="Natural" value={analysis.natural_version} lang={targetLanguage} onSpeak={onSpeak} />
          </div>

          {analysis.similar_sentences?.length > 0 && (
            <div className="mt-4">
              <Section title="Similar sentences">
                <ul className="space-y-1.5">
                  {analysis.similar_sentences.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-lg bg-black/5 px-3 py-2 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => onSpeak(analysis.translation, targetLanguage)} leftIcon={<Volume2 size={14} />}>
              Speak translation
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
