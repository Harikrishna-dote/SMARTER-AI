import { PenLine } from 'lucide-react';
import { Spinner, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import type { GeneratedNotes } from '../../lib/types';

interface NotesPanelProps {
  notes: GeneratedNotes | null;
  loading: boolean;
  onGenerate: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

export function NotesPanel({ notes, loading, onGenerate }: NotesPanelProps) {
  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (!notes)
    return (
      <EmptyState
        icon={<PenLine size={28} />}
        title="No notes yet"
        description="Generate notes from the lesson."
        action={<Button size="sm" onClick={onGenerate}>Generate notes</Button>}
      />
    );
  return (
    <div className="space-y-4">
      <Section title="Summary">
        <p className="text-sm">{notes.summary}</p>
      </Section>
      <Section title="Key points">
        <ul className="ml-5 list-disc space-y-1 text-sm">
          {notes.key_points.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </Section>
      {notes.formula_sheet.length > 0 && (
        <Section title="Formula sheet">
          <pre className="whitespace-pre-wrap font-mono text-xs">{notes.formula_sheet.join('\n')}</pre>
        </Section>
      )}
      {notes.flashcards.length > 0 && (
        <Section title="Flashcards">
          {notes.flashcards.map((f, i) => (
            <div key={i} className="mb-2 rounded-xl border border-black/10 p-2 dark:border-white/10">
              <p className="text-sm font-semibold">{f.term}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{f.definition}</p>
            </div>
          ))}
        </Section>
      )}
      {notes.mindmap && (
        <Section title="Mind map">
          <pre className="whitespace-pre-wrap font-mono text-xs">{notes.mindmap}</pre>
        </Section>
      )}
      <Button size="sm" variant="outline" onClick={onGenerate}>
        Regenerate
      </Button>
    </div>
  );
}
