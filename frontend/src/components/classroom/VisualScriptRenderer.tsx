import { useEffect, useMemo, useRef } from 'react';
import type { VisualLearningScene } from '../../features/classroom/visualLearningEngine';
import type { VisualScriptItem } from '../../lib/types';
import type { VisualizationScene, WhiteboardAction } from '../../features/classroom/visualizationTypes';
import { DynamicVisualizer } from './dynamicVisualizer';

interface VisualScriptRendererProps {
  scene?: VisualLearningScene;
  script?: VisualScriptItem[];
  visualizationScene?: VisualizationScene | null;
  reducedMotion?: boolean;
  paused?: boolean;
  visualSpeed?: number;
  className?: string;
  interactive?: boolean;
  readOnly?: boolean;
  onAction?: (action: Record<string, unknown> | WhiteboardAction) => void;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w + r, y + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#ffffff', size = 12, align: CanvasTextAlign = 'left') => {
  ctx.fillStyle = color;
  ctx.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
};

const scale = (value: number, dimension: number, base = 800): number => (value / base) * dimension;

const drawItem = (
  ctx: CanvasRenderingContext2D,
  item: VisualLearningScene['script'][0],
  width: number,
  height: number,
  elapsed: number,
  reducedMotion = false,
) => {
  const moveX = (item.dx ?? 0) * (reducedMotion ? 0 : Math.sin(elapsed * 0.8) * 0.4);
  const moveY = (item.dy ?? 0) * (reducedMotion ? 0 : Math.cos(elapsed * 0.8) * 0.4);
  const x = scale((item.x ?? 0) + moveX, width);
  const y = scale((item.y ?? 0) + moveY, height);
  const r = scale(item.r ?? 24, Math.min(width, height));

  const color = item.color ?? '#38bdf8';
  const label = item.label ?? item.text ?? '';
  const pulse = item.pulse && !reducedMotion ? 1 + Math.sin(elapsed * 2) * 0.08 : 1;

  if (item.type === 'circle') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(6, r * pulse), 0, Math.PI * 2);
    ctx.fill();
    if (label) drawText(ctx, label, x, y, '#ffffff', 12, 'center');
  }

  if (item.type === 'rect') {
    const w = scale(item.w ?? 160, width);
    const h = scale(item.h ?? 70, height);
    drawRoundedRect(ctx, x, y, Math.max(48, w), Math.max(32, h), 14);
    ctx.fillStyle = color;
    ctx.fill();
    if (label) drawText(ctx, label, x + Math.max(48, w) / 2, y + Math.max(32, h) / 2, '#ffffff', 12, 'center');
  }

  if (item.type === 'line') {
    ctx.strokeStyle = color;
    ctx.lineWidth = clamp(item.width ?? 3, 2, 8);
    ctx.beginPath();
    ctx.moveTo(scale(item.x1 ?? 0, width), scale(item.y1 ?? 0, height));
    ctx.lineTo(scale((item.x2 ?? 0) + (item.dx2 ?? 0) * (reducedMotion ? 0 : Math.sin(elapsed * 0.1)), width), scale((item.y2 ?? 0) + (item.dy2 ?? 0) * (reducedMotion ? 0 : Math.cos(elapsed * 0.1)), height));
    ctx.stroke();
  }

  if (item.type === 'text' || item.type === 'label') {
    if (label) drawText(ctx, label, x, y, color, 12, 'left');
  }
};

export function VisualScriptRenderer({ scene, script, visualizationScene, reducedMotion = false, paused = false, visualSpeed = 1, className, interactive = false, readOnly = false, onAction }: VisualScriptRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const useNewEngine = !!visualizationScene;

  if (useNewEngine && visualizationScene) {
    return (
      <DynamicVisualizer
        scene={visualizationScene}
        width={800}
        height={600}
        autoPlay={!reducedMotion && !paused}
        interactive={interactive}
        readOnly={readOnly}
        onAction={onAction}
      />
    );
  }

  const renderScene = useMemo(
    () =>
      scene ?? {
        mode: 'whiteboard' as const,
        complexity: 'beginner' as const,
        script: script ?? [],
        realWorldDemo: 'Visual details are showing here.',
        accessibilitySummary: 'This visualization provides graphical support for lesson content.',
      },
    [scene, script],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(240, Math.floor(rect.height * window.devicePixelRatio));
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    resizeCanvas();

    const start = performance.now();
    const render = (time: number) => {
      const elapsed = ((time - start) / 1000) * visualSpeed;
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      context.clearRect(0, 0, width, height);

      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#020617');
      gradient.addColorStop(0.5, '#071627');
      gradient.addColorStop(1, '#0f172a');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.fillStyle = 'rgba(255,255,255,0.04)';
      for (let gx = 0; gx < width; gx += 40) {
        context.fillRect(gx, 0, 1, height);
      }
      for (let gy = 0; gy < height; gy += 40) {
        context.fillRect(0, gy, width, 1);
      }

      renderScene.script.forEach((item) => drawItem(context, item, width, height, elapsed, reducedMotion));

      drawText(context, renderScene.mode.replace(/_/g, ' '), width - 16, height - 22, '#d1d5db', 12, 'right');
      drawText(context, renderScene.realWorldDemo, 16, height - 22, '#d1d5db', 12, 'left');

      if (!reducedMotion) {
        animationRef.current = window.requestAnimationFrame(render);
      }
    };

    animationRef.current = window.requestAnimationFrame(render);

    const handleResize = () => {
      resizeCanvas();
      render(performance.now());
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [renderScene, paused, reducedMotion, visualSpeed]);

  return <canvas ref={canvasRef} className={className ?? 'h-full w-full'} aria-label="Visual learning scene" />;
}
