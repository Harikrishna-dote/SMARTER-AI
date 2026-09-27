// AI-powered visualization engine for dynamic educational content generation.

import { VisualizationMode, VisualizationComplexity, VisualizationRequest, VisualizationScene, AnimationStep, SubjectCategory } from './visualizationTypes';

const MODE_COMPLEXITY_MAP: Record<VisualizationMode, VisualizationComplexity> = {
  [VisualizationMode.CANVAS_2D]: VisualizationComplexity.LOW,
  [VisualizationMode.WHITEBOARD]: VisualizationComplexity.LOW,
  [VisualizationMode.SIMULATION]: VisualizationComplexity.HIGH,
  [VisualizationMode.DIAGRAM]: VisualizationComplexity.MEDIUM,
  [VisualizationMode.MATH_GRAPH]: VisualizationComplexity.MEDIUM,
  [VisualizationMode.CODE_TRACE]: VisualizationComplexity.MEDIUM,
  [VisualizationMode.CHART]: VisualizationComplexity.LOW,
  [VisualizationMode.TIMELINE]: VisualizationComplexity.LOW,
  [VisualizationMode.MINIMAP]: VisualizationComplexity.MEDIUM,
  [VisualizationMode.INFOGRAPHIC]: VisualizationComplexity.MEDIUM,
  [VisualizationMode.FLOWCHART]: VisualizationComplexity.LOW,
  [VisualizationMode.NETWORK]: VisualizationComplexity.MEDIUM,
  [VisualizationMode.ANIMATION]: VisualizationComplexity.HIGH,
  [VisualizationMode.INTERACTIVE]: VisualizationComplexity.HIGH,
};

