import type { AnalyzedBlock, AnalysisIssue } from '@context-compiler/core';

/**
 * Everything a rule needs to run.
 * Rules receive the full block list so they can compare across blocks.
 */
export type LintContext = {
  path: string;
  blocks: AnalyzedBlock[];
  totalTokens: number;
};

/**
 * A lint rule.
 * - Receives full LintContext (not just one block) to support cross-block rules.
 * - Returns zero or more issues. Each issue carries its own severity.
 * - Should have no side effects.
 */
export interface IRule {
  readonly id: string;
  readonly description: string;
  check(context: LintContext): AnalysisIssue[];
}

/** Result of running a set of rules against a LintContext. */
export type LintResult = {
  issues: AnalysisIssue[];
  rulesRun: string[];
};
