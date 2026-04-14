import { describe, it, expect } from 'vitest';
import { runLint } from './runner.js';
import type { IRule, LintContext } from './types.js';
import type { AnalyzedBlock } from '@context-compiler/core';

function makeCtx(blocks: AnalyzedBlock[] = []): LintContext {
  return { path: 'test.md', blocks, totalTokens: 100 };
}

const emitOneIssue: IRule = {
  id: 'test-rule',
  description: 'always emits one issue',
  check: () => [{ ruleId: 'test-rule', severity: 'info', message: 'test' }],
};

const emitNothing: IRule = {
  id: 'silent-rule',
  description: 'never emits',
  check: () => [],
};

describe('runLint', () => {
  it('returns empty issues and empty rulesRun for no rules', () => {
    const result = runLint([], makeCtx());
    expect(result.issues).toHaveLength(0);
    expect(result.rulesRun).toHaveLength(0);
  });

  it('collects issues from all rules', () => {
    const result = runLint([emitOneIssue, emitOneIssue], makeCtx());
    expect(result.issues).toHaveLength(2);
  });

  it('records which rules ran', () => {
    const result = runLint([emitOneIssue, emitNothing], makeCtx());
    expect(result.rulesRun).toEqual(['test-rule', 'silent-rule']);
  });

  it('runs all rules even when earlier ones emit issues', () => {
    const results: string[] = [];
    const ruleA: IRule = {
      id: 'a',
      description: '',
      check: () => { results.push('a'); return [{ ruleId: 'a', severity: 'error', message: '' }]; },
    };
    const ruleB: IRule = {
      id: 'b',
      description: '',
      check: () => { results.push('b'); return []; },
    };
    runLint([ruleA, ruleB], makeCtx());
    expect(results).toEqual(['a', 'b']);
  });
});
