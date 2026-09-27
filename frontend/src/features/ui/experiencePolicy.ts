import type { LearningMode } from '../../lib/types';

export type ViewportClass = 'mobile' | 'tablet' | 'desktop' | 'wide';
export type ClassroomLayoutMode = 'mobile_stacked' | 'tablet_split' | 'desktop_three_panel' | 'immersive_wide';
export type MotionLevel = 'none' | 'subtle' | 'standard' | 'expressive';
export type DensityLevel = 'comfortable' | 'balanced' | 'compact';

export interface DesignSystemTokens {
  typography: {
    display: string;
    body: string;
    mono: string;
    scale: Record<'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', string>;
  };
  spacing: Record<'1' | '2' | '3' | '4' | '6' | '8' | '12', string>;
  radius: Record<'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', string>;
  elevation: Record<'surface' | 'raised' | 'floating' | 'spotlight', string>;
  colorRoles: Record<'canvas' | 'surface' | 'surfaceStrong' | 'text' | 'muted' | 'brand' | 'warning' | 'danger' | 'info', string>;
  motion: Record<MotionLevel, string>;
}

export interface ExperienceInput {
  viewportWidth: number;
  learningMode: LearningMode;
  reducedMotion?: boolean;
  highContrast?: boolean;
  voiceEnabled?: boolean;
  cameraEnabled?: boolean;
  isAdmin?: boolean;
}

export interface ClassroomRegionPlan {
  id: 'roadmap' | 'lesson_stage' | 'visual_lab' | 'bottom_controls';
  label: string;
  priority: number;
  behavior: 'persistent' | 'collapsible' | 'sheet' | 'sticky';
  contents: string[];
}

export interface ClassroomExperiencePlan {
  viewport: ViewportClass;
  layoutMode: ClassroomLayoutMode;
  density: DensityLevel;
  motionLevel: MotionLevel;
  regions: ClassroomRegionPlan[];
  tutorPanel: {
    persistent: boolean;
    statusChips: string[];
  };
  whiteboardTools: string[];
  bottomControls: string[];
  accessibility: string[];
  performance: string[];
}

export interface DashboardWidgetPlan {
  id:
    | 'resume_lesson'
    | 'todays_lessons'
    | 'roadmap'
    | 'progress'
    | 'upcoming_reviews'
    | 'homework_projects'
    | 'achievements'
    | 'career_recommendations'
    | 'admin_health';
  label: string;
  priority: number;
}

export interface OnboardingStepPlan {
  id: string;
  label: string;
  required: boolean;
}

export const DESIGN_SYSTEM_TOKENS: DesignSystemTokens = {
  typography: {
    display: 'Space Grotesk',
    body: 'Inter',
    mono: 'JetBrains Mono',
    scale: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
  },
  spacing: {
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
    '8': '2rem',
    '12': '3rem',
  },
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.75rem',
  },
  elevation: {
    surface: 'border + soft background',
    raised: 'shadow-soft',
    floating: 'shadow-glass + backdrop blur',
    spotlight: 'shadow-glow + brand gradient',
  },
  colorRoles: {
    canvas: 'mesh background',
    surface: 'glass',
    surfaceStrong: 'glass-strong',
    text: 'ink/chalk',
    muted: 'slate',
    brand: 'brand gradient',
    warning: 'amber',
    danger: 'coral',
    info: 'sky',
  },
  motion: {
    none: 'static state changes only',
    subtle: 'opacity transitions only',
    standard: 'short entrance and hover transitions',
    expressive: 'guided classroom motion and visual emphasis',
  },
};

export function viewportClass(width: number): ViewportClass {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop';
  return 'wide';
}

export function motionLevel(input: Pick<ExperienceInput, 'reducedMotion' | 'learningMode'>): MotionLevel {
  if (input.reducedMotion) return 'none';
  if (input.learningMode === 'research' || input.learningMode === 'professional_certification') return 'subtle';
  if (input.learningMode === 'school' || input.learningMode === 'language_learning') return 'expressive';
  return 'standard';
}

export function densityForViewport(viewport: ViewportClass): DensityLevel {
  if (viewport === 'mobile') return 'compact';
  if (viewport === 'tablet') return 'balanced';
  return 'comfortable';
}

function layoutModeFor(viewport: ViewportClass): ClassroomLayoutMode {
  if (viewport === 'mobile') return 'mobile_stacked';
  if (viewport === 'tablet') return 'tablet_split';
  if (viewport === 'wide') return 'immersive_wide';
  return 'desktop_three_panel';
}

function regionBehavior(viewport: ViewportClass, region: ClassroomRegionPlan['id']): ClassroomRegionPlan['behavior'] {
  if (region === 'bottom_controls') return 'sticky';
  if (viewport === 'mobile') return region === 'lesson_stage' ? 'persistent' : 'sheet';
  if (viewport === 'tablet') return region === 'visual_lab' ? 'collapsible' : 'persistent';
  return 'persistent';
}

