import type { IssueSeverityCounts } from './batch.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FailOnSeverity = 'error' | 'warning' | 'info';

/**
 * Thrown when a check-mode condition is violated.
 * Caught in command handlers to exit with code 2 instead of 1.
 */
export class CheckFailureError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'CheckFailureError';
  }
}

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

/**
 * Parses and validates the --fail-on flag value.
 * Throws a regular Error (exit 1 path) on invalid input.
 */
export function parseFailOnSeverity(value: string): FailOnSeverity {
  if (value === 'error' || value === 'warning' || value === 'info') return value;
  throw new Error(`--fail-on must be 'error', 'warning', or 'info', got: "${value}"`);
}

/**
 * Parses and validates the --max-tokens flag value.
 * Throws a regular Error (exit 1 path) on invalid input.
 */
export function parseMaxTokens(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--max-tokens must be a positive integer, got: "${value}"`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Check functions — throw CheckFailureError (exit 2 path)
// ---------------------------------------------------------------------------

/**
 * Returns the total issue count at or above the severity threshold.
 *
 * Severity order: error > warning > info
 *   'error'   → counts.error only
 *   'warning' → counts.error + counts.warning
 *   'info'    → counts.error + counts.warning + counts.info
 */
export function countAtOrAbove(counts: IssueSeverityCounts, threshold: FailOnSeverity): number {
  switch (threshold) {
    case 'error': return counts.error;
    case 'warning': return counts.error + counts.warning;
    case 'info': return counts.error + counts.warning + counts.info;
  }
}

/**
 * Throws CheckFailureError if the combined issue count is at or above the threshold.
 *
 * `counts` must include both analysis warnings and lint-rule issues
 * (computed by countIssuesBySeverity([...report.issues, ...lintResult.issues])).
 */
export function assertLintPass(
  counts: IssueSeverityCounts,
  threshold: FailOnSeverity,
  context: string,
): void {
  const total = countAtOrAbove(counts, threshold);
  if (total === 0) return;

  const label =
    threshold === 'error'
      ? `${total} error(s)`
      : threshold === 'warning'
        ? `${total} issue(s) at warning level or above`
        : `${total} issue(s)`;

  throw new CheckFailureError(
    `lint check failed: ${label} [--fail-on ${threshold}] in ${context}`,
  );
}

/**
 * Throws CheckFailureError if any file would change.
 *
 * kind:
 *   'file'    → used for file path and directory inputs
 *   'content' → used for --text and --stdin inputs
 */
export function assertOptimizeNoChanges(
  changedCount: number,
  context: string,
  kind: 'file' | 'content' = 'file',
): void {
  if (changedCount === 0) return;

  const what =
    kind === 'content' ? 'content would change' : `${changedCount} file(s) would change`;

  throw new CheckFailureError(`optimize check failed: ${what} in ${context}`);
}

/** Maximum number of file paths listed individually in a budget failure message. */
const BUDGET_LIST_CAP = 3;

/**
 * Throws CheckFailureError if any file exceeds the token budget (per-file check).
 *
 * For directory mode with many offending files, the message stays compact:
 * lists up to BUDGET_LIST_CAP file names and summarizes the rest as "and N more".
 */
export function assertWithinBudget(
  files: Array<{ path: string; totalTokens: number }>,
  maxTokens: number,
  context: string,
): void {
  const offending = files.filter(f => f.totalTokens > maxTokens);
  if (offending.length === 0) return;

  const listed = offending.slice(0, BUDGET_LIST_CAP);
  const rest = offending.length - listed.length;

  const fileList = listed.map(f => `${f.path} (${f.totalTokens} tokens)`).join(', ');
  const suffix = rest > 0 ? `, and ${rest} more` : '';

  throw new CheckFailureError(
    `token budget exceeded in ${context}: ${fileList}${suffix} (max: ${maxTokens})`,
  );
}
