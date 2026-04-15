export type ParsedOptimizeArgsLike = {
  options: Map<string, string>;
};

export type OptimizeControlMode = 'default' | 'only' | 'except';

export type OptimizeControls = {
  mode: OptimizeControlMode;
  requestedIds?: string[];
};

export function parseOptimizeControls(
  parsed: ParsedOptimizeArgsLike,
  knownTransformIds: readonly string[],
): OptimizeControls {
  const hasOnly = parsed.options.has('only');
  const hasExcept = parsed.options.has('except');

  if (hasOnly && hasExcept) {
    throw new Error('optimize accepts either --only or --except, not both');
  }

  if (hasOnly) {
    return {
      mode: 'only',
      requestedIds: parseTransformIdList('--only', parsed.options.get('only') ?? '', knownTransformIds),
    };
  }

  if (hasExcept) {
    return {
      mode: 'except',
      requestedIds: parseTransformIdList('--except', parsed.options.get('except') ?? '', knownTransformIds),
    };
  }

  return { mode: 'default' };
}

function parseTransformIdList(
  flag: '--only' | '--except',
  value: string,
  knownTransformIds: readonly string[],
): string[] {
  if (value.trim() === '') {
    throw new Error(`${flag} requires at least one transform id`);
  }

  const ids = value.split(',').map(id => id.trim());
  const emptyIndex = ids.findIndex(id => id === '');
  if (emptyIndex !== -1) {
    throw new Error(`${flag} contains an empty transform id`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  if (duplicates.size > 0) {
    throw new Error(`${flag} contains duplicate transform id: ${[...duplicates].join(', ')}`);
  }

  const known = new Set(knownTransformIds);
  const unknown = ids.filter(id => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`${flag} contains unknown transform id: ${unknown.join(', ')}`);
  }

  return ids;
}
