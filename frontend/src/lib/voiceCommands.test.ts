import { describe, expect, it } from 'vitest';
import { extractSmartCommand, hasSmartWakeWord, stripSmartWakeWord } from './voiceCommands';

describe('Smart wake commands', () => {
  it('extracts English and mixed-language requests', () => {
    expect(hasSmartWakeWord('Smart, explain acceleration')).toBe(true);
    expect(extractSmartCommand('Smart, naaku idi ardham kaaledu')).toBe('naaku idi ardham kaaledu');
    expect(stripSmartWakeWord('Hey Smart: Telugu lo cheppu')).toBe('Telugu lo cheppu');
  });

  it('does not treat ordinary words as wake phrases', () => {
    expect(hasSmartWakeWord('smartphone battery')).toBe(false);
    expect(extractSmartCommand('Smart')).toBeNull();
    expect(stripSmartWakeWord('Explain Newton\'s second law')).toBe("Explain Newton's second law");
  });
});
