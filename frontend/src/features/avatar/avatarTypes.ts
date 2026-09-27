// Avatar type system for the AI Teacher Avatar.

export type AvatarPersona =
  | 'male_teacher'
  | 'female_teacher'
  | 'professor'
  | 'school_teacher'
  | 'friendly_mentor'
  | 'kids_teacher';

export type AvatarExpression =
  | 'neutral'
  | 'smiling'
  | 'thinking'
  | 'listening'
  | 'explaining'
  | 'questioning'
  | 'encouraging'
  | 'celebrating'
  | 'concerned'
  | 'curious'
  | 'confident';

export type AvatarGesture =
  | 'idle'
  | 'greeting'
  | 'pointing'
  | 'writing'
  | 'explaining'
  | 'celebrating'
  | 'thinking'
  | 'listening'
  | 'wave';

export type AvatarLanguage = 'en' | 'te' | 'hi' | 'bilingual';

export type AvatarQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface AvatarState {
  persona: AvatarPersona;
  expression: AvatarExpression;
  gesture: AvatarGesture;
  language: AvatarLanguage;
  speaking: boolean;
  lipSync: boolean;
  eyeTarget: 'student' | 'whiteboard' | 'diagram' | 'idle';
  quality: AvatarQuality;
  fullscreen: boolean;
  captionsEnabled: boolean;
}

export interface AvatarExpressionPreset {
  name: AvatarExpression;
  mouthOpen: number;
  mouthSmile: number;
  eyebrowRaise: number;
  eyeBlink: number;
  headTilt: number;
}

export interface AvatarGesturePreset {
  name: AvatarGesture;
  leftArmAngle: number;
  rightArmAngle: number;
  leftHandPosition: [number, number, number];
  rightHandPosition: [number, number, number];
  bodyRotation: number;
  headRotation: number;
}

export interface AvatarLipSyncFrame {
  viseme: string;
  blend: number;
  timestamp: number;
}

export interface AvatarAnimationConfig {
  expressionTransitionSpeed: number;
  gestureTransitionSpeed: number;
  eyeMovementSpeed: number;
  blinkInterval: number;
  breathingSpeed: number;
  idleMovementAmplitude: number;
}

export const DEFAULT_AVATAR_STATE: AvatarState = {
  persona: 'friendly_mentor',
  expression: 'neutral',
  gesture: 'idle',
  language: 'en',
  speaking: false,
  lipSync: true,
  eyeTarget: 'student',
  quality: 'medium',
  fullscreen: false,
  captionsEnabled: true,
};

export const AVATAR_EXPRESSION_PRESETS: Record<AvatarExpression, AvatarExpressionPreset> = {
  neutral: { name: 'neutral', mouthOpen: 0.1, mouthSmile: 0.0, eyebrowRaise: 0.0, eyeBlink: 1.0, headTilt: 0.0 },
  smiling: { name: 'smiling', mouthOpen: 0.2, mouthSmile: 0.8, eyebrowRaise: 0.1, eyeBlink: 1.0, headTilt: 0.0 },
  thinking: { name: 'thinking', mouthOpen: 0.1, mouthSmile: 0.0, eyebrowRaise: 0.6, eyeBlink: 0.8, headTilt: 0.2 },
  listening: { name: 'listening', mouthOpen: 0.1, mouthSmile: 0.1, eyebrowRaise: 0.2, eyeBlink: 1.0, headTilt: 0.0 },
  explaining: { name: 'explaining', mouthOpen: 0.3, mouthSmile: 0.3, eyebrowRaise: 0.3, eyeBlink: 0.9, headTilt: 0.0 },
  questioning: { name: 'questioning', mouthOpen: 0.2, mouthSmile: 0.0, eyebrowRaise: 0.7, eyeBlink: 1.0, headTilt: 0.3 },
  encouraging: { name: 'encouraging', mouthOpen: 0.3, mouthSmile: 0.9, eyebrowRaise: 0.2, eyeBlink: 1.0, headTilt: 0.0 },
  celebrating: { name: 'celebrating', mouthOpen: 0.5, mouthSmile: 1.0, eyebrowRaise: 0.4, eyeBlink: 1.0, headTilt: 0.0 },
  concerned: { name: 'concerned', mouthOpen: 0.1, mouthSmile: -0.2, eyebrowRaise: 0.4, eyeBlink: 0.9, headTilt: -0.1 },
  curious: { name: 'curious', mouthOpen: 0.2, mouthSmile: 0.2, eyebrowRaise: 0.5, eyeBlink: 1.0, headTilt: 0.15 },
  confident: { name: 'confident', mouthOpen: 0.2, mouthSmile: 0.4, eyebrowRaise: 0.1, eyeBlink: 1.0, headTilt: 0.0 },
};

