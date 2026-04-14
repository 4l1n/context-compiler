#!/usr/bin/env node

import { performance } from 'node:perf_hooks';
import { promptFixtures } from '../packages/fixtures/dist/index.js';
import { buildReport, buildTransforms, runOptimize } from '../packages/core/dist/index.js';
import { buildRules, runLint } from '../packages/rules/dist/index.js';
import { CharTokenizer } from '../packages/tokenizers/dist/index.js';

const DEFAULT_ITERATIONS = 25;
const iterations = parseIterations(process.env.BENCH_ITERATIONS);
const tokenizer = new CharTokenizer(4);
const transforms = buildTransforms();
const rules = buildRules();

const start = performance.now();
let operations = 0;
let totalTokens = 0;
let totalOptimizedSavings = 0;
let totalChanges = 0;

for (let i = 0; i < iterations; i++) {
  for (const fixture of promptFixtures) {
    const path = `/fixtures/${fixture.id}.md`;
    const report = buildReport(path, fixture.content, '.md', tokenizer);
    operations++;

    runLint(rules, {
      path: report.path,
      blocks: report.blocks,
      totalTokens: report.totalTokens,
    });
    operations++;

    const result = runOptimize(path, fixture.content, report, transforms, tokenizer);
    operations++;

    totalTokens += report.totalTokens;
    totalOptimizedSavings += result.tokenSavings;
    totalChanges += result.appliedChanges.length;
  }
}

const elapsedMs = performance.now() - start;
const averageMs = operations > 0 ? elapsedMs / operations : 0;

console.log('context-compiler benchmark');
console.log(`fixtures: ${promptFixtures.length}`);
console.log(`iterations: ${iterations}`);
console.log(`operations: ${operations}`);
console.log(`averageMsPerOperation: ${averageMs.toFixed(3)}`);
console.log(`totalTokens: ${totalTokens}`);
console.log(`totalOptimizedSavings: ${totalOptimizedSavings}`);
console.log(`totalChanges: ${totalChanges}`);

function parseIterations(value) {
  if (value === undefined) return DEFAULT_ITERATIONS;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('BENCH_ITERATIONS must be a positive integer');
  }
  return parsed;
}
