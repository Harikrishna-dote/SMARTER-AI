import { useEffect, useRef, useState } from 'react';
import { VisualizationScene } from '../../features/classroom/visualizationTypes';

interface SimulationRendererProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
  autoPlay?: boolean;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  label?: string;
  life?: number;
}

export function SimulationRenderer({ scene, width = 800, height = 600, autoPlay = true }: SimulationRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [playing, setPlaying] = useState(autoPlay);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    setPlaying(autoPlay);
  }, [autoPlay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    particlesRef.current = (scene.elements || [])
      .filter((el) => el.type === 'particle')
      .map((el, i) => ({
        id: `p-${i}`,
        x: (el.x as number) ?? 100,
        y: (el.y as number) ?? 300,
        vx: 1 + Math.random() * 2,
        vy: 0.5 + Math.random() * 1,
        radius: (el.radius as number) ?? 10,
        color: (el.color as string) ?? '#38bdf8',
        label: (el.label as string) ?? `P${i}`,
        life: 1,
      }));

    const animate = () => {
      if (!playing) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }
      ctx.fillStyle = scene.background || '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(scene.title, 20, 30);

      for (const particle of particlesRef.current) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x > width - 20 || particle.x < 20) particle.vx *= -1;
        if (particle.y > height - 20 || particle.y < 20) particle.vy *= -1;
        particle.x = Math.max(20, Math.min(width - 20, particle.x));
        particle.y = Math.max(50, Math.min(height - 20, particle.y));

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (particle.label) {
          ctx.fillStyle = '#f1f5f9';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText(particle.label, particle.x - 8, particle.y + 4);
        }
      }

      for (const el of scene.elements || []) {
        if (el.type === 'arrow') {
          const from = el.from as [number, number];
          const to = el.to as [number, number];
          ctx.beginPath();
          ctx.moveTo(from[0], from[1]);
          ctx.lineTo(to[0], to[1]);
          ctx.strokeStyle = (el.color as string) ?? '#64748b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (el.type === 'node') {
          const x = el.x as number;
          const y = el.y as number;
          const w = (el.width as number) ?? 80;
          const h = (el.height as number) ?? 40;
          ctx.fillStyle = (el.color as string) ?? '#334155';
          ctx.fillRect(x - w / 2, y - h / 2, w, h);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);
          if (el.label) {
            ctx.fillStyle = '#f1f5f9';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(el.label as string, x, y + 4);
            ctx.textAlign = 'start';
          }
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [scene, width, height, playing]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button onClick={() => setPlaying((p) => !p)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20">
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => { particlesRef.current.forEach((p) => { p.x = width / 2; p.y = height / 2; p.vx = 1 + Math.random() * 2; p.vy = 0.5 + Math.random() * 1; }); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20">Reset</button>
      </div>
      <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-xl border border-white/10" />
    </div>
  );
}