const TOPIC_KEYWORDS: Record<SubjectCategory, RegExp[]> = {
  [SubjectCategory.MATH]: [/algebra/i, /calculus/i, /geometry/i, /trigonometry/i, /equation/i, /function/i, /matrix/i, /vector/i, /probability/i, /statistics/i, /number/i, /fraction/i, /derivative/i, /integral/i, /graph/i, /quadratic/i, /polynomial/i],
  [SubjectCategory.PHYSICS]: [/force/i, /motion/i, /gravity/i, /energy/i, /velocity/i, /acceleration/i, /wave/i, /light/i, /sound/i, /electric/i, /magnet/i, /newton/i, /kinematics/i, /dynamics/i, /thermodynamics/i],
  [SubjectCategory.CHEMISTRY]: [/atom/i, /molecule/i, /bond/i, /reaction/i, /acid/i, /base/i, /organic/i, /periodic/i, /element/i, /compound/i, /chemical/i, /oxidation/i, /catalyst/i],
  [SubjectCategory.BIOLOGY]: [/cell/i, /plant/i, /animal/i, /human/i, /photosynthesis/i, /genetic/i, /dna/i, /evolution/i, /ecosystem/i, /organism/i, /tissue/i, /organ/i],
  [SubjectCategory.COMPUTER_SCIENCE]: [/algorithm/i, /data structure/i, /complexity/i, /recursion/i, /sorting/i, /searching/i, /graph theory/i, /automata/i, /compiler/i, /operating system/i],
  [SubjectCategory.PROGRAMMING]: [/python/i, /javascript/i, /java/i, /c\+\+/i, /loop/i, /variable/i, /function/i, /class/i, /object/i, /api/i, /database/i, /sql/i, /react/i, /node/i],
  [SubjectCategory.MACHINE_LEARNING]: [/machine learning/i, /deep learning/i, /neural network/i, /training/i, /model/i, /feature/i, /supervised/i, /unsupervised/i, /regression/i, /classification/i, /clustering/i],
  [SubjectCategory.AI]: [/artificial intelligence/i, /llm/i, /gpt/i, /transformer/i, /nlp/i, /computer vision/i, /robotics/i, /expert system/i, /chatbot/i],
  [SubjectCategory.CYBER_SECURITY]: [/security/i, /encryption/i, /firewall/i, /malware/i, /vulnerability/i, /attack/i, /cipher/i, /authentication/i, /hacking/i],
  [SubjectCategory.NETWORKING]: [/network/i, /protocol/i, /tcp/i, /ip/i, /router/i, /switch/i, /dns/i, /http/i, /packet/i, /bandwidth/i, /latency/i],
  [SubjectCategory.CLOUD]: [/cloud/i, /aws/i, /azure/i, /gcp/i, /serverless/i, /kubernetes/i, /docker/i, /microservice/i, /iaas/i, /paas/i],
  [SubjectCategory.OS]: [/operating system/i, /process/i, /thread/i, /memory/i, /file system/i, /kernel/i, /scheduling/i, /deadlock/i],
  [SubjectCategory.DATABASE]: [/database/i, /sql/i, /query/i, /join/i, /index/i, /transaction/i, /normalization/i, /acid/i, /mongodb/i, /nosql/i],
  [SubjectCategory.HISTORY]: [/history/i, /ancient/i, /war/i, /civilization/i, /empire/i, /revolution/i, /independence/i, /dynasty/i],
  [SubjectCategory.GEOGRAPHY]: [/geography/i, /continent/i, /climate/i, /river/i, /mountain/i, /population/i, /ecosystem/i, /biome/i],
  [SubjectCategory.ECONOMICS]: [/economics/i, /supply/i, /demand/i, /market/i, /inflation/i, /gdp/i, /trade/i, /fiscal/i, /monetary/i],
  [SubjectCategory.COMMERCE]: [/commerce/i, /business/i, /accounting/i, /marketing/i, /finance/i, /management/i, /entrepreneur/i, /retail/i],
  [SubjectCategory.FINANCE]: [/finance/i, /stock/i, /bond/i, /investment/i, /portfolio/i, /risk/i, /banking/i, /cryptocurrency/i, /trading/i],
  [SubjectCategory.MEDICINE]: [/medicine/i, /disease/i, /anatomy/i, /pharmacology/i, /surgery/i, /diagnosis/i, /treatment/i, /vaccine/i, /virus/i, /bacteria/i],
  [SubjectCategory.LAW]: [/law/i, /constitution/i, /legal/i, /court/i, /legislation/i, /rights/i, /treaty/i, /jurisdiction/i],
  [SubjectCategory.LANGUAGES]: [/grammar/i, /vocabulary/i, /pronunciation/i, /syntax/i, /phonetic/i, /sentence/i, /tense/i, /verb/i],
  [SubjectCategory.MUSIC]: [/music/i, /note/i, /chord/i, /melody/i, /rhythm/i, /scale/i, /harmony/i, /instrument/i, /octave/i],
  [SubjectCategory.ARCHITECTURE]: [/architecture/i, /design/i, /structural/i, /blueprint/i, /building/i, /urban/i, /construction/i, /aesthetic/i],
  [SubjectCategory.MECHANICAL]: [/mechanical/i, /engine/i, /thermodynamic/i, /gear/i, /motor/i, /fluid/i, /stress/i, /strain/i],
  [SubjectCategory.CIVIL]: [/civil/i, /bridge/i, /road/i, /foundation/i, /concrete/i, /survey/i, /urban planning/i, /traffic/i],
  [SubjectCategory.ELECTRICAL]: [/electrical/i, /circuit/i, /voltage/i, /current/i, /resistor/i, /capacitor/i, /semiconductor/i, /power/i],
  [SubjectCategory.ASTRONOMY]: [/astronomy/i, /planet/i, /star/i, /galaxy/i, /orbit/i, /gravity/i, /solar system/i, /black hole/i, /universe/i],
  [SubjectCategory.AGRICULTURE]: [/agriculture/i, /crop/i, /soil/i, /irrigation/i, /fertilizer/i, /harvest/i, /livestock/i, /sustainable/i],
  [SubjectCategory.BUSINESS]: [/business/i, /strategy/i, /startup/i, /leadership/i, /marketing/i, /sales/i, /operations/i, /analytics/i],
  [SubjectCategory.GENERAL]: [],
};

