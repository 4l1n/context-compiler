import { describe, it, expect } from 'vitest';
import { buildRules, KNOWN_RULE_IDS, runLint } from './index.js';
import type { LintContext } from './types.js';
import type { AnalyzedBlock } from '@context-compiler/core';

function toolOutputBlock(id: string, tokenCount: number): AnalyzedBlock {
  return {
    id,
    content: 'x'.repeat(tokenCount * 4),
    type: 'tool_output',
    tokenCount,
    tokenPercent: 100,
  };
}

function exampleBlock(id: string, tokenCount: number): AnalyzedBlock {
  return {
    id,
    content: `Example ${id}`,
    type: 'example',
    tokenCount,
    tokenPercent: 50,
  };
}

function context(blocks: AnalyzedBlock[], totalTokens: number): LintContext {
  return {
    path: '/tmp/sample.md',
    blocks,
    totalTokens,
  };
}

describe('buildRules', () => {
  it('returns default rule order when no filters are provided', () => {
    const rules = buildRules();
    expect(rules.map(r => r.id)).toEqual(KNOWN_RULE_IDS);
    expect(rules.map(r => r.id)).toEqual([
      'duplicated-instruction',
      'repeated-formatting-rules',
      'oversized-example-section',
      'noisy-tool-output',
    ]);
  });

  it('supports enabled rule id filters', () => {
    const rules = buildRules({ enabledRuleIds: ['noisy-tool-output'] });
    expect(rules.map(r => r.id)).toEqual(['noisy-tool-output']);
  });

  it('supports disabled rule id filters', () => {
    const rules = buildRules({
      disabledRuleIds: ['duplicated-instruction', 'repeated-formatting-rules'],
    });
    expect(rules.map(r => r.id)).toEqual([
      'oversized-example-section',
      'noisy-tool-output',
    ]);
  });

  it('uses custom noisy-tool-output threshold', () => {
    const rules = buildRules({
      enabledRuleIds: ['noisy-tool-output'],
      thresholds: { noisyToolOutputTokens: 500 },
    });
    const result = runLint(
      rules,
      context([toolOutputBlock('b1', 450)], 450),
    );
    expect(result.issues).toHaveLength(0);
  });

  it('uses custom oversized-example-section threshold', () => {
    const rules = buildRules({
      enabledRuleIds: ['oversized-example-section'],
      thresholds: { oversizedExampleRatio: 0.9 },
    });
    const blocks = [exampleBlock('b1', 80), exampleBlock('b2', 10)];
    const result = runLint(rules, context(blocks, 100));
    expect(result.issues).toHaveLength(0);
  });

  it('throws on unknown enabled rule ids', () => {
    expect(() =>
      buildRules({
        enabledRuleIds: ['missing-rule'],
      }),
    ).toThrow('Unknown lint rule id in enabledRuleIds: missing-rule');
  });

  it('throws on unknown disabled rule ids', () => {
    expect(() =>
      buildRules({
        disabledRuleIds: ['missing-rule'],
      }),
    ).toThrow('Unknown lint rule id in disabledRuleIds: missing-rule');
  });
});
