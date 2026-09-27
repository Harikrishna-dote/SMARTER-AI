import type { LearningMode, VisualScriptItem } from '../../lib/types';
import { VisualizationEngine, VisualizationRequest, VisualizationScene, VisualizationMode, VisualizationComplexity, SubjectCategory } from './visualizationEngine';

export type VisualMode =
  | 'whiteboard'
  | 'flowchart'
  | 'simulation'
  | 'graph'
  | 'timeline'
  | 'code_trace'
  | 'network'
  | 'mindmap'
  | 'three_d_placeholder';

export type VisualComplexity = 'beginner' | 'intermediate' | 'advanced';

export interface VisualDecisionInput {
  topic: string;
  concept: string;
  level: string;
  learningMode: LearningMode;
  existingScript?: VisualScriptItem[];
  showLabels?: boolean;
  difficulty?: string;
  realWorldExample?: string;
  subject?: string;
}

export interface VisualLearningScene {
  mode: VisualMode;
  complexity: VisualComplexity;
  script: VisualScriptItem[];
  realWorldDemo: string;
  accessibilitySummary: string;
}

function complexityForLevel(level: string): VisualComplexity {
  const normalized = level.toLowerCase();
  if (/advanced|college|undergraduate|professional|research|interview|jee|neet|gate/.test(normalized)) {
    return 'advanced';
  }
  if (/grade\s*[8-9]|grade\s*1[0-2]|intermediate|exam|school/.test(normalized)) {
    return 'intermediate';
  }
  return 'beginner';
}

function visualModeFor(topic: string, concept: string, learningMode: LearningMode): VisualMode {
  const text = `${topic} ${concept} ${learningMode}`.toLowerCase();
  if (/sort|search|loop|recursion|stack|heap|variable|algorithm|code|program/.test(text)) return 'code_trace';
  if (/gravity|projectile|motion|force|orbit|solar|planet|reaction|dna|cell|circuit|current|voltage/.test(text)) {
    return /solar|planet|dna|molecule|anatomy|geometry|architecture/.test(text) ? 'three_d_placeholder' : 'simulation';
  }
  if (/function|graph|calculus|vector|matrix|probability|statistics|equation|finance|economics|demand|supply/.test(text)) {
    return 'graph';
  }
  if (/history|timeline|constitution|geography|law|political/.test(text)) return 'timeline';
  if (/network|routing|packet|cloud|security|cyber/.test(text)) return 'network';
  if (/process|architecture|system|workflow|database|join|operating system/.test(text)) return 'flowchart';
  if (learningMode === 'research') return 'mindmap';
  return 'whiteboard';
}

function label(text: string, showLabels: boolean | undefined): string | undefined {
  return showLabels === false ? undefined : text;
}

function baseScript(mode: VisualMode, topic: string, complexity: VisualComplexity, showLabels?: boolean): VisualScriptItem[] {
  const detailColor = complexity === 'advanced' ? '#a78bfa' : complexity === 'intermediate' ? '#38bdf8' : '#22c55e';
  const title = label(topic || 'Concept', showLabels);

  if (mode === 'code_trace') {
    return [
      { type: 'rect', x: 80, y: 120, w: 170, h: 70, color: '#1e293b', label: label('Input', showLabels) },
      { type: 'rect', x: 315, y: 120, w: 170, h: 70, color: detailColor, label: label('Step', showLabels), pulse: true },
      { type: 'rect', x: 550, y: 120, w: 170, h: 70, color: '#0f766e', label: label('Output', showLabels) },
      { type: 'line', x1: 250, y1: 155, x2: 315, y2: 155, dx2: 18, color: '#fbbf24', width: 4 },
      { type: 'line', x1: 485, y1: 155, x2: 550, y2: 155, dx2: 18, color: '#fbbf24', width: 4 },
      { type: 'label', x: 80, y: 260, text: label('Trace values as the program executes.', showLabels), color: '#e2e8f0' },
    ];
  }

  if (mode === 'simulation' || mode === 'three_d_placeholder') {
    return [
      { type: 'circle', x: 160, y: 120, r: 28, color: '#f97316', label: label('Cause', showLabels), pulse: true },
      { type: 'circle', x: 380, y: 260, r: 36, color: detailColor, label: title, dx: 120, dy: 70, pulse: true },
      { type: 'line', x1: 160, y1: 120, x2: 380, y2: 260, dx2: 120, dy2: 70, color: '#94a3b8', width: 3 },
      { type: 'rect', x: 90, y: 430, w: 620, h: 28, color: '#334155', label: label('Experiment with parameters', showLabels) },
      { type: 'label', x: 90, y: 510, text: label('3D/WebGL adapter can replace this scene when available.', showLabels), color: '#c4b5fd' },
    ];
  }

  if (mode === 'graph') {
    return [
      { type: 'line', x1: 100, y1: 470, x2: 710, y2: 470, color: '#e2e8f0', width: 3 },
      { type: 'line', x1: 120, y1: 520, x2: 120, y2: 90, color: '#e2e8f0', width: 3 },
      { type: 'circle', x: 180, y: 390, r: 12, dx: 430, dy: -210, color: detailColor, label: label('change', showLabels), pulse: true },
      { type: 'line', x1: 180, y1: 390, x2: 610, y2: 180, color: '#fbbf24', width: 4 },
      { type: 'label', x: 160, y: 80, text: label('Visualize relationship, slope, trend, or transformation.', showLabels), color: '#e2e8f0' },
    ];
  }

  if (mode === 'timeline') {
    return [
      { type: 'line', x1: 90, y1: 300, x2: 710, y2: 300, color: '#e2e8f0', width: 4 },
      { type: 'circle', x: 160, y: 300, r: 20, color: '#38bdf8', label: label('Before', showLabels) },
      { type: 'circle', x: 390, y: 300, r: 24, color: detailColor, label: title, pulse: true },
      { type: 'circle', x: 620, y: 300, r: 20, color: '#22c55e', label: label('Impact', showLabels) },
      { type: 'label', x: 120, y: 390, text: label('Connect cause, event, and consequence.', showLabels), color: '#e2e8f0' },
    ];
  }

  if (mode === 'network' || mode === 'flowchart') {
    return [
      { type: 'rect', x: 90, y: 150, w: 150, h: 70, color: '#1e293b', label: label('Source', showLabels) },
      { type: 'rect', x: 325, y: 250, w: 150, h: 70, color: detailColor, label: title, pulse: true },
      { type: 'rect', x: 560, y: 150, w: 150, h: 70, color: '#0f766e', label: label('Result', showLabels) },
      { type: 'line', x1: 240, y1: 185, x2: 325, y2: 285, color: '#fbbf24', width: 4 },
      { type: 'line', x1: 475, y1: 285, x2: 560, y2: 185, color: '#fbbf24', width: 4 },
      { type: 'label', x: 120, y: 420, text: label('Follow the flow step by step.', showLabels), color: '#e2e8f0' },
    ];
  }

  return [
    { type: 'circle', x: 400, y: 220, r: 56, color: detailColor, label: title, pulse: true },
    { type: 'rect', x: 120, y: 390, w: 160, h: 58, color: '#1e293b', label: label('Definition', showLabels) },
    { type: 'rect', x: 320, y: 390, w: 160, h: 58, color: '#334155', label: label('Example', showLabels) },
    { type: 'rect', x: 520, y: 390, w: 160, h: 58, color: '#0f766e', label: label('Practice', showLabels) },
    { type: 'line', x1: 400, y1: 276, x2: 200, y2: 390, color: '#94a3b8', width: 3 },
    { type: 'line', x1: 400, y1: 276, x2: 400, y2: 390, color: '#94a3b8', width: 3 },
    { type: 'line', x1: 400, y1: 276, x2: 600, y2: 390, color: '#94a3b8', width: 3 },
  ];
}

