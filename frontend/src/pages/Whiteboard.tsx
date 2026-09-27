import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Circle,
  Type,
  Square,
  MousePointer2,
} from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { WhiteboardResponse } from '../lib/types';
import { cn } from '../lib/utils';

type ElementType = 'circle' | 'text' | 'rect';

interface WhiteboardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  color: string;
  text?: string;
  width?: number;
  height?: number;
}

const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export default function Whiteboard() {
  const { toast } = useToast();
  const [boards, setBoards] = useState<WhiteboardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeBoard, setActiveBoard] = useState<WhiteboardResponse | null>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [selectedTool, setSelectedTool] = useState<ElementType>('circle');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [newTitle, setNewTitle] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  const loadBoards = async () => {
    try {
      const data = await api.listWhiteboards();
      setBoards(data);
    } catch {
      toast({ title: 'Could not load whiteboards', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, [toast]);

  const openBoard = async (board: WhiteboardResponse) => {
    setActiveBoard(board);
    try {
      const parsed = Array.isArray(board.elements)
        ? board.elements.map((el: Record<string, unknown>) => ({
            id: String(el.id ?? crypto.randomUUID()),
            type: (el.type as ElementType) || 'circle',
            x: typeof el.x === 'number' ? el.x : 0,
            y: typeof el.y === 'number' ? el.y : 0,
            color: typeof el.color === 'string' ? el.color : COLORS[0],
            text: typeof el.text === 'string' ? el.text : undefined,
            width: typeof el.width === 'number' ? el.width : undefined,
            height: typeof el.height === 'number' ? el.height : undefined,
          }))
        : [];
      setElements(parsed);
    } catch {
      setElements([]);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const payload = {
        title: newTitle.trim(),
        group_id: newGroupId.trim() || null,
        elements: [] as Record<string, unknown>[],
      };
      const created = await api.createWhiteboard(payload);
      setBoards((prev) => [created, ...prev]);
      setNewTitle('');
      setNewGroupId('');
      setShowCreate(false);
      toast({ title: 'Whiteboard created', variant: 'success' });
    } catch {
      toast({ title: 'Could not create whiteboard', variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!activeBoard) return;
    setSaving(true);
    try {
      const payload = {
        title: activeBoard.title,
        group_id: activeBoard.group_id,
        elements: elements.map((el) => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          color: el.color,
          ...(el.text && { text: el.text }),
          ...(el.width && { width: el.width }),
          ...(el.height && { height: el.height }),
        })),
        is_public: activeBoard.is_public,
      };
      const updated = await api.updateWhiteboard(activeBoard.id, payload);
      setActiveBoard(updated);
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast({ title: 'Whiteboard saved', variant: 'success' });
    } catch {
      toast({ title: 'Could not save whiteboard', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async () => {
    if (!activeBoard) return;
    try {
      const payload = {
        title: activeBoard.title,
        group_id: activeBoard.group_id,
        elements: elements.map((el) => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          color: el.color,
        })),
        is_public: !activeBoard.is_public,
      };
      const updated = await api.updateWhiteboard(activeBoard.id, payload);
      setActiveBoard(updated);
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      toast({ title: 'Could not update visibility', variant: 'error' });
    }
  };

  const addElement = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const newEl: WhiteboardElement = {
        id: crypto.randomUUID(),
        type: selectedTool,
        x,
        y,
        color: selectedColor,
        ...(selectedTool === 'text' && { text: 'Text' }),
        ...(selectedTool === 'rect' && { width: 80, height: 60 }),
      };
      setElements((prev) => [...prev, newEl]);
    },
    [selectedTool, selectedColor],
  );

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId) return;
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).hasAttribute('data-canvas-bg')) return;
    addElement(e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent, el: WhiteboardElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingId(el.id);
    setDragOffset({
      x: e.clientX - rect.left - el.x,
      y: e.clientY - rect.top - el.y,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingId || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      setElements((prev) =>
        prev.map((el) => (el.id === draggingId ? { ...el, x, y } : el)),
      );
    },
    [draggingId, dragOffset],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  useEffect(() => {
    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingId, handleMouseMove, handleMouseUp]);

  const deleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
  };

  const closeBoard = () => {
    setActiveBoard(null);
    setElements([]);
  };

  const renderElement = (el: WhiteboardElement) => {
    const isDragging = draggingId === el.id;
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      cursor: isDragging ? 'grabbing' : 'grab',
      transform: 'translate(-50%, -50%)',
    };

    if (el.type === 'circle') {
      return (
        <div
          key={el.id}
          onMouseDown={(e) => handleMouseDown(e, el)}
          style={{
            ...baseStyle,
            width: 32,
            height: 32,
            backgroundColor: el.color,
            borderRadius: '50%',
          }}
          className="rounded-full shadow-md"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-white"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      );
    }

    if (el.type === 'rect') {
      return (
        <div
          key={el.id}
          onMouseDown={(e) => handleMouseDown(e, el)}
          style={{
            ...baseStyle,
            width: el.width || 80,
            height: el.height || 60,
            backgroundColor: el.color,
            borderRadius: 8,
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-white"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      );
    }

    if (el.type === 'text') {
      return (
        <div
          key={el.id}
          onMouseDown={(e) => handleMouseDown(e, el)}
          style={{ ...baseStyle, color: el.color }}
          className="min-w-[60px] rounded-md bg-white/80 px-2 py-1 text-sm font-medium shadow dark:bg-white/10"
        >
          {el.text || 'Text'}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-coral text-white"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      );
    }

    return null;
  };

  if (activeBoard) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <PageHeader
          title={activeBoard.title}
          subtitle={`Last updated ${new Date(activeBoard.updated_at).toLocaleString()}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePublic}
              >
                {activeBoard.is_public ? 'Public' : 'Private'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                leftIcon={<Save className="h-4 w-4" />}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeBoard}
              >
                Back to list
              </Button>
            </div>
          }
        />

        <GlassCard className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tool</span>
            <div className="flex flex-wrap gap-2">
              {([
                { type: 'circle' as ElementType, icon: Circle, label: 'Circle' },
                { type: 'rect' as ElementType, icon: Square, label: 'Rect' },
                { type: 'text' as ElementType, icon: Type, label: 'Text' },
              ]).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedTool(type)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                    selectedTool === type
                      ? 'border-brand-400 bg-brand-400/10 text-brand-700 dark:text-brand-300'
                      : 'glass glass-hover text-slate-600 dark:text-slate-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">Color</span>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-all',
                    selectedColor === color ? 'scale-110 border-black dark:border-white' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
              <MousePointer2 className="h-3.5 w-3.5" />
              Click canvas to add • Drag to move
            </div>
          </div>

          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            data-canvas-bg
            className="relative min-h-[520px] w-full overflow-hidden rounded-2xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5"
          >
            {elements.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                Click anywhere to add an element
              </div>
            )}
            {elements.map(renderElement)}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Whiteboards"
        subtitle="Collaborate visually with your study groups."
        actions={
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowCreate(true)}
          >
            New Whiteboard
          </Button>
        }
      />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Whiteboard"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            placeholder="My whiteboard"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Input
            label="Group ID (optional)"
            placeholder="Leave empty for personal board"
            value={newGroupId}
            onChange={(e) => setNewGroupId(e.target.value)}
          />
        </div>
      </Modal>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-brand-400" />
        </div>
      ) : boards.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<Square className="h-8 w-8" />}
            title="No whiteboards yet"
            description="Create a new whiteboard to start collaborating."
            action={
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setShowCreate(true)}
              >
                New Whiteboard
              </Button>
            }
          />
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {boards.map((board) => (
            <GlassCard
              key={board.id}
              hover
              className="cursor-pointer p-4"
              onClick={() => openBoard(board)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-semibold">{board.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {board.group_id ? `Group: ${board.group_id}` : 'Personal'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Updated {new Date(board.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge tone={board.is_public ? 'sky' : 'neutral'}>
                    {board.is_public ? 'Public' : 'Private'}
                  </Badge>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