const MODE_HINTS: Record<SubjectCategory, VisualizationMode | null> = {
  [SubjectCategory.MATH]: VisualizationMode.MATH_GRAPH,
  [SubjectCategory.PHYSICS]: VisualizationMode.SIMULATION,
  [SubjectCategory.CHEMISTRY]: VisualizationMode.SIMULATION,
  [SubjectCategory.BIOLOGY]: VisualizationMode.DIAGRAM,
  [SubjectCategory.COMPUTER_SCIENCE]: VisualizationMode.CODE_TRACE,
  [SubjectCategory.PROGRAMMING]: VisualizationMode.CODE_TRACE,
  [SubjectCategory.MACHINE_LEARNING]: VisualizationMode.NETWORK,
  [SubjectCategory.AI]: VisualizationMode.NETWORK,
  [SubjectCategory.CYBER_SECURITY]: VisualizationMode.FLOWCHART,
  [SubjectCategory.NETWORKING]: VisualizationMode.NETWORK,
  [SubjectCategory.CLOUD]: VisualizationMode.DIAGRAM,
  [SubjectCategory.OS]: VisualizationMode.SIMULATION,
  [SubjectCategory.DATABASE]: VisualizationMode.FLOWCHART,
  [SubjectCategory.HISTORY]: VisualizationMode.TIMELINE,
  [SubjectCategory.GEOGRAPHY]: VisualizationMode.INFOGRAPHIC,
  [SubjectCategory.ECONOMICS]: VisualizationMode.CHART,
  [SubjectCategory.COMMERCE]: VisualizationMode.CHART,
  [SubjectCategory.FINANCE]: VisualizationMode.CHART,
  [SubjectCategory.MEDICINE]: VisualizationMode.DIAGRAM,
  [SubjectCategory.LAW]: VisualizationMode.FLOWCHART,
  [SubjectCategory.LANGUAGES]: VisualizationMode.MINIMAP,
  [SubjectCategory.MUSIC]: VisualizationMode.ANIMATION,
  [SubjectCategory.ARCHITECTURE]: VisualizationMode.DIAGRAM,
  [SubjectCategory.MECHANICAL]: VisualizationMode.SIMULATION,
  [SubjectCategory.CIVIL]: VisualizationMode.DIAGRAM,
  [SubjectCategory.ELECTRICAL]: VisualizationMode.SIMULATION,
  [SubjectCategory.ASTRONOMY]: VisualizationMode.SIMULATION,
  [SubjectCategory.AGRICULTURE]: VisualizationMode.TIMELINE,
  [SubjectCategory.BUSINESS]: VisualizationMode.CHART,
  [SubjectCategory.GENERAL]: VisualizationMode.DIAGRAM,
};

export class VisualizationEngine {
  static detectCategory(topic: string, subject: string): SubjectCategory {
    const text = `${topic} ${subject}`.toLowerCase();
    for (const [category, patterns] of Object.entries(TOPIC_KEYWORDS)) {
      if (patterns.some((pattern) => pattern.test(text))) {
        return category as SubjectCategory;
      }
    }
    return SubjectCategory.GENERAL;
  }

  static selectMode(request: VisualizationRequest): VisualizationMode {
    if (request.mode_hint) return request.mode_hint;
    return MODE_HINTS[request.category] ?? VisualizationMode.DIAGRAM;
  }

