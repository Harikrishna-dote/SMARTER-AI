import { MessageSquare } from 'lucide-react';
import { AIResponseRenderer } from '../chat/AIResponseRenderer';
import { EmptyState } from '../ui/primitives';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../hooks/useClassroom';

interface ChatViewProps {
  messages: ChatMessage[];
}

export function ChatView({ messages }: ChatViewProps) {
  if (messages.length === 0)
    return (
      <EmptyState
        icon={<MessageSquare size={28} />}
        title="No messages yet"
        description="Your conversation with the teacher appears here."
      />
    );
  return (
    <>
      {messages.map((m) => (
        <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
          <div
            className={cn(
              'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
              m.role === 'user'
                ? 'whitespace-pre-wrap bg-brand-gradient text-white'
                : 'bg-black/10 text-slate-100 dark:bg-white/10',
            )}
          >
            {m.role === 'assistant' ? (
              <AIResponseRenderer content={m.content} compact className="text-slate-100 dark:text-slate-100" />
            ) : (
              m.content
            )}
          </div>
        </div>
      ))}
    </>
  );
}
