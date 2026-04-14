import type { BlockType } from './types.js';

/**
 * Block classifier v1.
 *
 * Classification rules (evaluated top-to-bottom, first match wins):
 *
 *  structured_data  — valid JSON, YAML/CSV/XML code fences, markdown tables
 *  tool_output      — shell/output code fences, result:/error: prefixes, error keywords
 *  memory           — temporal references, dated content, history markers
 *  example          — explicit "Example:" markers or example section headings
 *  constraint       — prohibitive/restrictive language ("do not", "never", "avoid")
 *  instruction      — directive language ("You are", "Your task", "Always respond")
 *  unknown          — fallback when no heuristic matches
 *
 * No AI calls. No external deps.
 */
export function classifyBlock(content: string): BlockType {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();
  const firstLine = trimmed.split('\n')[0]?.toLowerCase() ?? '';

  // structured_data -------------------------------------------------------
  if (isJson(trimmed)) return 'structured_data';
  if (/^```(json|yaml|yml|csv|xml|toml)/i.test(trimmed)) return 'structured_data';
  if (isMarkdownTable(trimmed)) return 'structured_data';

  // tool_output ------------------------------------------------------------
  if (/^```(bash|sh|shell|console|output|result|stdout|stderr)/i.test(trimmed)) return 'tool_output';
  if (/^(result|output|error|response|status)\s*:/im.test(trimmed)) return 'tool_output';
  if (/^```/.test(trimmed) && /\b(exception|traceback|stderr|stdout|exit code)\b/i.test(trimmed)) {
    return 'tool_output';
  }

  // memory -----------------------------------------------------------------
  if (/\b(remember|previously|earlier|you said|i said|we discussed|last time|as mentioned|history)\b/i.test(lower)) {
    return 'memory';
  }
  // ISO date pattern (e.g. 2024-01-15) not inside a heading
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(trimmed) && !/^#{1,6} /.test(trimmed)) return 'memory';

  // example ----------------------------------------------------------------
  if (/^(example|for example|e\.g\.|input:|output:|sample:|here is an example)/i.test(firstLine)) {
    return 'example';
  }
  if (/^#{1,6} (example|examples|sample|demo)/i.test(trimmed)) return 'example';

  // constraint -------------------------------------------------------------
  if (/^#{1,6} (constraint|constraints|rule|rules|restriction|restrictions|limitation|limitations)/i.test(trimmed)) {
    return 'constraint';
  }
  if (/^(do not|don't|never|avoid|you must not|you should not|prohibited|forbidden)\b/i.test(firstLine)) {
    return 'constraint';
  }
  // Constraint language anywhere in a short block (< 500 chars)
  if (
    trimmed.length < 500 &&
    /\b(must not|should not|do not|don't|never|avoid|prohibited|forbidden|not allowed)\b/i.test(lower)
  ) {
    return 'constraint';
  }

  // instruction ------------------------------------------------------------
  if (/^(you are|your role|your task|you will|you should|your job|act as|always |respond |answer )/i.test(firstLine)) {
    return 'instruction';
  }
  if (/^#{1,6} (instruction|task|role|system|context|overview|goal|objective|prompt)/i.test(trimmed)) {
    return 'instruction';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isJson(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

function isMarkdownTable(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return false;
  const pipeLines = lines.filter(l => l.includes('|'));
  return pipeLines.length / lines.length > 0.5;
}