  static determineComplexity(request: VisualizationRequest): VisualizationComplexity {
    const level = request.student_level.toLowerCase();
    if (['beginner', 'school', 'basic', 'easy', 'novice'].some((l) => level.includes(l))) {
      return VisualizationComplexity.LOW;
    }
    if (['advanced', 'expert', 'professional', 'hard', 'difficult'].some((l) => level.includes(l))) {
      return VisualizationComplexity.HIGH;
    }
    if (['ultra', 'research', 'phd', 'master'].some((l) => level.includes(l))) {
      return VisualizationComplexity.ULTRA;
    }
    return request.complexity ?? VisualizationComplexity.MEDIUM;
  }

  static generate(request: VisualizationRequest): VisualizationScene {
    const mode = VisualizationEngine.selectMode(request);
    const complexity = VisualizationEngine.determineComplexity(request);
    const scene: VisualizationScene = {
      mode,
      title: `${request.topic}: ${request.concept}`,
      description: VisualizationEngine.generateDescription(request, mode),
      complexity,
      elements: VisualizationEngine.generateElements(request, mode),
      animation_steps: VisualizationEngine.generateAnimationSteps(request, mode),
      real_world_demo: request.real_world_example || VisualizationEngine.generateRealWorldDemo(request),
      accessibility_description: VisualizationEngine.generateAccessibilityDescription(request, mode),
      interactive_points: VisualizationEngine.generateInteractivePoints(request, mode),
      metadata: {
        subject_category: request.category,
        difficulty: request.difficulty,
        student_level: request.student_level,
        mode_hint: request.mode_hint,
      },
    };
    return scene;
  }

  private static generateDescription(request: VisualizationRequest, mode: VisualizationMode): string {
    const templates: Record<VisualizationMode, string> = {
      [VisualizationMode.CANVAS_2D]: `Interactive 2D visualization of ${request.concept}`,
      [VisualizationMode.WHITEBOARD]: `Whiteboard explanation of ${request.concept} with annotations`,
      [VisualizationMode.SIMULATION]: `Real-time simulation demonstrating ${request.concept}`,
      [VisualizationMode.DIAGRAM]: `Clear diagram showing the structure of ${request.concept}`,
      [VisualizationMode.MATH_GRAPH]: `Mathematical visualization of ${request.concept}`,
      [VisualizationMode.CODE_TRACE]: `Step-by-step code execution trace for ${request.concept}`,
      [VisualizationMode.CHART]: `Data visualization for ${request.concept}`,
      [VisualizationMode.TIMELINE]: `Timeline showing the progression of ${request.concept}`,
      [VisualizationMode.MINIMAP]: `Concept map connecting ${request.concept} to related ideas`,
      [VisualizationMode.INFOGRAPHIC]: `Visual summary of ${request.concept}`,
      [VisualizationMode.FLOWCHART]: `Flowchart explaining the process of ${request.concept}`,
      [VisualizationMode.NETWORK]: `Network diagram showing relationships in ${request.concept}`,
      [VisualizationMode.ANIMATION]: `Animated explanation of ${request.concept}`,
      [VisualizationMode.INTERACTIVE]: `Interactive exploration of ${request.concept}`,
    };
    return templates[mode] ?? `Visual explanation of ${request.concept}`;
  }

