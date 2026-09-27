import { useCallback, useEffect, useRef, useState } from 'react';
import { VisualizationScene, WhiteboardAction } from '../../features/classroom/visualizationTypes';

interface WhiteboardProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
  onAction?: (action: WhiteboardAction) => void;
  readOnly?: boolean;
}

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'text' | 'highlight' | 'pointer';

export function Whiteboard({ scene, width = 800, height = 600, onAction, readOnly = false }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pointer');
  const [color, setColor] = useState('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [actions, setActions] = useState<WhiteboardAction[]>([]);
  const [currentAction, setCurrentAction] = useState<WhiteboardAction | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [width, height]);

  const drawAction = useCallback((ctx: CanvasRenderingContext2D, action: WhiteboardAction) => {
    ctx.strokeStyle = action.color || '#38bdf8';
    ctx.fillStyle = action.color || '#38bdf8';
    ctx.lineWidth = action.stroke_width || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (action.type) {
      case 'pen':
      case 'highlight':
        if (!action.points || action.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.globalAlpha = action.type === 'highlight' ? 0.3 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;

      case 'line':
        if (action.points && action.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(action.points[0].x, action.points[0].y);
          ctx.lineTo(action.points[1].x, action.points[1].y);
          ctx.stroke();
        }
        break;

      case 'rect':
        if (action.points && action.points.length >= 2) {
          const start = action.points[0];
          const end = action.points[1];
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        }
        break;

      case 'circle':
        if (action.points && action.points.length >= 2) {
          const center = action.points[0];
          const edge = action.points[1];
          const radius = Math.sqrt((edge.x - center.x) ** 2 + (edge.y - center.y) ** 2);
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case 'text':
        if (action.text) {
          ctx.font = `${(action.stroke_width || 2) * 6}px Inter, sans-serif`;
          ctx.fillText(action.text, action.points?.[0]?.x ?? 10, action.points?.[0]?.y ?? 20);
        }
        break;

      case 'eraser':
        if (action.points && action.points.length >= 2) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = (action.stroke_width || 2) * 4;
          ctx.beginPath();
          ctx.moveTo(action.points[0].x, action.points[0].y);
          for (let i = 1; i < action.points.length; i++) {
            ctx.lineTo(action.points[i].x, action.points[i].y);
          }
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
    }
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx);
    for (const action of actions) {
      drawAction(ctx, action);
    }
    if (currentAction) {
      drawAction(ctx, currentAction);
    }
  }, [actions, currentAction, drawBackground, drawAction]);

  useEffect(() => {
    render();
  }, [render]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleStart = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    startRef.current = point;
    if (tool === 'pen' || tool === 'highlight' || tool === 'eraser') {
      const action: WhiteboardAction = { type: tool, tool, points: [point], color, stroke_width: strokeWidth };
      setCurrentAction(action);
    }
  }, [readOnly, tool, color, strokeWidth]);

  const handleMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    const point = getCanvasPoint(e);
    if (tool === 'pen' || tool === 'highlight' || tool === 'eraser') {
      setCurrentAction((prev) => {
        if (!prev || !prev.points) return null;
        const action: WhiteboardAction = { type: prev.type, tool: prev.tool, points: [...prev.points, point], color: prev.color, stroke_width: prev.stroke_width };
        return action;
      });
    } else if (startRef.current) {
      const action: WhiteboardAction = { type: tool, tool, points: [startRef.current, point], color, stroke_width: strokeWidth };
      setCurrentAction(action);
    }
  }, [isDrawing, readOnly, tool, color, strokeWidth]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentAction) {
      setActions((prev) => [...prev, currentAction]);
      onAction?.(currentAction);
    }
    setCurrentAction(null);
    startRef.current = null;
  }, [isDrawing, currentAction, onAction]);

  const clear = useCallback(() => {
    setActions([]);
    setCurrentAction(null);
  }, []);

  const undo = useCallback(() => {
    setActions((prev) => prev.slice(0, -1));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
          {(['pointer', 'pen', 'highlight', 'eraser', 'line', 'rect', 'circle', 'text'] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tool === t ? 'bg-brand-500 text-white' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent" />
          <input type="range" min="1" max="10" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-20 accent-brand-400" />
          <button onClick={undo} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10">Undo</button>
          <button onClick={clear} className="rounded-lg px-3 py-1.5 text-xs font-medium text-coral-300 hover:bg-white/10">Clear</button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full cursor-crosshair rounded-xl border border-white/10"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}