function realWorldDemoFor(mode: VisualMode, topic: string): string {
  const concept = topic || 'this concept';
  const demos: Record<VisualMode, string> = {
    whiteboard: `Show ${concept} as definition, example, and practice on the board.`,
    flowchart: `Demonstrate ${concept} as a real workflow with inputs, decisions, and outputs.`,
    simulation: `Let the student observe how changing one parameter changes ${concept}.`,
    graph: `Plot ${concept} so the student sees the relationship, trend, and turning points.`,
    timeline: `Place ${concept} on a timeline to connect cause, event, and consequence.`,
    code_trace: `Trace ${concept} like a debugger: input, variable changes, and output.`,
    network: `Show ${concept} as connected nodes passing information or influence.`,
    mindmap: `Map ${concept} into prerequisites, examples, mistakes, and next ideas.`,
    three_d_placeholder: `Prepare ${concept} for a rotatable 3D model when WebGL assets are available.`,
  };
  return demos[mode];
}

export function createVisualLearningScene(input: VisualDecisionInput): VisualLearningScene {
  const complexity = complexityForLevel(input.level);
  const mode = visualModeFor(input.topic, input.concept, input.learningMode);
  const script = input.existingScript?.length
    ? input.existingScript
    : baseScript(mode, input.topic || input.concept, complexity, input.showLabels);

  return {
    mode,
    complexity,
    script,
    realWorldDemo: realWorldDemoFor(mode, input.topic || input.concept),
    accessibilitySummary:
      complexity === 'beginner'
        ? 'Large labels, simple motion, and static fallback are available.'
        : 'Labels, replay, pause, speed control, and reduced motion are available.',
  };
}

export async function createAdvancedVisualization(input: VisualDecisionInput): Promise<VisualizationScene> {
  const category = VisualizationEngine.detectCategory(input.topic, input.subject ?? input.topic);
  const mode = VisualizationEngine.selectMode({
    topic: input.topic,
    concept: input.concept,
    subject: input.subject ?? input.topic,
    category,
    difficulty: input.difficulty ?? 'medium',
    student_level: input.level,
    learning_objective: input.concept,
    complexity: input.level.toLowerCase().includes('advanced') ? VisualizationComplexity.HIGH : VisualizationComplexity.MEDIUM,
    language: 'en',
    real_world_example: input.realWorldExample ?? '',
  });

  const request: VisualizationRequest = {
    topic: input.topic,
    concept: input.concept,
    subject: input.subject ?? input.topic,
    category,
    difficulty: input.difficulty ?? 'medium',
    student_level: input.level,
    learning_objective: input.concept,
    mode_hint: mode,
    real_world_example: input.realWorldExample ?? '',
  };

  return VisualizationEngine.generate(request);
}

export { VisualizationMode, VisualizationComplexity, type VisualizationScene, type AnimationStep, SubjectCategory, type VisualizationRequest } from './visualizationEngine';