  private static generateElements(request: VisualizationRequest, mode: VisualizationMode): Array<Record<string, unknown>> {
    const elements: Array<Record<string, unknown>> = [];
    const topic = request.topic;
    const concept = request.concept;

    switch (mode) {
      case VisualizationMode.MATH_GRAPH:
        elements.push({ type: 'axes', x: 100, y: 500, width: 600, height: 400, color: '#94a3b8', label: 'Graph' });
        elements.push({ type: 'curve', points: [[100, 400], [200, 350], [300, 280], [400, 200], [500, 150], [600, 100]], color: '#38bdf8', strokeWidth: 3, label: topic });
        elements.push({ type: 'label', x: 650, y: 90, text: concept, color: '#f1f5f9', fontSize: 14 });
        break;

      case VisualizationMode.SIMULATION:
        elements.push({ type: 'container', x: 50, y: 50, width: 700, height: 500, color: '#1e293b', label: 'Simulation' });
        elements.push({ type: 'particle', x: 150, y: 300, radius: 12, color: '#38bdf8', label: 'Input' });
        elements.push({ type: 'arrow', from: [162, 300], to: [300, 300], color: '#22c55e', label: 'Process' });
        elements.push({ type: 'node', x: 300, y: 280, width: 80, height: 40, color: '#22c55e', label: topic });
        elements.push({ type: 'arrow', from: [340, 300], to: [500, 300], color: '#f59e0b', label: 'Output' });
        elements.push({ type: 'particle', x: 550, y: 300, radius: 12, color: '#f59e0b', label: 'Result' });
        break;

      case VisualizationMode.CODE_TRACE:
        elements.push({ type: 'code_block', x: 50, y: 50, width: 300, height: 200, code: `function ${topic}() {\n  // step 1\n  // step 2\n  return result;\n}`, language: 'javascript', color: '#1e293b' });
        elements.push({ type: 'arrow', from: [350, 150], to: [450, 150], color: '#38bdf8' });
        elements.push({ type: 'stack', x: 450, y: 50, width: 300, height: 200, frames: ['main()', topic + '()', 'return'], color: '#334155' });
        break;

      case VisualizationMode.FLOWCHART:
        elements.push({ type: 'rect', x: 350, y: 50, width: 100, height: 40, color: '#38bdf8', label: 'Start' });
        elements.push({ type: 'arrow', from: [400, 90], to: [400, 150], color: '#94a3b8' });
        elements.push({ type: 'diamond', x: 350, y: 150, width: 100, height: 60, color: '#f59e0b', label: topic });
        elements.push({ type: 'arrow', from: [400, 210], to: [400, 280], color: '#94a3b8' });
        elements.push({ type: 'rect', x: 350, y: 280, width: 100, height: 40, color: '#22c55e', label: 'Result' });
        break;

      case VisualizationMode.NETWORK:
        elements.push({ type: 'node', x: 400, y: 300, radius: 24, color: '#38bdf8', label: topic });
        elements.push({ type: 'node', x: 200, y: 150, radius: 18, color: '#22c55e', label: 'Input A' });
        elements.push({ type: 'node', x: 600, y: 150, radius: 18, color: '#f59e0b', label: 'Input B' });
        elements.push({ type: 'node', x: 200, y: 450, radius: 18, color: '#ef4444', label: 'Output' });
        elements.push({ type: 'edge', from: [218, 150], to: [386, 300], color: '#64748b' });
        elements.push({ type: 'edge', from: [582, 150], to: [414, 300], color: '#64748b' });
        elements.push({ type: 'edge', from: [400, 324], to: [218, 450], color: '#64748b' });
        break;

      case VisualizationMode.TIMELINE:
        elements.push({ type: 'line', from: [100, 400], to: [700, 400], color: '#94a3b8', strokeWidth: 2 });
        elements.push({ type: 'circle', x: 150, y: 400, radius: 8, color: '#38bdf8', label: 'Past' });
        elements.push({ type: 'circle', x: 400, y: 400, radius: 10, color: '#f59e0b', label: concept });
        elements.push({ type: 'circle', x: 650, y: 400, radius: 8, color: '#22c55e', label: 'Future' });
        break;

      case VisualizationMode.CHART:
        elements.push({ type: 'bar', x: 120, y: 450, width: 60, height: 100, color: '#38bdf8', label: 'A' });
        elements.push({ type: 'bar', x: 220, y: 350, width: 60, height: 200, color: '#22c55e', label: 'B' });
        elements.push({ type: 'bar', x: 320, y: 250, width: 60, height: 300, color: '#f59e0b', label: 'C' });
        elements.push({ type: 'bar', x: 420, y: 380, width: 60, height: 170, color: '#ef4444', label: 'D' });
        elements.push({ type: 'label', x: 300, y: 520, text: `Comparison: ${topic}`, color: '#f1f5f9', fontSize: 14 });
        break;

      case VisualizationMode.MINIMAP:
        elements.push({ type: 'node', x: 400, y: 300, radius: 20, color: '#38bdf8', label: topic });
        elements.push({ type: 'node', x: 200, y: 150, radius: 12, color: '#64748b', label: 'Related A' });
        elements.push({ type: 'node', x: 600, y: 150, radius: 12, color: '#64748b', label: 'Related B' });
        elements.push({ type: 'node', x: 200, y: 450, radius: 12, color: '#64748b', label: 'Related C' });
        elements.push({ type: 'node', x: 600, y: 450, radius: 12, color: '#64748b', label: 'Related D' });
        elements.push({ type: 'edge', from: [400, 300], to: [212, 162], color: '#475569' });
        elements.push({ type: 'edge', from: [400, 300], to: [588, 162], color: '#475569' });
        elements.push({ type: 'edge', from: [400, 300], to: [212, 438], color: '#475569' });
        elements.push({ type: 'edge', from: [400, 300], to: [588, 438], color: '#475569' });
        break;

      default:
        elements.push({ type: 'rect', x: 250, y: 200, width: 300, height: 200, color: '#1e293b', label: topic });
        elements.push({ type: 'label', x: 300, y: 280, text: concept, color: '#f1f5f9', fontSize: 16 });
        elements.push({ type: 'label', x: 300, y: 320, text: 'Interactive visualization', color: '#94a3b8', fontSize: 12 });
    }
    return elements;
  }

