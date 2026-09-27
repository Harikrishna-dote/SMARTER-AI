import { describe, expect, it } from 'vitest';

import {
  adaptiveConversationInstruction,
  detectSpokenLanguage,
  estimateConversationSignal,
} from './conversationIntelligence';

describe('classroom conversation intelligence', () => {
  it('detects Telugu, Hindi, English, and mixed language text', () => {
    expect(detectSpokenLanguage('Hello teacher')).toBe('en');
    expect(detectSpokenLanguage('నమస్తే టీచర్')).toBe('te');
    expect(detectSpokenLanguage('नमस्ते teacher')).toBe('mixed');
  });

  it('maps confusion to a slower supportive teaching instruction', () => {
    const signal = estimateConversationSignal("I don't understand this, it is difficult");

    expect(signal.emotion).toBe('confused');
    expect(signal.avatarState).toBe('encouraging');
    expect(adaptiveConversationInstruction(signal)).toContain('Slow down');
  });

  it('maps confident responses to progression behavior', () => {
    const signal = estimateConversationSignal('Understood, next');

    expect(signal.emotion).toBe('confident');
    expect(signal.avatarState).toBe('celebrating');
  });
});

