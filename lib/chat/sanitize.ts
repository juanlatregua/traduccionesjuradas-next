const MAX_MESSAGE_LENGTH = 500;

const INJECTION_PATTERNS = [
  /ignora\s+(tus|las)\s+instrucciones/i,
  /ignore\s+(your|all)\s+instructions/i,
  /ignore\s+tes\s+instructions/i,
  /eres\s+ahora/i,
  /you\s+are\s+now/i,
  /tu\s+es\s+maintenant/i,
  /system\s*prompt\s*:/i,
  /\bsystem\s*:\s*/i,
  /act\s+as\s+(a|an)\s/i,
  /nueva\s+personalidad/i,
  /new\s+persona/i,
  /olvida\s+todo/i,
  /forget\s+(everything|all)/i,
  /oublie\s+tout/i,
  /\brole\s*:\s*system/i,
  /\bpretend\s+you/i,
  /\bsimula\s+que/i,
  /\bfais\s+semblant/i,
];

export function sanitizeMessage(text: string): string {
  // Strip HTML tags
  const stripped = text.replace(/<[^>]*>/g, "");
  // Truncate
  return stripped.slice(0, MAX_MESSAGE_LENGTH).trim();
}

export function isPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
