// Dynamic visualization types for the AI Visual Learning Engine.

export enum VisualizationMode {
  CANVAS_2D = 'canvas_2d',
  WHITEBOARD = 'whiteboard',
  SIMULATION = 'simulation',
  DIAGRAM = 'diagram',
  MATH_GRAPH = 'math_graph',
  CODE_TRACE = 'code_trace',
  CHART = 'chart',
  TIMELINE = 'timeline',
  MINIMAP = 'minimap',
  INFOGRAPHIC = 'infographic',
  FLOWCHART = 'flowchart',
  NETWORK = 'network',
  ANIMATION = 'animation',
  INTERACTIVE = 'interactive',
}

export enum VisualizationComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra',
}

export enum SubjectCategory {
  MATH = 'math',
  PHYSICS = 'physics',
  CHEMISTRY = 'chemistry',
  BIOLOGY = 'biology',
  COMPUTER_SCIENCE = 'computer_science',
  PROGRAMMING = 'programming',
  MACHINE_LEARNING = 'machine_learning',
  AI = 'ai',
  CYBER_SECURITY = 'cyber_security',
  NETWORKING = 'networking',
  CLOUD = 'cloud',
  OS = 'os',
  DATABASE = 'database',
  HISTORY = 'history',
  GEOGRAPHY = 'geography',
  ECONOMICS = 'economics',
  COMMERCE = 'commerce',
  FINANCE = 'finance',
  MEDICINE = 'medicine',
  LAW = 'law',
  LANGUAGES = 'languages',
  MUSIC = 'music',
  ARCHITECTURE = 'architecture',
  MECHANICAL = 'mechanical',
  CIVIL = 'civil',
  ELECTRICAL = 'electrical',
  ASTRONOMY = 'astronomy',
  AGRICULTURE = 'agriculture',
  BUSINESS = 'business',
  GENERAL = 'general',
}

export interface VisualizationRequest {
  topic: string;
  concept: string;
  subject: string;
  category: SubjectCategory;
  difficulty: string;
  student_level: string;
  learning_objective: string;
  mode_hint?: VisualizationMode;
  complexity?: VisualizationComplexity;
  language?: string;
  real_world_example?: string;
  previous_concepts?: string[];
  metadata?: Record<string, unknown>;
}

export interface AnimationStep {
  id: string;
  label: string;
  description: string;
  duration_ms?: number;
  actions?: Array<Record<string, unknown>>;
  narration?: string;
  highlight_elements?: string[];
  transition?: string;
}

export function createAnimationStep(step: AnimationStep): AnimationStep {
  return step;
}

export interface VisualizationScene {
  mode: VisualizationMode;
  title: string;
  description: string;
  complexity: VisualizationComplexity;
  width?: number;
  height?: number;
  background?: string;
  elements?: Array<Record<string, unknown>>;
  animation_steps?: AnimationStep[];
  real_world_demo?: string;
  accessibility_description?: string;
  interactive_points?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  toScript?: () => Array<Record<string, unknown>>;
}

export interface WhiteboardAction {
  type: string;
  tool: string;
  points?: Array<{ x: number; y: number }>;
  color?: string;
  stroke_width?: number;
  text?: string;
  shape?: string;
  metadata?: Record<string, unknown>;
}

export interface SimulationConfig {
  simulation_type: string;
  parameters?: Record<string, unknown>;
  steps?: Array<Record<string, unknown>>;
  real_time?: boolean;
  loop?: boolean;
  interactive?: boolean;
  controls?: string[];
}
