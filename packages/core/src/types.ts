export type PromptRole = 'system' | 'user' | 'assistant';

export type PromptBlock = {
  id: string;
  role: PromptRole;
  content: string;
  metadata?: Record<string, unknown>;
};

// --- Block analysis ---

export type BlockType =
  | 'instruction'
  | 'constraint'
  | 'example'
  | 'memory'
  | 'tool_output'
  | 'structured_data'
  | 'unknown';

export type AnalyzedBlock = {
  id: string;
  content: string;
  type: BlockType;
  tokenCount: number;
  /** Integer 0–100, rounded. */
  tokenPercent: number;
};

// --- Issues ---

export type IssueSeverity = 'error' | 'warning' | 'info';

export type AnalysisIssue = {
  ruleId: string;
  severity: IssueSeverity;
  message: string;
  blockId?: string;
  position?: { start: number; end: number };
  /** Optional human-readable fix hint shown in CLI output. */
  suggestion?: string;
  /** Arbitrary rule-specific data for programmatic consumers. */
  metadata?: Record<string, unknown>;
};

// --- Report ---

export type AnalysisReport = {
  path: string;
  blocks: AnalyzedBlock[];
  issues: AnalysisIssue[];
  totalBlocks: number;
  totalTokens: number;
  createdAt: Date;
};

// --- Optimization ---

export type ChangeType = 'replace' | 'remove' | 'reorder';

export type OptimizationChange = {
  type: ChangeType;
  blockId: string;
  before: string;
  after?: string;
  reason: string;
  tokenDelta: number;
};

// --- Tokenizer interface (implemented by @context-compiler/tokenizers) ---

export interface ITokenizer {
  count(text: string): number;
  encode(text: string): number[];
}