  private static generateAnimationSteps(request: VisualizationRequest, mode: VisualizationMode): AnimationStep[] {
    const steps: AnimationStep[] = [];
    const topic = request.topic;

    switch (mode) {
      case VisualizationMode.SIMULATION:
        steps.push(
          { id: '1', label: 'Initialize', description: 'Set up initial conditions', duration_ms: 1000, actions: [{ type: 'highlight', element: 'container' }], narration: `Let's start with ${topic}.` },
          { id: '2', label: 'Input', description: 'Introduce input parameters', duration_ms: 1500, actions: [{ type: 'animate', property: 'x', from: 150, to: 300 }], narration: 'Now watch how the input flows through.' },
          { id: '3', label: 'Process', description: 'Apply the core process', duration_ms: 2000, actions: [{ type: 'highlight', element: 'node' }], narration: `Here is the key ${request.concept} logic.` },
          { id: '4', label: 'Output', description: 'Observe the result', duration_ms: 1500, actions: [{ type: 'animate', property: 'x', from: 500, to: 600 }], narration: 'And here is the output!' },
        );
        break;

      case VisualizationMode.CODE_TRACE:
        steps.push(
          { id: '1', label: 'Code', description: 'Show the code', duration_ms: 1000, actions: [{ type: 'highlight_line', line: 1 }], narration: `Let's trace this ${topic} code.` },
          { id: '2', label: 'Stack', description: 'Push to stack', duration_ms: 1200, actions: [{ type: 'push_stack', frame: topic + '()' }], narration: 'Function is called.' },
          { id: '3', label: 'Execute', description: 'Run step by step', duration_ms: 2000, actions: [{ type: 'highlight_line', line: 3 }], narration: 'Executing line by line...' },
          { id: '4', label: 'Return', description: 'Pop from stack', duration_ms: 1200, actions: [{ type: 'pop_stack' }], narration: 'Function returns.' },
        );
        break;

      case VisualizationMode.MATH_GRAPH:
        steps.push(
          { id: '1', label: 'Axes', description: 'Draw coordinate system', duration_ms: 1000, actions: [], narration: "First, let's set up our graph." },
          { id: '2', label: 'Plot', description: 'Draw the curve', duration_ms: 2000, actions: [{ type: 'draw_curve' }], narration: `This is the graph of ${topic}.` },
          { id: '3', label: 'Analyze', description: 'Point out key features', duration_ms: 1500, actions: [{ type: 'highlight_point', x: 400, y: 200 }], narration: 'Notice the key point here.' },
        );
        break;

      case VisualizationMode.FLOWCHART:
        steps.push(
          { id: '1', label: 'Start', description: 'Begin the flow', duration_ms: 800, actions: [{ type: 'highlight', element: 'start' }], narration: `Let's trace the flow of ${topic}.` },
          { id: '2', label: 'Decision', description: 'Make a decision', duration_ms: 1200, actions: [{ type: 'highlight', element: 'decision' }], narration: 'Here is the key decision point.' },
          { id: '3', label: 'Result', description: 'Reach the outcome', duration_ms: 1000, actions: [{ type: 'highlight', element: 'result' }], narration: 'And this is the result.' },
        );
        break;

      default:
        steps.push({ id: '1', label: 'Overview', description: 'Show the concept', duration_ms: 2000, actions: [], narration: `Let's look at ${request.concept}.` });
    }
    return steps;
  }

