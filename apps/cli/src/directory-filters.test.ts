import { describe, expect, it } from 'vitest';
import { filterFiles, parseDirectoryFilters, hasActiveFilters } from './directory-filters.js';

const ROOT = '/workspace/prompts';

function abs(...rel: string[]): string[] {
  return rel.map(r => `${ROOT}/${r}`);
}

describe('filterFiles', () => {
  it('returns all paths when no filters are active', () => {
    const paths = abs('a.md', 'examples/b.md', 'drafts/c.txt');
    expect(filterFiles(paths, ROOT, { include: [], exclude: [] })).toEqual(paths);
  });

  it('include: keeps only matching files', () => {
    const paths = abs('a.md', 'examples/b.md', 'drafts/c.txt');
    const result = filterFiles(paths, ROOT, { include: ['examples'], exclude: [] });
    expect(result).toEqual(abs('examples/b.md'));
  });

  it('exclude: removes matching files', () => {
    const paths = abs('a.md', 'examples/b.md', 'drafts/c.txt');
    const result = filterFiles(paths, ROOT, { include: [], exclude: ['examples'] });
    expect(result).toEqual(abs('a.md', 'drafts/c.txt'));
  });

  it('exclude wins when a file matches both include and exclude — excludes that file', () => {
    const paths = abs('a.md', 'examples/b.md', 'examples/c.md');
    // include=examples → only examples/* pass include; exclude=examples/b.md → b.md removed
    const result = filterFiles(paths, ROOT, {
      include: ['examples'],
      exclude: ['examples/b.md'],
    });
    expect(result).toEqual(abs('examples/c.md'));
  });

  it('exclude wins — throws when conflict leaves zero files', () => {
    const paths = abs('examples/b.md');
    expect(() =>
      filterFiles(paths, ROOT, { include: ['examples'], exclude: ['examples'] }),
    ).toThrow('No supported files matched filters');
  });

  it('throws with dir path when include leaves zero files', () => {
    const paths = abs('a.md', 'b.md');
    expect(() =>
      filterFiles(paths, ROOT, { include: ['nonexistent'], exclude: [] }),
    ).toThrow(`No supported files matched filters in directory: ${ROOT}`);
  });

  it('error message includes active include patterns', () => {
    const paths = abs('a.md');
    let msg = '';
    try {
      filterFiles(paths, ROOT, { include: ['prompts/**'], exclude: [] });
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('include: [prompts/**]');
    expect(msg).not.toContain('exclude:');
  });

  it('error message includes active exclude patterns', () => {
    const paths = abs('a.md');
    let msg = '';
    try {
      filterFiles(paths, ROOT, { include: [], exclude: ['*.md'] });
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toContain('exclude: [*.md]');
    expect(msg).not.toContain('include:');
  });

  it('preserves order after filtering', () => {
    const paths = abs('a.md', 'examples/b.md', 'examples/c.md', 'z.txt');
    const result = filterFiles(paths, ROOT, { include: ['examples'], exclude: [] });
    expect(result).toEqual(abs('examples/b.md', 'examples/c.md'));
  });

  // ---------------------------------------------------------------------------
  // Pattern semantics: no wildcards (prefix match)
  // ---------------------------------------------------------------------------

  it('no-wildcard: matches files directly inside a directory by name', () => {
    const paths = abs('examples/foo.md', 'examples/sub/bar.md', 'other/baz.md');
    expect(filterFiles(paths, ROOT, { include: ['examples'], exclude: [] })).toEqual(
      abs('examples/foo.md', 'examples/sub/bar.md'),
    );
  });

  it('no-wildcard: exact relative path matches that file only', () => {
    const paths = abs('examples/foo.md', 'examples/bar.md');
    expect(filterFiles(paths, ROOT, { include: ['examples/foo.md'], exclude: [] })).toEqual(
      abs('examples/foo.md'),
    );
  });

  it('no-wildcard: does not match a file whose path merely contains the pattern as a substring mid-segment', () => {
    const paths = abs('not-examples/foo.md');
    expect(() =>
      filterFiles(paths, ROOT, { include: ['examples'], exclude: [] }),
    ).toThrow('No supported files matched');
  });

  // ---------------------------------------------------------------------------
  // Pattern semantics: wildcards
  // ---------------------------------------------------------------------------

  it('*.md matches root-level .md files only', () => {
    const paths = abs('foo.md', 'examples/bar.md', 'a.txt');
    expect(filterFiles(paths, ROOT, { include: ['*.md'], exclude: [] })).toEqual(abs('foo.md'));
  });

  it('examples/** matches all files inside examples/ at any depth', () => {
    const paths = abs('a.md', 'examples/b.md', 'examples/sub/c.txt', 'other/d.md');
    expect(filterFiles(paths, ROOT, { include: ['examples/**'], exclude: [] })).toEqual(
      abs('examples/b.md', 'examples/sub/c.txt'),
    );
  });

  it('**/*.md matches .md files at any depth including root', () => {
    const paths = abs('foo.md', 'examples/bar.md', 'examples/sub/baz.md', 'data.json');
    expect(filterFiles(paths, ROOT, { include: ['**/*.md'], exclude: [] })).toEqual(
      abs('foo.md', 'examples/bar.md', 'examples/sub/baz.md'),
    );
  });

  it('**/*.md matches root-level files (** matches empty)', () => {
    const paths = abs('root.md');
    expect(filterFiles(paths, ROOT, { include: ['**/*.md'], exclude: [] })).toEqual(
      abs('root.md'),
    );
  });

  it('normalizes Windows-style backslashes in user-supplied patterns', () => {
    const paths = abs('examples/foo.md', 'other/bar.md');
    // simulate Windows path in pattern
    const result = filterFiles(paths, ROOT, { include: ['examples\\'], exclude: [] });
    expect(result).toEqual(abs('examples/foo.md'));
  });
});

// ---------------------------------------------------------------------------
// parseDirectoryFilters
// ---------------------------------------------------------------------------

describe('parseDirectoryFilters', () => {
  it('returns empty filters when no flags present', () => {
    const result = parseDirectoryFilters({ options: new Map() });
    expect(result).toEqual({ include: [], exclude: [] });
  });

  it('parses comma-separated include patterns', () => {
    const result = parseDirectoryFilters({
      options: new Map([['include', 'examples,drafts']]),
    });
    expect(result.include).toEqual(['examples', 'drafts']);
  });

  it('parses comma-separated exclude patterns', () => {
    const result = parseDirectoryFilters({
      options: new Map([['exclude', 'fixtures,generated']]),
    });
    expect(result.exclude).toEqual(['fixtures', 'generated']);
  });

  it('normalizes slashes in parsed patterns', () => {
    const result = parseDirectoryFilters({
      options: new Map([['include', 'examples\\sub']]),
    });
    expect(result.include).toEqual(['examples/sub']);
  });

  it('trims whitespace around patterns', () => {
    const result = parseDirectoryFilters({
      options: new Map([['include', ' a , b ']]),
    });
    expect(result.include).toEqual(['a', 'b']);
  });

  it('throws when --include value is empty', () => {
    expect(() =>
      parseDirectoryFilters({ options: new Map([['include', '']]) }),
    ).toThrow('--include requires at least one pattern');
  });

  it('throws when --exclude value is empty', () => {
    expect(() =>
      parseDirectoryFilters({ options: new Map([['exclude', '  ']]) }),
    ).toThrow('--exclude requires at least one pattern');
  });

  it('throws on empty element in comma list', () => {
    expect(() =>
      parseDirectoryFilters({ options: new Map([['include', 'a,,b']]) }),
    ).toThrow('--include contains an empty pattern');
  });

  it('throws on duplicate patterns in same flag', () => {
    expect(() =>
      parseDirectoryFilters({ options: new Map([['exclude', 'examples,examples']]) }),
    ).toThrow('--exclude contains duplicate pattern: examples');
  });
});

// ---------------------------------------------------------------------------
// hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
  it('returns false when both lists empty', () => {
    expect(hasActiveFilters({ include: [], exclude: [] })).toBe(false);
  });
  it('returns true when include non-empty', () => {
    expect(hasActiveFilters({ include: ['a'], exclude: [] })).toBe(true);
  });
  it('returns true when exclude non-empty', () => {
    expect(hasActiveFilters({ include: [], exclude: ['b'] })).toBe(true);
  });
});
