import { describe, expect, it } from 'vitest';

import {
  DESIGN_SYSTEM_TOKENS,
  createClassroomExperiencePlan,
  createOnboardingPlan,
  createStudentDashboardPlan,
  motionLevel,
  viewportClass,
} from './experiencePolicy';

describe('ui experience policy', () => {
  it('classifies responsive viewport bands', () => {
    expect(viewportClass(390)).toBe('mobile');
    expect(viewportClass(900)).toBe('tablet');
    expect(viewportClass(1280)).toBe('desktop');
    expect(viewportClass(1600)).toBe('wide');
  });

  it('prioritizes accessibility over decorative motion', () => {
    expect(motionLevel({ learningMode: 'school', reducedMotion: true })).toBe('none');
    expect(motionLevel({ learningMode: 'school', reducedMotion: false })).toBe('expressive');
    expect(motionLevel({ learningMode: 'research', reducedMotion: false })).toBe('subtle');
  });

  it('creates a mobile classroom plan with sticky controls and sheet side panels', () => {
    const plan = createClassroomExperiencePlan({
      viewportWidth: 420,
      learningMode: 'school',
      reducedMotion: true,
      highContrast: true,
      voiceEnabled: true,
      cameraEnabled: true,
    });

    expect(plan.layoutMode).toBe('mobile_stacked');
    expect(plan.density).toBe('compact');
    expect(plan.tutorPanel.persistent).toBe(false);
    expect(plan.regions.find((region) => region.id === 'roadmap')?.behavior).toBe('sheet');
    expect(plan.regions.find((region) => region.id === 'bottom_controls')?.behavior).toBe('sticky');
    expect(plan.accessibility).toContain('static visual fallback');
    expect(plan.accessibility).toContain('high contrast color pairings');
    expect(plan.bottomControls).toContain('camera');
  });

  it('creates a wide classroom plan with persistent learning regions', () => {
    const plan = createClassroomExperiencePlan({
      viewportWidth: 1600,
      learningMode: 'professional_certification',
      voiceEnabled: false,
    });

    expect(plan.layoutMode).toBe('immersive_wide');
    expect(plan.motionLevel).toBe('subtle');
    expect(plan.regions.every((region) => region.behavior === 'persistent' || region.behavior === 'sticky')).toBe(true);
    expect(plan.bottomControls).not.toContain('microphone');
  });

  it('defines dashboard and onboarding order for future pages', () => {
    const dashboard = createStudentDashboardPlan({ isAdmin: true });
    const onboarding = createOnboardingPlan();

    expect(dashboard[0].id).toBe('resume_lesson');
    expect(dashboard[dashboard.length - 1]?.id).toBe('admin_health');
    expect(onboarding.filter((step) => step.required).map((step) => step.id)).toEqual([
      'language',
      'goals',
      'subjects',
      'study_time',
    ]);
  });

  it('keeps premium design tokens centralized', () => {
    expect(DESIGN_SYSTEM_TOKENS.typography.display).toBe('Space Grotesk');
    expect(DESIGN_SYSTEM_TOKENS.colorRoles.brand).toBe('brand gradient');
    expect(DESIGN_SYSTEM_TOKENS.elevation.floating).toContain('backdrop blur');
  });
});