function classroomRegions(viewport: ViewportClass): ClassroomRegionPlan[] {
  return [
    {
      id: 'roadmap',
      label: 'Learning Roadmap',
      priority: 2,
      behavior: regionBehavior(viewport, 'roadmap'),
      contents: ['lesson navigation', 'saved notes', 'bookmarks', 'homework'],
    },
    {
      id: 'lesson_stage',
      label: 'Tutor Stage',
      priority: 1,
      behavior: regionBehavior(viewport, 'lesson_stage'),
      contents: ['teacher avatar', 'conversation', 'lesson content', 'whiteboard', 'interactive exercises'],
    },
    {
      id: 'visual_lab',
      label: 'Visualization Lab',
      priority: 3,
      behavior: regionBehavior(viewport, 'visual_lab'),
      contents: ['dynamic visuals', 'animations', 'examples', 'concept references', 'future 3D models'],
    },
    {
      id: 'bottom_controls',
      label: 'Classroom Controls',
      priority: 0,
      behavior: regionBehavior(viewport, 'bottom_controls'),
      contents: ['voice', 'microphone', 'camera', 'chat', 'language selector', 'playback', 'accessibility'],
    },
  ];
}

function accessibilityChecklist(input: ExperienceInput): string[] {
  const items = [
    'keyboard navigation',
    'visible focus states',
    'screen-reader labels',
    'captions for tutor speech',
    'touch targets at least 48px',
  ];
  if (input.reducedMotion) items.push('static visual fallback');
  if (input.highContrast) items.push('high contrast color pairings');
  if (input.voiceEnabled) items.push('voice control fallback text');
  return items;
}

export function createClassroomExperiencePlan(input: ExperienceInput): ClassroomExperiencePlan {
  const viewport = viewportClass(input.viewportWidth);
  const layoutMode = layoutModeFor(viewport);
  const resolvedMotion = motionLevel(input);
  const bottomControls = ['chat', 'language', 'playback', 'accessibility'];
  if (input.voiceEnabled) bottomControls.unshift('microphone', 'voice');
  if (input.cameraEnabled) bottomControls.push('camera');

  return {
    viewport,
    layoutMode,
    density: densityForViewport(viewport),
    motionLevel: resolvedMotion,
    regions: classroomRegions(viewport),
    tutorPanel: {
      persistent: viewport !== 'mobile',
      statusChips: ['lesson objective', 'speaking status', 'emotion signal', 'progress', 'timer'],
    },
    whiteboardTools: ['draw', 'write', 'highlight', 'equations', 'code snippets', 'flowcharts', 'mind maps', 'zoom', 'undo', 'redo', 'export'],
    bottomControls,
    accessibility: accessibilityChecklist(input),
    performance: [
      'lazy-load visualization adapters',
      'stream tutor content before visuals',
      'virtualize long lists',
      'prefer CSS transforms for motion',
      'defer non-critical dashboard widgets',
    ],
  };
}

export function createStudentDashboardPlan(input: Pick<ExperienceInput, 'isAdmin'>): DashboardWidgetPlan[] {
  const widgets: DashboardWidgetPlan[] = [
    { id: 'resume_lesson', label: 'Resume Lesson', priority: 0 },
    { id: 'todays_lessons', label: "Today's Lessons", priority: 1 },
    { id: 'roadmap', label: 'Learning Roadmap', priority: 2 },
    { id: 'progress', label: 'Progress Overview', priority: 3 },
    { id: 'upcoming_reviews', label: 'Upcoming Reviews', priority: 4 },
    { id: 'homework_projects', label: 'Homework and Projects', priority: 5 },
    { id: 'achievements', label: 'Achievements', priority: 6 },
    { id: 'career_recommendations', label: 'Career Recommendations', priority: 7 },
  ];
  if (input.isAdmin) {
    widgets.push({ id: 'admin_health', label: 'Admin Health Snapshot', priority: 8 });
  }
  return widgets.sort((left, right) => left.priority - right.priority);
}

export function createOnboardingPlan(): OnboardingStepPlan[] {
  return [
    { id: 'language', label: 'Preferred language', required: true },
    { id: 'voice', label: 'Preferred voice', required: false },
    { id: 'goals', label: 'Learning goals', required: true },
    { id: 'subjects', label: 'Subjects of interest', required: true },
    { id: 'career', label: 'Career aspirations', required: false },
    { id: 'study_time', label: 'Daily study time', required: true },
    { id: 'learning_style', label: 'Learning style', required: false },
    { id: 'accessibility', label: 'Accessibility preferences', required: false },
  ];
}
