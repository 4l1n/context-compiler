import { describe, expect, it } from 'vitest';
import {
  CheckFailureError,
  assertLintPass,
  assertOptimizeNoChanges,
  assertWithinBudget,
  countAtOrAbove,
  parseFailOnSeverity,
  parseMaxTokens,
} from './check.js';
import type { IssueSeverityCounts } from './batch.js';

// ---------------------------------------------------------------------------
// parseFailOnSeverity
// ---------------------------------------------------------------------------

describe('parseFailOnSeverity', () => {
  it('accepts error', () => expect(parseFailOnSeverity('error')).toBe('error'));
  it('accepts warning', () => expect(parseFailOnSeverity('warning')).toBe('warning'));
  it('accepts info', () => expect(parseFailOnSeverity('info')).toBe('info'));

  it('throws on unknown value', () => {
    expect(() => parseFailOnSeverity('critical')).toThrow("--fail-on must be 'error', 'warning', or 'info'");
  });

  it('throws on empty string', () => {
    expect(() => parseFailOnSeverity('')).toThrow("--fail-on must be 'error', 'warning', or 'info'");
  });
});

// ---------------------------------------------------------------------------
// parseMaxTokens
// ---------------------------------------------------------------------------

describe('parseMaxTokens', () => {
  it('accepts positive integer', () => expect(parseMaxTokens('500')).toBe(500));
  it('accepts 1', () => expect(parseMaxTokens('1')).toBe(1));

  it('throws on zero', () => {
    expect(() => parseMaxTokens('0')).toThrow('--max-tokens must be a positive integer');
  });

  it('throws on negative', () => {
    expect(() => parseMaxTokens('-10')).toThrow('--max-tokens must be a positive integer');
  });

  it('throws on float', () => {
    expect(() => parseMaxTokens('3.5')).toThrow('--max-tokens must be a positive integer');
  });

  it('throws on non-numeric string', () => {
    expect(() => parseMaxTokens('abc')).toThrow('--max-tokens must be a positive integer');
  });

  it('throws on empty string', () => {
    expect(() => parseMaxTokens('')).toThrow('--max-tokens must be a positive integer');
  });
});

// ---------------------------------------------------------------------------
// countAtOrAbove
// ---------------------------------------------------------------------------