  private static generateRealWorldDemo(request: VisualizationRequest): string {
    const demos: Record<string, string> = {
      'sorting': 'Like organizing a bookshelf by title - you compare and swap until everything is in order.',
      'bubble': 'Like bubbles rising in water - larger bubbles (values) move up faster.',
      'binary search': 'Like finding a word in a dictionary - you open in the middle and eliminate half each time.',
      'recursion': 'Like Russian nesting dolls - each doll contains a smaller version of itself.',
      'neural network': 'Like the human brain - neurons pass signals through connections.',
      'database join': 'Like matching two guest lists for a party - finding people who appear in both.',
      'packet': 'Like sending a letter through the postal system - it goes through multiple stops.',
      'orbit': 'Like swinging a ball on a string - gravity keeps it from flying away.',
      'photosynthesis': 'Like a solar panel that also makes food - plants convert sunlight into energy.',
      'algorithm': 'Like a recipe - step by step instructions to get a result.',
    };
    const key = request.topic.toLowerCase();
    for (const [k, v] of Object.entries(demos)) {
      if (key.includes(k)) return v;
    }
    return `Real-world application of ${request.topic} in everyday technology and industry.`;
  }

  private static generateAccessibilityDescription(request: VisualizationRequest, mode: VisualizationMode): string {
    return `This ${mode} visualization demonstrates ${request.concept} within the context of ${request.topic}. ` +
      `Difficulty: ${request.difficulty}. Level: ${request.student_level}. ` +
      `The visual shows the relationship between components and how the concept works in practice.`;
  }

  private static generateInteractivePoints(request: VisualizationRequest, mode: VisualizationMode): Array<Record<string, unknown>> {
    const points: Array<Record<string, unknown>> = [];
    switch (mode) {
      case VisualizationMode.SIMULATION:
        points.push({ x: 300, y: 300, label: 'Core Process', description: `This is where ${request.concept} happens` });
        points.push({ x: 150, y: 300, label: 'Input', description: 'Where data enters the system' });
        points.push({ x: 550, y: 300, label: 'Output', description: 'The result of the process' });
        break;
      case VisualizationMode.MATH_GRAPH:
        points.push({ x: 400, y: 200, label: 'Key Point', description: `Important point on the ${request.topic} graph` });
        break;
      default:
        points.push({ x: 400, y: 300, label: request.concept, description: `Main concept: ${request.topic}` });
    }
    return points;
  }
}

export function createVisualLearningScene(request: VisualizationRequest): VisualizationScene {
  return VisualizationEngine.generate(request);
}

export { VisualizationMode, VisualizationComplexity, type VisualizationScene, type AnimationStep, SubjectCategory, type VisualizationRequest };
