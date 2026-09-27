// AI Teacher Avatar Engine - manages state, expressions, gestures, lip sync, and eye movement.

import {
  AvatarExpression,
  AvatarGesture,
  AvatarState,
  AvatarExpressionPreset,
  AvatarGesturePreset,
  AvatarLipSyncFrame,
  AvatarPersona,
  AvatarLanguage,
  AvatarQuality,
  AVATAR_EXPRESSION_PRESETS,
  AVATAR_GESTURE_PRESETS,
  DEFAULT_AVATAR_STATE,
  lerp,
  lerpExpression,
  lerpGesture,
} from './avatarTypes';

export class AvatarEngine {
  private state: AvatarState;
  private currentExpression: AvatarExpressionPreset;
  private currentGesture: AvatarGesturePreset;
  private targetExpression: AvatarExpressionPreset;
  private targetGesture: AvatarGesturePreset;
  private transitionProgress: number = 1;
  private lastBlinkTime: number = 0;
  private blinkDuration: number = 150;
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;
  private breathPhase: number = 0;
  private eyeTarget: { x: number; y: number } = { x: 0, y: 0 };
  private targetEyeTarget: { x: number; y: number } = { x: 0, y: 0 };
  private lipSyncFrames: AvatarLipSyncFrame[] = [];
  private currentLipSyncIndex: number = 0;
  private lipSyncStartTime: number = 0;

  constructor(initialState?: Partial<AvatarState>) {
    this.state = { ...DEFAULT_AVATAR_STATE, ...initialState };
    this.currentExpression = AVATAR_EXPRESSION_PRESETS[this.state.expression];
    this.currentGesture = AVATAR_GESTURE_PRESETS[this.state.gesture];
    this.targetExpression = this.currentExpression;
    this.targetGesture = this.currentGesture;
  }

  getState(): AvatarState {
    return { ...this.state };
  }

  setPersona(persona: AvatarPersona): void {
    this.state.persona = persona;
  }

  setExpression(expression: AvatarExpression): void {
    if (this.state.expression !== expression) {
      this.state.expression = expression;
      this.targetExpression = AVATAR_EXPRESSION_PRESETS[expression];
      this.transitionProgress = 0;
    }
  }

  setGesture(gesture: AvatarGesture): void {
    if (this.state.gesture !== gesture) {
      this.state.gesture = gesture;
      this.targetGesture = AVATAR_GESTURE_PRESETS[gesture];
      this.transitionProgress = 0;
    }
  }

  setLanguage(language: AvatarLanguage): void {
    this.state.language = language;
  }

  setSpeaking(speaking: boolean): void {
    this.state.speaking = speaking;
  }

  setLipSync(enabled: boolean): void {
    this.state.lipSync = enabled;
  }

  setEyeTarget(target: 'student' | 'whiteboard' | 'diagram' | 'idle'): void {
    this.state.eyeTarget = target;
    switch (target) {
      case 'student':
        this.targetEyeTarget = { x: 0, y: 0 };
        break;
      case 'whiteboard':
        this.targetEyeTarget = { x: 0, y: 0.3 };
        break;
      case 'diagram':
        this.targetEyeTarget = { x: 0.2, y: 0.1 };
        break;
      case 'idle':
        this.targetEyeTarget = { x: 0, y: 0 };
        break;
    }
  }

  setQuality(quality: AvatarQuality): void {
    this.state.quality = quality;
  }

  setFullscreen(fullscreen: boolean): void {
    this.state.fullscreen = fullscreen;
  }

  setCaptionsEnabled(enabled: boolean): void {
    this.state.captionsEnabled = enabled;
  }

  loadLipSyncFrames(frames: AvatarLipSyncFrame[]): void {
    this.lipSyncFrames = frames;
    this.currentLipSyncIndex = 0;
    this.lipSyncStartTime = performance.now();
  }

  clearLipSyncFrames(): void {
    this.lipSyncFrames = [];
    this.currentLipSyncIndex = 0;
  }

  update(deltaMs: number, now: number): {
    expression: AvatarExpressionPreset;
    gesture: AvatarGesturePreset;
    eyeTarget: { x: number; y: number };
    mouthOpen: number;
    mouthSmile: number;
    eyeBlink: number;
    isBlinking: boolean;
    breathOffset: number;
  } {
    const transitionSpeed = 0.05;
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + transitionSpeed);
      const t = this.transitionProgress;
      this.currentExpression = lerpExpression(this.currentExpression, this.targetExpression, t);
      this.currentGesture = lerpGesture(this.currentGesture, this.targetGesture, t);
    }

    this.updateBlink(now);
    this.updateBreathing(now);
    this.updateEyeTarget(deltaMs);
    const lipSync = this.updateLipSync(now);

    return {
      expression: this.currentExpression,
      gesture: this.currentGesture,
      eyeTarget: this.eyeTarget,
      mouthOpen: this.currentExpression.mouthOpen + lipSync.blend,
      mouthSmile: this.currentExpression.mouthSmile,
      eyeBlink: this.isBlinking ? 0.2 : this.currentExpression.eyeBlink,
      isBlinking: this.isBlinking,
      breathOffset: Math.sin(this.breathPhase) * 0.02,
    };
  }

  private updateBlink(now: number): void {
    if (this.isBlinking) {
      if (now - this.blinkStartTime > this.blinkDuration) {
        this.isBlinking = false;
        this.lastBlinkTime = now;
      }
      return;
    }

    const interval = 2000 + Math.random() * 4000;
    if (now - this.lastBlinkTime > interval) {
      this.isBlinking = true;
      this.blinkStartTime = now;
    }
  }

  private updateBreathing(now: number): void {
    this.breathPhase += 0.002;
  }

  private updateEyeTarget(deltaMs: number): void {
    const speed = 0.03;
    this.eyeTarget.x = lerp(this.eyeTarget.x, this.targetEyeTarget.x, speed);
    this.eyeTarget.y = lerp(this.eyeTarget.y, this.targetEyeTarget.y, speed);
  }

  private updateLipSync(now: number): { viseme: string; blend: number } {
    if (!this.state.lipSync || !this.state.speaking || this.lipSyncFrames.length === 0) {
      return { viseme: 'sil', blend: 0 };
    }

    const elapsed = now - this.lipSyncStartTime;
    while (this.currentLipSyncIndex < this.lipSyncFrames.length - 1) {
      const current = this.lipSyncFrames[this.currentLipSyncIndex];
      const next = this.lipSyncFrames[this.currentLipSyncIndex + 1];
      if (elapsed >= next.timestamp) {
        this.currentLipSyncIndex++;
      } else {
        break;
      }
    }

    const frame = this.lipSyncFrames[this.currentLipSyncIndex];
    const visemeData = {
      mouthOpen: frame.blend * 0.5,
      mouthSmile: 0,
    };

    return { viseme: frame.viseme, blend: visemeData.mouthOpen };
  }

  getExpressionPreset(name: AvatarExpression): AvatarExpressionPreset {
    return AVATAR_EXPRESSION_PRESETS[name];
  }

  getGesturePreset(name: AvatarGesture): AvatarGesturePreset {
    return AVATAR_GESTURE_PRESETS[name];
  }

  getAllExpressions(): AvatarExpression[] {
    return Object.keys(AVATAR_EXPRESSION_PRESETS) as AvatarExpression[];
  }

  getAllGestures(): AvatarGesture[] {
    return Object.keys(AVATAR_GESTURE_PRESETS) as AvatarGesture[];
  }
}
