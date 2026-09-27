import { useEffect, useRef } from 'react';
import { VisualizationScene } from '../../features/classroom/visualizationTypes';

interface MathGraphRendererProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
}

export function MathGraphRenderer({ scene, width = 800, height = 600 }: MathGraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = scene.background || '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const padding = 80;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.moveTo(width / 2, padding);
    ctx.lineTo(width / 2, height - padding);
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (graphWidth / 10) * i;
      const y = padding + (graphHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= graphWidth; px += 2) {
      const x = (px / graphWidth) * 4 - 2;
      const y = Math.sin(x) * (graphHeight / 4);
      const canvasY = height / 2 - y;
      if (!started) { ctx.moveTo(padding + px, canvasY); started = true; }
      else ctx.lineTo(padding + px, canvasY);
    }
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('X', width - padding + 10, height / 2 + 4);
    ctx.fillText('Y', width / 2 - 4, padding - 10);
    ctx.fillText(scene.title, 20, 30);
  }, [scene, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-xl border border-white/10" />;
}
