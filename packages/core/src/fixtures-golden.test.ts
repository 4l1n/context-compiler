import { describe, expect, it } from 'vitest';
import { promptFixtures } from '@context-compiler/fixtures';
import { buildReport } from './analyzer.js';
import { runOptimize } from './optimizer.js';
import { buildTransforms } from './transforms/index.js';
import type { AnalysisReport, ITokenizer, OptimizationResult } from './types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

type AnalysisSummary = {
  totalBlocks: number;
  totalTokens: number;
  blockTypes: string[];
  issueIds: string[];
};

type OptimizeSummary = {
  optimizedTokens: number;
  tokenSavings: number;
  changes: Array<{
    type: string;
    transformId: string;
    blockIds: string[];
    primaryBlockId?: string;
    tokenDelta: number;
  }>;
};

const expectedAnalysis: Record<string, AnalysisSummary> = {
  'long-prompt-with-duplicates': {
    totalBlocks: 4,
    totalTokens: 72,
    blockTypes: ['instruction', 'constraint', 'instruction', 'constraint'],
    issueIds: [],
  },
  'large-tool-output': {
    totalBlocks: 2,
    totalTokens: 417,
    blockTypes: ['unknown', 'tool_output'],
    issueIds: ['tool-output-too-large', 'too-many-unknown-blocks'],
  },
  'structured-json-context': {
    totalBlocks: 1,
    totalTokens: 48,
    blockTypes: ['structured_data'],
    issueIds: [],
  },
  'oversized-examples': {
    totalBlocks: 2,
    totalTokens: 117,
    blockTypes: ['instruction', 'example'],
    issueIds: [],
  },
  'persistent-memory': {
    totalBlocks: 2,
    totalTokens: 58,
    blockTypes: ['memory', 'instruction'],
    issueIds: [],
  },
  'optimize-no-op': {
    totalBlocks: 3,
    totalTokens: 37,
    blockTypes: ['instruction', 'constraint', 'instruction'],
    issueIds: [],
  },
  'hardening-kitchen-sink': {
    totalBlocks: 8,
    totalTokens: 447,
    blockTypes: [
      'instruction',
      'constraint',
      'instruction',
      'constraint',
      'memory',
      'unknown',
      'tool_output',
      'example',
    ],
    issueIds: [],
  },
  'structured-noop-context': {
    totalBlocks: 2,
    totalTokens: 73,
    blockTypes: ['structured_data', 'structured_data'],
    issueIds: [],
  },
};

const expectedOptimize: Record<string, OptimizeSummary> = {
  'long-prompt-with-duplicates': {
    optimizedTokens: 53,
    tokenSavings: 19,
    changes: [
      {
        type: 'remove',
        transformId: 'remove-exact-duplicates',
        blockIds: ['block-2', 'block-4'],
        primaryBlockId: 'block-4',
        tokenDelta: -17,
      },
      {
        type: 'replace',
        transformId: 'collapse-formatting-rules',
        blockIds: ['block-2'],
        tokenDelta: -2,
      },
    ],
  },
  'large-tool-output': {
    optimizedTokens: 212,
    tokenSavings: 205,
    changes: [
      {
        type: 'replace',
        transformId: 'truncate-tool-output',
        blockIds: ['block-2'],
        tokenDelta: -205,
      },
    ],
  },
  'structured-json-context': {
    optimizedTokens: 48,
    tokenSavings: 0,
    changes: [],
  },
  'oversized-examples': {
    optimizedTokens: 51,
    tokenSavings: 66,
    changes: [
      {
        type: 'replace',
        transformId: 'trim-oversized-examples',
        blockIds: ['block-2'],
        tokenDelta: -66,
      },
    ],
  },
  'persistent-memory': {
    optimizedTokens: 58,
    tokenSavings: 0,
    changes: [],
  },
  'optimize-no-op': {
    optimizedTokens: 37,
    tokenSavings: 0,
    changes: [],
  },
  'hardening-kitchen-sink': {
    optimizedTokens: 424,
    tokenSavings: 23,
    changes: [
      {
        type: 'remove',
        transformId: 'remove-exact-duplicates',
        blockIds: ['block-2', 'block-4'],
        primaryBlockId: 'block-4',
        tokenDelta: -19,
      },
      {
        type: 'replace',
        transformId: 'collapse-formatting-rules',
        blockIds: ['block-2'],
        tokenDelta: -4,
      },
    ],
  },
  'structured-noop-context': {
    optimizedTokens: 73,
    tokenSavings: 0,
    changes: [],
  },
};

describe('fixture golden summaries', () => {
  it.each(promptFixtures)('analyzes $id with stable summary output', fixture => {
    const report = makeReport(fixture.id, fixture.content);
    expect(summarizeAnalysis(report)).toEqual(expectedAnalysis[fixture.id]);
  });

  it.each(promptFixtures)('optimizes $id with stable change metadata', fixture => {
    const report = makeReport(fixture.id, fixture.content);
    const result = runOptimize(fixturePath(fixture.id), fixture.content, report, buildTransforms(), tok);
    expect(summarizeOptimize(result)).toEqual(expectedOptimize[fixture.id]);
    expect(result.appliedChanges.length > 0).toBe(fixture.expectsOptimizeChanges);
  });
});

function makeReport(id: string, content: string): AnalysisReport {
  return buildReport(fixturePath(id), content, '.md', tok);
}

function fixturePath(id: string): string {
  return `/fixtures/${id}.md`;
}

function summarizeAnalysis(report: AnalysisReport): AnalysisSummary {
  return {
    totalBlocks: report.totalBlocks,
    totalTokens: report.totalTokens,
    blockTypes: report.blocks.map(block => block.type),
    issueIds: report.issues.map(issue => issue.ruleId),
  };
}

function summarizeOptimize(result: OptimizationResult): OptimizeSummary {
  return {
    optimizedTokens: result.optimizedTokens,
    tokenSavings: result.tokenSavings,
    changes: result.appliedChanges.map(change => ({
      type: change.type,
      transformId: change.transformId,
      blockIds: change.blockIds,
      primaryBlockId: change.primaryBlockId,
      tokenDelta: change.tokenDelta,
    })),
  };
}
