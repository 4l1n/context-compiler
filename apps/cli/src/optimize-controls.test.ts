import { describe, expect, it } from 'vitest';
import { KNOWN_TRANSFORM_IDS } from '@context-compiler/core';
import { parseOptimizeControls } from './optimize-controls.js';

function parsed(options: Record<string, string> = {}) {
  return {
    options: new Map(Object.entries(options)),
  };
}

describe('parseOptimizeControls', () => {
  it('returns default mode when no controls are provided', () => {
    expect(parseOptimizeControls(parsed(), KNOWN_TRANSFORM_IDS)).toEqual({ mode: 'default' });
  });

  it('parses --only transform ids', () => {
    expect(
      parseOptimizeControls(
        parsed({ only: 'remove-exact-duplicates,collapse-formatting-rules' }),
        KNOWN_TRANSFORM_IDS,
      ),
    ).toEqual({
      mode: 'only',
      requestedIds: ['remove-exact-duplicates', 'collapse-formatting-rules'],
    });
  });

  it('parses --except transform ids', () => {
    expect(
      parseOptimizeControls(parsed({ except: 'truncate-tool-output' }), KNOWN_TRANSFORM_IDS),
    ).toEqual({
      mode: 'except',
      requestedIds: ['truncate-tool-output'],
    });
  });

  it('trims whitespace around ids', () => {
    expect(
      parseOptimizeControls(
        parsed({ only: ' remove-exact-duplicates , collapse-formatting-rules ' }),
        KNOWN_TRANSFORM_IDS,
      ),
    ).toEqual({
      mode: 'only',
      requestedIds: ['remove-exact-duplicates', 'collapse-formatting-rules'],
    });
  });

  it('rejects both controls together', () => {
    expect(() =>
      parseOptimizeControls(
        parsed({ only: 'remove-exact-duplicates', except: 'truncate-tool-output' }),
        KNOWN_TRANSFORM_IDS,
      ),
    ).toThrow('optimize accepts either --only or --except, not both');
  });

  it('rejects empty values', () => {
    expect(() => parseOptimizeControls(parsed({ only: '' }), KNOWN_TRANSFORM_IDS)).toThrow(
      '--only requires at least one transform id',
    );
  });

  it('rejects empty entries', () => {
    expect(() =>
      parseOptimizeControls(parsed({ only: 'remove-exact-duplicates,' }), KNOWN_TRANSFORM_IDS),
    ).toThrow('--only contains an empty transform id');
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      parseOptimizeControls(
        parsed({ only: 'remove-exact-duplicates,remove-exact-duplicates' }),
        KNOWN_TRANSFORM_IDS,
      ),
    ).toThrow('--only contains duplicate transform id: remove-exact-duplicates');
  });

  it('rejects unknown ids', () => {
    expect(() =>
      parseOptimizeControls(parsed({ except: 'unknown-transform' }), KNOWN_TRANSFORM_IDS),
    ).toThrow('--except contains unknown transform id: unknown-transform');
  });
});
