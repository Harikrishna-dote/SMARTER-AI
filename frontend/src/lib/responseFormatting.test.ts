import { describe, expect, it } from 'vitest';

import { appendStreamChunk, normalizeResponseForSpeech, safeMarkdownUrl } from './responseFormatting';

describe('response formatting utilities', () => {
  it('appends stream chunks without trimming or inventing spaces', () => {
    const chunks = ['Okay, ', "let's", '\n\n    keep indentation', '\nH₂O ≤ x → y'];
    const result = chunks.reduce(appendStreamChunk, '');

    expect(result).toBe("Okay, let's\n\n    keep indentation\nH₂O ≤ x → y");
  });

  it('keeps speech normalization separate from visual content', () => {
    const speech = normalizeResponseForSpeech(
      '# Linear Equation\n\nUse **steps** and `$x^2$`.\n\n```python\nprint("x")\n```\n\nH₂O ≤ x → y',
    );

    expect(speech).not.toContain('#');
    expect(speech).not.toContain('```');
    expect(speech).not.toContain('**');
    expect(speech).toContain('Linear Equation');
    expect(speech).toContain('python code: print("x")');
    expect(speech).toContain('H2O less than or equal to x goes to y');
  });

  it('rejects unsafe markdown urls while allowing normal links', () => {
    expect(safeMarkdownUrl('https://openai.com')).toBe('https://openai.com');
    expect(safeMarkdownUrl('/local/path')).toBe('/local/path');
    expect(safeMarkdownUrl('javascript:alert(1)')).toBe('');
  });
});
