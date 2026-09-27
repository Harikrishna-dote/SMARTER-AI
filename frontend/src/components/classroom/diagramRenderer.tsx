import { useEffect, useRef } from 'react';
import { VisualizationScene } from '../../features/classroom/visualizationTypes';

interface DiagramRendererProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
}

export function DiagramRenderer({ scene, width = 800, height = 600 }: DiagramRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = scene.background || '#0f172a';
    ctx.fillRect(0, 0, width, height);

    for (const el of scene.elements || []) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;

      switch (el.type) {
        case 'rect':
          ctx.fillStyle = (el.color as string) ?? '#1e293b';
          ctx.fillRect((el.x as number) - (el.width as number) / 2, (el.y as number) - (el.height as number) / 2, el.width as number, el.height as number);
          ctx.strokeRect((el.x as number) - (el.width as number) / 2, (el.y as number) - (el.height as number) / 2, el.width as number, el.height as number);
          if (el.label) {
            ctx.fillStyle = '#f1f5f9';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(el.label as string, el.x as number, el.y as number + 4);
            ctx.textAlign = 'start';
          }
          break;

        case 'circle':
          ctx.beginPath();
          ctx.arc(el.x as number, el.y as number, (el.radius as number) ?? 20, 0, Math.PI * 2);
          ctx.fillStyle = (el.color as string) ?? '#1e293b';
          ctx.fill();
          ctx.stroke();
          if (el.label) {
            ctx.fillStyle = '#f1f5f9';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(el.label as string, el.x as number, el.y as number + 4);
            ctx.textAlign = 'start';
          }
          break;

        case 'diamond': {
          const dx = el.x as number;
          const dy = el.y as number;
          const dw = (el.width as number) ?? 100;
          const dh = (el.height as number) ?? 60;
          ctx.beginPath();
          ctx.moveTo(dx, dy - dh / 2);
          ctx.lineTo(dx + dw / 2, dy);
          ctx.lineTo(dx, dy + dh / 2);
          ctx.lineTo(dx - dw / 2, dy);
          ctx.closePath();
          ctx.fillStyle = (el.color as string) ?? '#1e293b';
          ctx.fill();
          ctx.stroke();
          if (el.label) {
            ctx.fillStyle = '#f1f5f9';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(el.label as string, dx, dy + 4);
            ctx.textAlign = 'start';
          }
          break;
        }

        case 'edge':
        case 'arrow': {
          const from = el.from as [number, number];
          const to = el.to as [number, number];
          ctx.beginPath();
          ctx.moveTo(from[0], from[1]);
          ctx.lineTo(to[0], to[1]);
          ctx.strokeStyle = (el.color as string) ?? '#64748b';
          ctx.lineWidth = 2;
          ctx.stroke();
          const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
          ctx.beginPath();
          ctx.moveTo(to[0], to[1]);
          ctx.lineTo(to[0] - 10 * Math.cos(angle - Math.PI / 6), to[1] - 10 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(to[0] - 10 * Math.cos(angle + Math.PI / 6), to[1] - 10 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = (el.color as string) ?? '#64748b';
          ctx.fill();
          break;
        }

        case 'line': {
          const lfrom = el.from as [number, number];
          const lto = el.to as [number, number];
          ctx.beginPath();
          ctx.moveTo(lfrom[0], lfrom[1]);
          ctx.lineTo(lto[0], lto[1]);
          ctx.strokeStyle = (el.color as string) ?? '#94a3b8';
          ctx.lineWidth = (el.strokeWidth as number) ?? 2;
          ctx.stroke();
          break;
        }

        case 'label':
          ctx.fillStyle = (el.color as string) ?? '#f1f5f9';
          ctx.font = `${(el.fontSize as number) ?? 12}px Inter, sans-serif`;
          ctx.fillText(el.text as string, el.x as number, el.y as number);
          break;
      }
    }

    if (scene.title) {
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(scene.title, 20, 30);
    }
  }, [scene, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-xl border border-white/10" />;
}
