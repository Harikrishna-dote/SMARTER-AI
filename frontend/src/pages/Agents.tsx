import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Play,
  Plus,
  Sparkles,
  Wrench,
  TerminalSquare,
} from 'lucide-react';

import {
  Badge,
  EmptyState,
  GlassCard,
  PageHeader,
  Skeleton,
} from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { AgentConfig, AgentRunResponse } from '../lib/types';
import { cn, formatRelativeTime } from '../lib/utils';

export default function Agents() {
  const { toast } = useToast();

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function loadAgents() {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.listAgents();
      setAgents(data);
    } catch (err) {
      setLoadError(true);
      toast({
        title: 'Failed to load agents',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  async function handleCreate(payload: {
    name: string;
    description?: string;
    system_prompt?: string;
    tools: string[];
  }) {
    setCreating(true);
    try {
      const created = await api.createAgent({
        name: payload.name,
        description: payload.description,
        system_prompt: payload.system_prompt,
        tools: payload.tools,
      });
      setAgents((prev) => [created, ...prev]);
      setCreateOpen(false);
      toast({
        title: 'Agent created',
        description: `"${created.name}" is ready to run.`,
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Could not create agent',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Agents"
        subtitle="Autonomous workflows that chain tools to get things done."
        actions={
          <Button
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            New agent
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : agents.length === 0 && !loadError ? (
        <EmptyState
          icon={<Bot size={42} />}
          title="No agents yet"
          description="Create an agent to automate a task by chaining together tools."
          action={
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => setCreateOpen(true)}
            >
              New agent
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
              onRunError={(message) =>
                toast({
                  title: 'Agent run failed',
                  description: message,
                  variant: 'error',
                })
              }
            />
          ))}
        </div>
      )}

      <CreateAgentModal
        open={createOpen}
        loading={creating}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}

interface AgentCardProps {
  agent: AgentConfig;
  index: number;
  onRunError: (message: string) => void;
}

interface RunState {
  task: string;
  loading: boolean;
  result: AgentRunResponse | null;
}

function AgentCard({ agent, index, onRunError }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [run, setRun] = useState<RunState>({
    task: '',
    loading: false,
    result: null,
  });

  const tools = agent.tools ?? [];

  async function handleRun(event: FormEvent) {
    event.preventDefault();
    if (!run.task.trim() || run.loading) return;
    setRun((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const result = await api.runAgent(agent.id, { task: run.task.trim() });
      setRun((prev) => ({ ...prev, loading: false, result }));
    } catch (err) {
      setRun((prev) => ({ ...prev, loading: false }));
      onRunError(err instanceof Error ? err.message : 'The agent did not respond.');
    }
  }

  return (
    <GlassCard
      hover
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15 text-brand-400">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold">
              {agent.name}
            </h3>
            {agent.created_at && (
              <p className="text-xs text-slate-400">
                Created {formatRelativeTime(agent.created_at)}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Play size={14} />}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Close' : 'Run'}
        </Button>
      </div>

      {agent.description && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {agent.description}
        </p>
      )}

      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <Badge key={tool} tone="brand">
              <Wrench size={12} />
              {tool}
            </Badge>
          ))}
        </div>
      )}

      {expanded && (
        <motion.form
          onSubmit={handleRun}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10"
        >
          <TextArea
            label="Task"
            rows={3}
            placeholder="Describe what this agent should do…"
            value={run.task}
            onChange={(value) => setRun((prev) => ({ ...prev, task: value }))}
          />
          <Button
            type="submit"
            loading={run.loading}
            disabled={!run.task.trim()}
            leftIcon={!run.loading ? <Play size={16} /> : undefined}
          >
            {run.loading ? 'Running…' : 'Run agent'}
          </Button>

          {run.result && (
            <div className="flex flex-col gap-3 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-400">
                  <TerminalSquare size={14} />
                  Output
                </div>
                <pre className="whitespace-pre-wrap break-words text-sm text-ink dark:text-chalk">
                  {run.result.output}
                </pre>
              </div>

              {run.result.tool_calls.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Wrench size={14} />
                    Tool calls
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {run.result.tool_calls.map((call, i) => (
                      <li
                        key={`${call}-${i}`}
                        className="rounded-lg border border-black/10 bg-white/60 px-3 py-2 font-mono text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      >
                        {call}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </motion.form>
      )}
    </GlassCard>
  );
}

interface CreateAgentModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    system_prompt?: string;
    tools: string[];
  }) => void | Promise<void>;
}

function CreateAgentModal({
  open,
  loading,
  onClose,
  onSubmit,
}: CreateAgentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [toolsText, setToolsText] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setSystemPrompt('');
    setToolsText('');
    setNameError(null);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Name is required.');
      return;
    }
    setNameError(null);

    const tools = toolsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    void Promise.resolve(
      onSubmit({
        name: trimmedName,
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
        tools,
      }),
    ).then(() => {
      if (!loading) reset();
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New agent"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-agent-form"
            loading={loading}
            leftIcon={!loading ? <Plus size={16} /> : undefined}
          >
            Create agent
          </Button>
        </>
      }
    >
      <form
        id="create-agent-form"
        onSubmit={handleSubmit}
        className={cn('flex flex-col gap-4')}
      >
        <Input
          label="Name"
          placeholder="e.g. Research Assistant"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          leftIcon={<Bot size={16} />}
        />
        <Input
          label="Description"
          hint="Optional short summary of what this agent does."
          placeholder="A helpful assistant that…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextArea
          label="System prompt"
          hint="Optional instructions that define the agent's behavior."
          rows={4}
          placeholder="You are a careful assistant that…"
          value={systemPrompt}
          onChange={setSystemPrompt}
        />
        <Input
          label="Tools"
          hint="Comma-separated list, e.g. web_search, calculator"
          placeholder="web_search, calculator"
          value={toolsText}
          onChange={(e) => setToolsText(e.target.value)}
          leftIcon={<Wrench size={16} />}
        />
      </form>
    </Modal>
  );
}
