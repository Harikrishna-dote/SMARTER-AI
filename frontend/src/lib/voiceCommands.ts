const SMART_WAKE_RE = /^\s*(?:smart|smarter|hey\s+smart|ok\s+smart)(?:(?:\s*[,:-]\s*|\s+)(.*?))?\s*$/i;

export function hasSmartWakeWord(text: string): boolean {
  return SMART_WAKE_RE.test(text);
}

export function extractSmartCommand(text: string): string | null {
  const match = text.match(SMART_WAKE_RE);
  const command = match?.[1]?.trim();
  return command || null;
}

export function stripSmartWakeWord(text: string): string {
  return extractSmartCommand(text) ?? (hasSmartWakeWord(text) ? '' : text.trim());
}
