import { relative } from 'node:path';

export type DirectoryFilters = {
  include: string[];
  exclude: string[];
};

export type ParsedArgsLike = {
  options: Map<string, string>;
};

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/**
 * Normalizes a path or pattern to use forward slashes and strips a trailing slash.
 */
function normalizeSlashes(s: string): string {
  return s.replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * Converts a glob pattern to an anchored RegExp.
 *
 * Supported syntax:
 *   **  — matches any sequence of characters including path separators
 *   *   — matches any sequence of characters within a single path segment (no /)
 *
 * All other regex-special characters are escaped.
 * Trailing `/` immediately after `**` is consumed so that `examples/**` correctly
 * matches files directly inside `examples/`.
 */
function globToRegex(pattern: string): RegExp {
  let i = 0;
  let result = '^';

  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      result += '.*';
      i += 2;
      // consume trailing slash after ** so `examples/**` → `^examples/.*$`
      if (pattern[i] === '/') i++;
    } else if (pattern[i] === '*') {
      result += '[^/]*';
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(pattern[i] as string)) {
      result += '\\' + pattern[i];
      i++;
    } else {
      result += pattern[i];
      i++;
    }
  }

  result += '$';
  return new RegExp(result);
}

/**
 * Returns true if the normalized relative path matches the pattern.
 *
 * Pattern semantics:
 *  - No wildcards (*): segment-prefix match.
 *    "examples"      matches "examples/foo.md", "examples/sub/bar.txt"
 *    "examples/a.md" matches exactly "examples/a.md"
 *  - Has wildcards (*): minimal glob converted to anchored regex.
 *    "examples/**"   matches any file inside examples/ at any depth
 *    "*.md"          matches .md files at the root of the directory only
 *    "**\/*.md"      matches .md files at any depth (including root)
 *
 * Matching is case-sensitive on all platforms.
 * Both `relativePath` and `pattern` must already be normalized (/ separators,
 * no trailing slash).
 */
function matchesPattern(relativePath: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return relativePath === pattern || relativePath.startsWith(pattern + '/');
  }
  return globToRegex(pattern).test(relativePath);
}

// ---------------------------------------------------------------------------
// Filter application
// ---------------------------------------------------------------------------

/**
 * Filters a list of absolute file paths against include/exclude patterns.
 *
 * - Both `paths` and user patterns are normalized to `/` separators before matching.
 * - Relative paths are computed from `rootPath`.
 * - If `include` is non-empty, a file must match at least one include pattern.
 * - If `exclude` is non-empty, a file is dropped if it matches any exclude pattern.
 * - `--exclude` wins: a file that matches both include and exclude is excluded.
 * - The order of surviving paths is preserved (deterministic from the caller).
 * - Throws if the result is empty.
 */
export function filterFiles(
  paths: string[],
  rootPath: string,
  filters: DirectoryFilters,
): string[] {
  const { include, exclude } = filters;
  const normalizedInclude = include.map(normalizeSlashes);
  const normalizedExclude = exclude.map(normalizeSlashes);

  const hasInclude = normalizedInclude.length > 0;
  const hasExclude = normalizedExclude.length > 0;

  if (!hasInclude && !hasExclude) return paths;

  const filtered = paths.filter(absPath => {
    const rel = normalizeSlashes(relative(rootPath, absPath));

    if (hasInclude && !normalizedInclude.some(p => matchesPattern(rel, p))) return false;
    if (hasExclude && normalizedExclude.some(p => matchesPattern(rel, p))) return false;
    return true;
  });

  if (filtered.length === 0) {
    const parts: string[] = [
      `No supported files matched filters in directory: ${rootPath}`,
    ];
    if (hasInclude) parts.push(`  include: [${normalizedInclude.join(', ')}]`);
    if (hasExclude) parts.push(`  exclude: [${normalizedExclude.join(', ')}]`);
    throw new Error(parts.join('\n'));
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

/**
 * Parses `--include` and `--exclude` from the CLI args map.
 * Follows the same validation pattern as parseOptimizeControls.
 */
export function parseDirectoryFilters(parsed: ParsedArgsLike): DirectoryFilters {
  return {
    include: parsed.options.has('include')
      ? parsePatternList('--include', parsed.options.get('include') ?? '')
      : [],
    exclude: parsed.options.has('exclude')
      ? parsePatternList('--exclude', parsed.options.get('exclude') ?? '')
      : [],
  };
}

function parsePatternList(flag: '--include' | '--exclude', value: string): string[] {
  if (value.trim() === '') {
    throw new Error(`${flag} requires at least one pattern`);
  }

  const patterns = value.split(',').map(p => normalizeSlashes(p.trim()));

  const emptyIndex = patterns.findIndex(p => p === '');
  if (emptyIndex !== -1) {
    throw new Error(`${flag} contains an empty pattern`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const p of patterns) {
    if (seen.has(p)) duplicates.add(p);
    seen.add(p);
  }

  if (duplicates.size > 0) {
    throw new Error(`${flag} contains duplicate pattern: ${[...duplicates].join(', ')}`);
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Helpers for output
// ---------------------------------------------------------------------------

/** Returns true when at least one filter is active. */
export function hasActiveFilters(filters: DirectoryFilters): boolean {
  return filters.include.length > 0 || filters.exclude.length > 0;
}