export const AVATAR_GESTURE_PRESETS: Record<AvatarGesture, AvatarGesturePreset> = {
  idle: { name: 'idle', leftArmAngle: 0, rightArmAngle: 0, leftHandPosition: [-0.4, -0.2, 0], rightHandPosition: [0.4, -0.2, 0], bodyRotation: 0, headRotation: 0 },
  greeting: { name: 'greeting', leftArmAngle: 0.5, rightArmAngle: -0.8, leftHandPosition: [-0.3, 0.1, 0.1], rightHandPosition: [0.5, 0.3, 0.1], bodyRotation: 0.1, headRotation: 0.1 },
  pointing: { name: 'pointing', leftArmAngle: 0.2, rightArmAngle: -1.2, leftHandPosition: [-0.3, -0.1, 0], rightHandPosition: [0.6, 0.1, 0.2], bodyRotation: 0.2, headRotation: 0.2 },
  writing: { name: 'writing', leftArmAngle: 0.3, rightArmAngle: -0.9, leftHandPosition: [-0.2, -0.3, 0.1], rightHandPosition: [0.1, -0.1, 0.2], bodyRotation: 0.3, headRotation: -0.2 },
  explaining: { name: 'explaining', leftArmAngle: 0.4, rightArmAngle: -0.6, leftHandPosition: [-0.5, 0.0, 0.1], rightHandPosition: [0.5, 0.0, 0.1], bodyRotation: 0, headRotation: 0 },
  celebrating: { name: 'celebrating', leftArmAngle: 1.0, rightArmAngle: -1.0, leftHandPosition: [-0.5, 0.5, 0], rightHandPosition: [0.5, 0.5, 0], bodyRotation: 0, headRotation: 0 },
  thinking: { name: 'thinking', leftArmAngle: 0.6, rightArmAngle: -0.3, leftHandPosition: [-0.4, 0.2, 0], rightHandPosition: [0.2, -0.3, 0.1], bodyRotation: 0.1, headRotation: -0.2 },
  listening: { name: 'listening', leftArmAngle: 0.1, rightArmAngle: 0.1, leftHandPosition: [-0.3, -0.2, 0], rightHandPosition: [0.3, -0.2, 0], bodyRotation: 0, headRotation: 0 },
  wave: { name: 'wave', leftArmAngle: 0.2, rightArmAngle: -1.5, leftHandPosition: [-0.3, -0.1, 0], rightHandPosition: [0.6, 0.4, 0], bodyRotation: -0.1, headRotation: 0.1 },
};

export const AVATAR_PERSONA_COLORS: Record<AvatarPersona, {
  suit: string;
  suitDark: string;
  accent: string;
  hair: string;
  skin: string;
  hasGlasses: boolean;
}> = {
  male_teacher: { suit: '#2b4a7a', suitDark: '#1a2f52', accent: '#f4b860', hair: '#1a1a1a', skin: '#f5d0a9', hasGlasses: false },
  female_teacher: { suit: '#1f8a8a', suitDark: '#156060', accent: '#ffd1dc', hair: '#2a1a0a', skin: '#f5d0a9', hasGlasses: false },
  professor: { suit: '#6d2b3a', suitDark: '#4a1d26', accent: '#d9b06a', hair: '#3a3a3a', skin: '#f5d0a9', hasGlasses: true },
  school_teacher: { suit: '#2f8f4e', suitDark: '#1f6034', accent: '#ffe08a', hair: '#4a3020', skin: '#f5d0a9', hasGlasses: false },
  friendly_mentor: { suit: '#6d3bd1', suitDark: '#4a2890', accent: '#35c2a1', hair: '#1a1a1a', skin: '#f5d0a9', hasGlasses: false },
  kids_teacher: { suit: '#f0803c', suitDark: '#c0652d', accent: '#ffd23f', hair: '#3a2010', skin: '#f5d0a9', hasGlasses: false },
};

export const VISEME_MAP: Record<string, { mouthOpen: number; mouthSmile: number }> = {
  'sil': { mouthOpen: 0.0, mouthSmile: 0.0 },
  'a': { mouthOpen: 0.9, mouthSmile: 0.2 },
  'i': { mouthOpen: 0.3, mouthSmile: 0.3 },
  'u': { mouthOpen: 0.4, mouthSmile: 0.0 },
  'e': { mouthOpen: 0.4, mouthSmile: 0.5 },
  'o': { mouthOpen: 0.6, mouthSmile: 0.1 },
  'th': { mouthOpen: 0.2, mouthSmile: 0.0 },
  'f': { mouthOpen: 0.1, mouthSmile: 0.0 },
  'p': { mouthOpen: 0.0, mouthSmile: 0.0 },
  't': { mouthOpen: 0.2, mouthSmile: 0.0 },
  'k': { mouthOpen: 0.3, mouthSmile: 0.0 },
  'ch': { mouthOpen: 0.2, mouthSmile: 0.1 },
  'sh': { mouthOpen: 0.2, mouthSmile: 0.1 },
  'n': { mouthOpen: 0.2, mouthSmile: 0.1 },
  'm': { mouthOpen: 0.0, mouthSmile: 0.2 },
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpExpression(
  from: AvatarExpressionPreset,
  to: AvatarExpressionPreset,
  t: number
): AvatarExpressionPreset {
  return {
    name: t < 0.5 ? from.name : to.name,
    mouthOpen: lerp(from.mouthOpen, to.mouthOpen, t),
    mouthSmile: lerp(from.mouthSmile, to.mouthSmile, t),
    eyebrowRaise: lerp(from.eyebrowRaise, to.eyebrowRaise, t),
    eyeBlink: lerp(from.eyeBlink, to.eyeBlink, t),
    headTilt: lerp(from.headTilt, to.headTilt, t),
  };
}

export function lerpGesture(
  from: AvatarGesturePreset,
  to: AvatarGesturePreset,
  t: number
): AvatarGesturePreset {
  return {
    name: t < 0.5 ? from.name : to.name,
    leftArmAngle: lerp(from.leftArmAngle, to.leftArmAngle, t),
    rightArmAngle: lerp(from.rightArmAngle, to.rightArmAngle, t),
    leftHandPosition: from.leftHandPosition.map((v, i) => lerp(v, to.leftHandPosition[i], t)) as [number, number, number],
    rightHandPosition: from.rightHandPosition.map((v, i) => lerp(v, to.rightHandPosition[i], t)) as [number, number, number],
    bodyRotation: lerp(from.bodyRotation, to.bodyRotation, t),
    headRotation: lerp(from.headRotation, to.headRotation, t),
  };
}
