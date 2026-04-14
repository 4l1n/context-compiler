import { describe, it, expect } from 'vitest';
import { repeatedFormattingRules } from './repeated-formatting-rules.js';
import type { LintContext } from '../types.js';
import type { AnalyzedBlock, BlockType } from '@context-compiler/core';

function block(id: string, content: string, type: BlockType = 'instruction'): AnalyzedBlock {
  return { id, content, type, tokenCount: 20, tokenPercent: 10 };
}

function ctx(blocks: AnalyzedBlock[]): LintContext {
  return { path: 'test.md', blocks, totalTokens: 100 };
}

describe('repeatedFormattingRules — detects repetition', () => {
  it('flags "be concise" repeated across two blocks', () => {
    const blocks = [
      block('b1', 'Be concise in your responses.'),
      block('b2', 'Always be concise and to the point.'),
    ];
    const issues = repeatedFormattingRules.check(ctx(blocks));
    const issue = issues.find(i => i.message.includes('concise'));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('b1');
    expect(issue?.message).toContain('b2');
  });

  it('flags "use bullet points" repeated across blocks', () => {
    const blocks = [
      block('b1', 'Use bullet points to list items.'),
      block('b2', 'Format your response with bullet points.'),
    ];
    const issues = repeatedFormattingRules.check(ctx(blocks));
    expect(issues.find(i => i.message.includes('bullet'))).toBeDefined();
  });

  it('flags "avoid jargon" repeated', () => {
    const blocks = [
      block('b1', 'Avoid jargon and technical terms.'),
      block('b2', 'Use plain language, avoid jargon.'),
    ];
    const issues = repeatedFormattingRules.check(ctx(blocks));
    expect(issues.find(i => i.message.includes('jargon'))).toBeDefined();
  });

  it('flags "use markdown" repeated', () => {
    const blocks = [
      block('b1', 'Use markdown for formatting.'),
      block('b2', 'Format using markdown where appropriate.'),
    ];
    const issues = repeatedFormattingRules.check(ctx(blocks));
    expect(issues.find(i => i.message.includes('markdown'))).toBeDefined();
  });
});

describe('repeatedFormattingRules — no issues', () => {
  it('no issue when directive appears only once', () => {
    const blocks = [
      block('b1', 'Be concise in your responses.'),
      block('b2', 'You are an expert developer.'),
    ];
    expect(repeatedFormattingRules.check(ctx(blocks))).toHaveLength(0);
  });

  it('no issue for different directives in different blocks', () => {
    const blocks = [
      block('b1', 'Be concise.'),
      block('b2', 'Avoid jargon.'),
    ];
    expect(repeatedFormattingRules.check(ctx(blocks))).toHaveLength(0);
  });

  it('no issue for empty blocks', () => {
    expect(repeatedFormattingRules.check(ctx([]))).toHaveLength(0);
  });
});

describe('repeatedFormattingRules — multiple patterns', () => {
  it('emits one issue per repeated pattern (not per block)', () => {
    const blocks = [
      block('b1', 'Be concise and use bullet points.'),
      block('b2', 'Be concise. Use bullet points.'),
    ];
    const issues = repeatedFormattingRules.check(ctx(blocks));
    // Both "concise" and "bullet points" are repeated → 2 issues
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
