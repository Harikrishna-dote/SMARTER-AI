import { useEffect, useRef } from 'react';
import { VisualizationScene } from '../../features/classroom/visualizationTypes';

interface ChartRendererProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
}

export function ChartRenderer({ scene, width = 800, height = 600 }: ChartRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = scene.background || '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const barElements = scene.elements?.filter((el) => el.type === 'bar') || [];
    const hasBars = barElements.length > 0;

    if (hasBars) {
      const maxVal = Math.max(...barElements.map((b) => (b.height as number) ?? 100));
      const chartHeight = height - 120;
      const barWidth = 60;
      const gap = (width - barElements.length * barWidth) / (barElements.length + 1);

      barElements.forEach((bar, i) => {
        const barHeight = ((bar.height as number) / maxVal) * chartHeight;
        const x = gap + i * (barWidth + gap);
        const y = height - 60 - barHeight;
        ctx.fillStyle = (bar.color as string) ?? '#38bdf8';
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bar.label as string, x + barWidth / 2, height - 30);
      });

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, height - 60);
      ctx.lineTo(width - 40, height - 60);
      ctx.stroke();
    }

    for (const el of scene.elements || []) {
      if (el.type === 'label') {
        ctx.fillStyle = (el.color as string) ?? '#f1f5f9';
        ctx.font = `${(el.fontSize as number) ?? 14}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(el.text as string, (el.x as number) ?? width / 2, (el.y as number) ?? 30);
        ctx.textAlign = 'start';
      }
    }

    if (scene.title) {
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(scene.title, 20, 30);
    }
  }, [scene, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-xl border border-white/10" />;
}
