const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const SPEECH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 divided by $2'],
  [/\\sqrt\{([^{}]+)\}/g, 'square root of $1'],
  [/\\pi\b/g, 'pi'],
  [/\\theta\b/g, 'theta'],
  [/\\alpha\b/g, 'alpha'],
  [/\\beta\b/g, 'beta'],
  [/\\gamma\b/g, 'gamma'],
  [/\\Delta\b/g, 'delta'],
  [/\\Sigma\b/g, 'sigma'],
  [/\\int\b/g, 'integral'],
  [/\\sum\b/g, 'sum'],
  [/\\infty\b/g, 'infinity'],
  [/\\leq\b/g, 'less than or equal to'],
  [/\\geq\b/g, 'greater than or equal to'],
  [/\\neq\b/g, 'not equal to'],
  [/\\times\b/g, 'times'],
  [/\\div\b/g, 'divided by'],
  [/²/g, ' squared'],
  [/³/g, ' cubed'],
  [/⁴/g, ' to the fourth power'],
  [/⁵/g, ' to the fifth power'],
  [/⁶/g, ' to the sixth power'],
  [/⁷/g, ' to the seventh power'],
  [/⁸/g, ' to the eighth power'],
  [/⁹/g, ' to the ninth power'],
  [/ⁿ/g, ' to the n power'],
  [/₀/g, '0'],
  [/₁/g, '1'],
  [/₂/g, '2'],
  [/₃/g, '3'],
  [/₄/g, '4'],
  [/₅/g, '5'],
  [/₆/g, '6'],
  [/₇/g, '7'],
  [/₈/g, '8'],
  [/₉/g, '9'],
  [/√/g, 'square root of '],
  [/∞/g, 'infinity'],
  [/≤/g, ' less than or equal to '],
  [/≥/g, ' greater than or equal to '],
  [/≠/g, ' not equal to '],
  [/≈/g, ' approximately equal to '],
  [/±/g, ' plus or minus '],
  [/×/g, ' times '],
  [/÷/g, ' divided by '],
  [/→/g, ' goes to '],
  [/↔/g, ' if and only if '],
];

export function appendStreamChunk(currentContent: string, chunk: string): string {
  return currentContent + chunk;
}

export function safeMarkdownUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('#')) return trimmed;
  if (/^(?:\.{0,2}\/|\/(?!\/))/.test(trimmed)) return trimmed;

  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  try {
    const parsed = new URL(trimmed, base);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? trimmed : '';
  } catch {
    return '';
  }
}

export function normalizeResponseForSpeech(markdown: string): string {
  let text = markdown
    .replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_match, language: string | undefined, code: string) =>
      `${language ? `${language} code: ` : 'code: '}${code}`,
    )
    .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
    .replace(/\$([^$]+)\$/g, ' $1 ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<\/?[^>]+>/g, '');

  for (const [pattern, replacement] of SPEECH_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
