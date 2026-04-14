import type { PromptBlock, AnalysisIssue, IssueSeverity } from '@context-compiler/core';

export interface IRule {
  readonly id: string;
  readonly description: string;
  readonly severity: IssueSeverity;
  check(block: PromptBlock): AnalysisIssue[];
}
