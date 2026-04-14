import type { IRule, LintContext, LintResult } from './types.js';

/**
 * Run a set of rules against a LintContext.
 * Rules are independent — all run regardless of earlier failures.
 */
export function runLint(rules: IRule[], context: LintContext): LintResult {
  const issues = rules.flatMap(rule => rule.check(context));
  return { issues, rulesRun: rules.map(r => r.id) };
}
