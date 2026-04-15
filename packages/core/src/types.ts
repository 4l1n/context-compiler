export type PromptRole = 'system' | 'user' | 'assistant';

export type PromptBlock = {
  id: string;
  role: PromptRole;
  content: string;
  metadata?: Record<string, unknown>;
};

// --- Block analysis ---

export type BlockMetadata = {
  protected?: boolean;
} & Record<string, unknown>;

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
  metadata?: BlockMetadata;
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

export type TokenizerMetadata = {
  id: string;
};

// --- Report ---

export type AnalysisReport = {
  path: string;
  tokenizer?: TokenizerMetadata;
  blocks: AnalyzedBlock[];
  issues: AnalysisIssue[];
  totalBlocks: number;
  totalTokens: number;
  createdAt: Date;
};

// --- Optimization ---

export type ChangeType = 'replace' | 'remove';

export type OptimizationChange = {
  type: ChangeType;
  transformId: string;
  /** All blocks involved in this change (may be >1 for cross-block transforms). */
  blockIds: string[];
  /** The block whose before/after content is shown (first affected block if multiple). */
  primaryBlockId?: string;
  before: string;
  after?: string;     // undefined when type === 'remove'
  reason: string;
  tokenDelta: number; // negative = savings; not guaranteed to be negative
};

export type OptimizeTransformSelection = {
  mode: 'default' | 'only' | 'except';
  activeTransformIds: string[];
  requestedIds?: string[];
};

export type OptimizationResult = {
  path: string;
  tokenizer?: TokenizerMetadata;
  transformSelection?: OptimizeTransformSelection;
  originalContent: string;
  optimizedContent: string;
  originalTokens: number;
  optimizedTokens: number;
  /** originalTokens − optimizedTokens. Can be negative. */
  tokenSavings: number;
  appliedChanges: OptimizationChange[];
};

// --- Tokenizer interface (implemented by @context-compiler/tokenizers) ---

export interface ITokenizer {
  count(text: string): number;
  encode(text: string): number[];
}
