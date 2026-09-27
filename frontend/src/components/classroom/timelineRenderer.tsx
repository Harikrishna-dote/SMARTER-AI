import { useEffect, useRef } from 'react';
import { VisualizationScene } from '../../features/classroom/visualizationTypes';

interface TimelineRendererProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
}

export function TimelineRenderer({ scene, width = 800, height = 600 }: TimelineRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = scene.background || '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const timelineElements = scene.elements?.filter((el) => el.type === 'circle' || el.type === 'label') || [];
    const circles = timelineElements.filter((el) => el.type === 'circle');
    const labels = timelineElements.filter((el) => el.type === 'label');

    if (circles.length >= 2) {
      const sortedCircles = [...circles].sort((a, b) => (a.x as number) - (b.x as number));
      const mainY = sortedCircles[0]?.y as number ?? 300;

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sortedCircles[0].x as number, mainY);
      ctx.lineTo(sortedCircles[sortedCircles.length - 1].x as number, mainY);
      ctx.stroke();

      sortedCircles.forEach((circle, i) => {
        ctx.beginPath();
        ctx.arc(circle.x as number, mainY, circle.radius as number ?? 8, 0, Math.PI * 2);
        ctx.fillStyle = (circle.color as string) ?? '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = labels.find((l, li) => li === i);
        if (label) {
          ctx.fillStyle = '#f1f5f9';
          ctx.font = '12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label.text as string, label.x as number, label.y as number);
        }
      });
    }

    if (scene.real_world_demo) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(scene.real_world_demo, 20, height - 20);
    }

    if (scene.title) {
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(scene.title, 20, 30);
    }
  }, [scene, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-xl border border-white/10" />;
}
