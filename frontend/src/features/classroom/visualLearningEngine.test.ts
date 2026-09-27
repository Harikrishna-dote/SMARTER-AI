import { describe, expect, it } from 'vitest';

import { createVisualLearningScene } from './visualLearningEngine';

describe('visual learning engine', () => {
  it('selects code trace visuals for programming topics', () => {
    const scene = createVisualLearningScene({
      topic: 'Binary search',
      concept: 'Shrinking search space',
      level: 'Beginner',
      learningMode: 'programming',
    });

    expect(scene.mode).toBe('code_trace');
    expect(scene.script.length).toBeGreaterThan(0);
  });

  it('selects graph visuals for mathematics relationships', () => {
    const scene = createVisualLearningScene({
      topic: 'Quadratic functions',
      concept: 'Graph transformation',
      level: 'Grade 10',
      learningMode: 'school',
    });

    expect(scene.mode).toBe('graph');
    expect(scene.complexity).toBe('intermediate');
  });

  it('preserves AI supplied visual scripts', () => {
    const scene = createVisualLearningScene({
      topic: 'Gravity',
      concept: 'Falling object',
      level: 'Advanced',
      learningMode: 'school',
      existingScript: [{ type: 'circle', x: 100, y: 100, label: 'AI visual' }],
    });

    expect(scene.script).toEqual([{ type: 'circle', x: 100, y: 100, label: 'AI visual' }]);
  });
});

