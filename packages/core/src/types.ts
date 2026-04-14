export type PromptRole = 'system' | 'user' | 'assistant';

export type PromptBlock = {
  id: string;
  role: PromptRole;
  content: string;
  metadata?: Record<string, unknown>;
};

export type IssueSeverity = 'error' | 'warning' | 'info';

export type AnalysisIssue = {
  ruleId: string;
  severity: IssueSeverity;
  message: string;
  blockId?: string;
  position?: { start: number; end: number };
};

export type AnalysisReport = {
  blocks: PromptBlock[];
  issues: AnalysisIssue[];
  tokenCount: number;
  createdAt: Date;
};

export type ChangeType = 'replace' | 'remove' | 'reorder';

export type OptimizationChange = {
  type: ChangeType;
  blockId: string;
  before: string;
  after?: string;
  reason: string;
  tokenDelta: number;
};
