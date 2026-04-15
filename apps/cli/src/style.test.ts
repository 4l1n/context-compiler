import { describe, expect, it } from 'vitest';
import { containsAnsi, createStyler, shouldUseColor } from './style.js';

describe('shouldUseColor', () => {
  it('returns false when stdout is not a TTY', () => {
    expect(shouldUseColor({ isTTY: false, env: {} })).toBe(false);
  });

  it('returns false when NO_COLOR is set', () => {
    expect(shouldUseColor({ isTTY: true, env: { NO_COLOR: '1' } })).toBe(false);
  });

  it('returns false when CLICOLOR=0', () => {
    expect(shouldUseColor({ isTTY: true, env: { CLICOLOR: '0' } })).toBe(false);
  });

  it('returns true for interactive terminals without color opt-out', () => {
    expect(shouldUseColor({ isTTY: true, env: {} })).toBe(true);
  });
});

describe('createStyler', () => {
  it('does not add ANSI escapes when color is disabled', () => {
    const s = createStyler({ useColor: false });
    expect(s.heading('x')).toBe('x');
    expect(containsAnsi(s.heading('x'))).toBe(false);
  });

  it('adds ANSI escapes when color is enabled', () => {
    const s = createStyler({ useColor: true });
    expect(containsAnsi(s.heading('x'))).toBe(true);
  });
});
