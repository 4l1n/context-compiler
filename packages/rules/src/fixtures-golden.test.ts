import { describe, expect, it } from 'vitest';
import { promptFixtures } from '@context-compiler/fixtures';
import { buildReport } from '@context-compiler/core';
import { buildRules, KNOWN_RULE_IDS, runLint } from './index.js';
import type { ITokenizer } from '@context-compiler/core';
import type { LintResult } from './types.js';

const tok: ITokenizer = {
  count: (t: string) => t.trim().split(/\s+/).filter(Boolean).length,
  encode: (t: string) => t.trim().split(/\s+/).map((_, i) => i),
};

type LintSummary = {
  issueIds: string[];
  issueBlockIds: Array<string | null>;
};

const expectedLint: Record<string, LintSummary> = {
  'long-prompt-with-duplicates': {
    issueIds: ['duplicated-instruction', 'repeated-formatting-rules'],
    issueBlockIds: ['block-4', null],
  },
  'large-tool-output': {
    issueIds: ['noisy-tool-output'],
    issueBlockIds: ['block-2'],
  },
  'structured-json-context': {
    issueIds: [],
    issueBlockIds: [],
  },
  'oversized-examples': {
    issueIds: ['oversized-example-section'],
    issueBlockIds: [null],
  },
  'persistent-memory': {
    issueIds: [],
    issueBlockIds: [],
  },
  'optimize-no-op': {
    issueIds: [],
    issueBlockIds: [],
  },
  'hardening-kitchen-sink': {
    issueIds: [
      'duplicated-instruction',
      'repeated-formatting-rules',
      'repeated-formatting-rules',
    ],
    issueBlockIds: ['block-4', null, null],
  },
  'structured-noop-context': {
    issueIds: [],
    issueBlockIds: [],
  },
};

describe('fixture lint golden summaries', () => {
  it.each(promptFixtures)('lints $id with stable issue summary', fixture => {
    const report = buildReport(`/fixtures/${fixture.id}.md`, fixture.content, '.md', tok);
    const result = runLint(buildRules(), {
      path: report.path,
      blocks: report.blocks,
      totalTokens: report.totalTokens,
    });

    expect(result.rulesRun).toEqual(KNOWN_RULE_IDS);
    expect(summarizeLint(result)).toEqual(expectedLint[fixture.id]);
  });
});

function summarizeLint(result: LintResult): LintSummary {
  return {
    issueIds: result.issues.map(issue => issue.ruleId),
    issueBlockIds: result.issues.map(issue => issue.blockId ?? null),
  };
}