describe('countAtOrAbove', () => {
  const counts: IssueSeverityCounts = { error: 2, warning: 3, info: 5 };

  it("threshold 'error': counts only errors", () => {
    expect(countAtOrAbove(counts, 'error')).toBe(2);
  });

  it("threshold 'warning': counts errors + warnings", () => {
    expect(countAtOrAbove(counts, 'warning')).toBe(5);
  });

  it("threshold 'info': counts all issues", () => {
    expect(countAtOrAbove(counts, 'info')).toBe(10);
  });

  it('returns 0 when all counts are zero', () => {
    const empty: IssueSeverityCounts = { error: 0, warning: 0, info: 0 };
    expect(countAtOrAbove(empty, 'error')).toBe(0);
    expect(countAtOrAbove(empty, 'warning')).toBe(0);
    expect(countAtOrAbove(empty, 'info')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// assertLintPass
// ---------------------------------------------------------------------------

describe('assertLintPass', () => {
  const clean: IssueSeverityCounts = { error: 0, warning: 0, info: 0 };
  const withWarning: IssueSeverityCounts = { error: 0, warning: 1, info: 0 };
  const withError: IssueSeverityCounts = { error: 1, warning: 0, info: 0 };
  const withInfo: IssueSeverityCounts = { error: 0, warning: 0, info: 1 };

  it('does not throw when no issues exist', () => {
    expect(() => assertLintPass(clean, 'error', 'file.md')).not.toThrow();
  });

  it("does not throw when only warnings exist and threshold is 'error'", () => {
    expect(() => assertLintPass(withWarning, 'error', 'file.md')).not.toThrow();
  });

  it("throws CheckFailureError when errors exist and threshold is 'error'", () => {
    expect(() => assertLintPass(withError, 'error', 'file.md')).toThrowError(CheckFailureError);
  });

  it("throws when errors exist and threshold is 'warning'", () => {
    expect(() => assertLintPass(withError, 'warning', 'file.md')).toThrowError(CheckFailureError);
  });

  it("throws when warnings exist and threshold is 'warning'", () => {
    expect(() => assertLintPass(withWarning, 'warning', 'file.md')).toThrowError(CheckFailureError);
  });

  it("does not throw when only info exists and threshold is 'warning'", () => {
    expect(() => assertLintPass(withInfo, 'warning', 'file.md')).not.toThrow();
  });

  it("throws when info exists and threshold is 'info'", () => {
    expect(() => assertLintPass(withInfo, 'info', 'file.md')).toThrowError(CheckFailureError);
  });

  it('includes threshold and context in error message', () => {
    let msg = '';
    try {
      assertLintPass(withError, 'error', 'examples/a.md');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('--fail-on error');
    expect(msg).toContain('examples/a.md');
  });
});

// ---------------------------------------------------------------------------
// assertOptimizeNoChanges
// ---------------------------------------------------------------------------

describe('assertOptimizeNoChanges', () => {
  it('does not throw when no changes', () => {
    expect(() => assertOptimizeNoChanges(0, 'file.md')).not.toThrow();
    expect(() => assertOptimizeNoChanges(0, '<text>', 'content')).not.toThrow();
  });

  it("throws CheckFailureError with 'file(s) would change' for file kind", () => {
    let msg = '';
    try {
      assertOptimizeNoChanges(2, 'examples/');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('file(s) would change');
    expect(msg).toContain('examples/');
  });

  it("throws CheckFailureError with 'content would change' for content kind", () => {
    let msg = '';
    try {
      assertOptimizeNoChanges(1, '<text>', 'content');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('content would change');
  });

  it('throws CheckFailureError (not a plain Error)', () => {
    expect(() => assertOptimizeNoChanges(1, 'file.md')).toThrowError(CheckFailureError);
  });
});

// ---------------------------------------------------------------------------
// assertWithinBudget
// ---------------------------------------------------------------------------

describe('assertWithinBudget', () => {
  it('does not throw when all files within budget', () => {
    const files = [
      { path: 'a.md', totalTokens: 100 },
      { path: 'b.md', totalTokens: 50 },
    ];
    expect(() => assertWithinBudget(files, 200, 'dir/')).not.toThrow();
  });

  it('does not throw when a file exactly equals the budget', () => {
    expect(() =>
      assertWithinBudget([{ path: 'a.md', totalTokens: 100 }], 100, 'dir/'),
    ).not.toThrow();
  });

  it('throws CheckFailureError when a single file exceeds budget', () => {
    expect(() =>
      assertWithinBudget([{ path: 'a.md', totalTokens: 500 }], 100, 'dir/'),
    ).toThrowError(CheckFailureError);
  });

  it('includes offending file path and token count in the message', () => {
    let msg = '';
    try {
      assertWithinBudget([{ path: 'a.md', totalTokens: 500 }], 100, 'examples/');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('a.md (500 tokens)');
    expect(msg).toContain('max: 100');
    expect(msg).toContain('examples/');
  });

  it('lists up to 3 files explicitly', () => {
    const files = [
      { path: 'a.md', totalTokens: 200 },
      { path: 'b.md', totalTokens: 300 },
      { path: 'c.md', totalTokens: 400 },
    ];
    let msg = '';
    try {
      assertWithinBudget(files, 100, 'dir/');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('a.md');
    expect(msg).toContain('b.md');
    expect(msg).toContain('c.md');
    expect(msg).not.toContain('and');
  });

  it('summarizes beyond 3 files compactly', () => {
    const files = [
      { path: 'a.md', totalTokens: 200 },
      { path: 'b.md', totalTokens: 300 },
      { path: 'c.md', totalTokens: 400 },
      { path: 'd.md', totalTokens: 500 },
      { path: 'e.md', totalTokens: 600 },
    ];
    let msg = '';
    try {
      assertWithinBudget(files, 100, 'dir/');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('a.md');
    expect(msg).toContain('b.md');
    expect(msg).toContain('c.md');
    expect(msg).toContain('and 2 more');
    expect(msg).not.toContain('d.md');
    expect(msg).not.toContain('e.md');
  });

  it('only lists files that exceed the budget (not those within it)', () => {
    const files = [
      { path: 'ok.md', totalTokens: 50 },
      { path: 'bad.md', totalTokens: 500 },
    ];
    let msg = '';
    try {
      assertWithinBudget(files, 100, 'dir/');
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('bad.md');
    expect(msg).not.toContain('ok.md');
  });
});
