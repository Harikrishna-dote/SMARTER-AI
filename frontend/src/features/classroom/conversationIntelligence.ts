import type { AvatarState } from '../../components/classroom/TeacherAvatar';
import type { ClassroomLanguage } from '../../lib/types';

export type SpokenLanguage = ClassroomLanguage | 'mixed';

export type ConversationEmotion =
  | 'neutral'
  | 'confused'
  | 'confident'
  | 'curious'
  | 'frustrated'
  | 'bored'
  | 'excited'
  | 'fatigued';

export interface ConversationSignal {
  detectedLanguage: SpokenLanguage;
  emotion: ConversationEmotion;
  confidence: number;
  avatarState: AvatarState;
  coachingInstruction: string;
}

const TELUGU_PATTERN = /[\u0C00-\u0C7F]/;
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;
const ENGLISH_PATTERN = /[a-z]/i;

export function detectSpokenLanguage(text: string): SpokenLanguage {
  const hasTelugu = TELUGU_PATTERN.test(text);
  const hasHindi = DEVANAGARI_PATTERN.test(text);
  const hasEnglish = ENGLISH_PATTERN.test(text);
  const count = [hasTelugu, hasHindi, hasEnglish].filter(Boolean).length;

  if (count > 1) return 'mixed';
  if (hasTelugu) return 'te';
  if (hasHindi) return 'hi';
  return 'en';
}

export function estimateConversationSignal(text: string): ConversationSignal {
  const normalized = text.toLowerCase();
  const detectedLanguage = detectSpokenLanguage(text);

  if (/\b(confused|don't understand|did not understand|doubt|stuck|hard|difficult|why)\b/i.test(text)) {
    return {
      detectedLanguage,
      emotion: 'confused',
      confidence: 0.78,
      avatarState: 'encouraging',
      coachingInstruction:
        'The student may be confused. Slow down, reassure them, use a simpler analogy, add one visual, and ask a tiny check question.',
    };
  }

  if (/\b(wrong|annoying|frustrated|irritated|again and again|too fast)\b/i.test(text)) {
    return {
      detectedLanguage,
      emotion: 'frustrated',
      confidence: 0.72,
      avatarState: 'encouraging',
      coachingInstruction:
        'The student may be frustrated. Acknowledge it respectfully, reduce difficulty, avoid blame, and rebuild the idea from the foundation.',
    };
  }

  if (/\b(boring|sleepy|tired|fatigue|exhausted)\b/i.test(text)) {
    return {
      detectedLanguage,
      emotion: 'fatigued',
      confidence: 0.66,
      avatarState: 'listening',
      coachingInstruction:
        'The student may be tired or bored. Shorten the explanation, use a lively real-world example, and offer a quick pause.',
    };
  }

  if (/\b(got it|understood|easy|clear|confident|next|continue)\b/i.test(text)) {
    return {
      detectedLanguage,
      emotion: 'confident',
      confidence: 0.82,
      avatarState: 'celebrating',
      coachingInstruction:
        'The student sounds confident. Celebrate briefly, increase challenge slightly, and connect to the next concept.',
    };
  }

  if (/\b(interesting|curious|what if|how about|why does|can we)\b/i.test(text)) {
    return {
      detectedLanguage,
      emotion: 'curious',
      confidence: 0.74,
      avatarState: 'thinking',
      coachingInstruction:
        'The student is curious. Answer the interruption, connect it to the current lesson, then resume exactly where the lesson paused.',
    };
  }

  return {
    detectedLanguage,
    emotion: 'neutral',
    confidence: 0.55,
    avatarState: 'listening',
    coachingInstruction:
      'Continue like a human teacher: respond naturally, keep context, ask one meaningful question, and avoid generic assistant phrasing.',
  };
}

export function adaptiveConversationInstruction(signal: ConversationSignal): string {
  const languageRule =
    signal.detectedLanguage === 'mixed'
      ? 'The student is mixing languages. Continue naturally without restarting the lesson.'
      : `Detected student language: ${signal.detectedLanguage}. Match the student naturally while preserving lesson context.`;

  return [
    'Conversation intelligence:',
    languageRule,
    `Estimated emotion: ${signal.emotion} (${Math.round(signal.confidence * 100)}% confidence).`,
    signal.coachingInstruction,
    'If the student interrupted, answer the interruption first and then resume the current lesson step.',
  ].join('\n');
}

