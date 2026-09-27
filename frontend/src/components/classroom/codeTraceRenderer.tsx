import { useEffect, useRef, useState } from 'react';
import { VisualizationScene, AnimationStep } from '../../features/classroom/visualizationTypes';

interface CodeTraceRendererProps {
  scene: VisualizationScene;
  width?: number;
  height?: number;
}

export function CodeTraceRenderer({ scene, width = 800, height = 600 }: CodeTraceRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = scene.animation_steps || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = scene.background || '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 40, 340, 520);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 340, 520);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`// ${scene.title}`, 60, 70);

    const codeLines = [
      'function process(data) {',
      '  const result = [];',
      '  for (let i = 0; i < data.length; i++) {',
      '    if (data[i] > threshold) {',
      '      result.push(data[i]);',
      '    }',
      '  }',
      '  return result;',
      '}',
    ];

    ctx.font = '11px monospace';
    codeLines.forEach((line, i) => {
      const y = 100 + i * 22;
      if (i === currentStep) {
        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = 0.2;
        ctx.fillRect(45, y - 14, 330, 20);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(line, 60, y);
    });

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Stack:', 420, 70);

    const stackFrames = steps.slice(0, currentStep + 1).map((s) => s.label);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#94a3b8';
    stackFrames.forEach((frame, i) => {
      ctx.fillText(`> ${frame}`, 420, 100 + i * 22);
    });

    if (steps[currentStep]) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(steps[currentStep].narration || '', 40, height - 30);
    }
  }, [scene, width, height, currentStep, steps]);

  const next = () => setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button onClick={prev} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20">Previous</button>
        <button onClick={next} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20">Next</button>
        <span className="text-xs text-slate-400">Step {currentStep + 1}/{steps.length}</span>
      </div>
      <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-xl border border-white/10" />
    </div>
  );
}
