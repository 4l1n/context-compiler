export type PromptFixture = {
  id: string;
  description: string;
  content: string;
  /**
   * True when optimize v1 is expected to produce at least one safe change.
   * This is metadata for tests/manual checks, not an assertion engine.
   */
  expectsOptimizeChanges: boolean;
};

export const fixtureLongPromptWithDuplicates: PromptFixture = {
  id: 'long-prompt-with-duplicates',
  description: 'Long prompt with repeated instruction/constraint blocks.',
  expectsOptimizeChanges: true,
  content: `
# System
You are an assistant for local developer tooling.
Be concise.
Use markdown.

# Constraints
Do not invent behavior that is not in the repository.
Prefer deterministic output.
Be concise.

# Context
This project compiles prompt context for local-first workflows.
No remote APIs are allowed in this phase.
Keep implementation changes safe and explainable.

# Constraints
Do not invent behavior that is not in the repository.
Prefer deterministic output.
Be concise.
`.trim(),
};

export const fixtureLargeToolOutput: PromptFixture = {
  id: 'large-tool-output',
  description: 'Large tool output with important warning/error lines in the middle.',
  expectsOptimizeChanges: true,
  content: `
# Investigation
Use this command output to identify the root cause.

\`\`\`bash
line 001 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 002 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 003 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 004 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 005 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 006 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 007 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 008 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 009 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 010 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 011 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 012 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
warning: cache miss for package core
line 014 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 015 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 016 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 017 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 018 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 019 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 020 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 021 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 022 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 023 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 024 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
error: failed to compile package cli
line 026 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 027 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 028 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 029 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
line 030 alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
\`\`\`
`.trim(),
};

export const fixtureStructuredJsonContext: PromptFixture = {
  id: 'structured-json-context',
  description: 'Structured JSON context that should be classified as structured_data.',
  expectsOptimizeChanges: false,
  content: JSON.stringify(
    {
      project: 'context-compiler',
      phase: 'v1',
      constraints: ['local-first', 'no-ai', 'safe-optimize'],
      thresholds: {
        blockTooLong: 500,
        toolOutputTooLarge: 300,
        oversizedExampleRatio: 0.4,
      },
      commands: [
        { name: 'analyze', purpose: 'inspect prompt structure' },
        { name: 'lint', purpose: 'diagnose prompt debt' },
        { name: 'optimize', purpose: 'apply deterministic reductions' },
      ],
    },
    null,
    2,
  ),
};

export const fixtureOversizedExamples: PromptFixture = {
  id: 'oversized-examples',
  description: 'Examples dominate token budget and should be conservatively trimmed.',
  expectsOptimizeChanges: true,
  content: `
# Goal
Summarize repository constraints and risks.

# Examples
Example 1: Keep output deterministic and avoid stylistic fluff.
Example 2: Keep output deterministic and avoid stylistic fluff.
Example 3: Keep output deterministic and avoid stylistic fluff.
Example 4: Keep output deterministic and avoid stylistic fluff.
Example 5: Keep output deterministic and avoid stylistic fluff.
Example 6: Keep output deterministic and avoid stylistic fluff.
Example 7: Keep output deterministic and avoid stylistic fluff.
Example 8: Keep output deterministic and avoid stylistic fluff.
Example 9: Keep output deterministic and avoid stylistic fluff.
Example 10: Keep output deterministic and avoid stylistic fluff.
Example 11: Keep output deterministic and avoid stylistic fluff.
Example 12: Keep output deterministic and avoid stylistic fluff.
`.trim(),
};

export const fixturePersistentMemory: PromptFixture = {
  id: 'persistent-memory',
  description: 'Memory-heavy context with dated references and prior decisions.',
  expectsOptimizeChanges: false,
  content: `
# Memory
2026-04-01: User requested local-only operation.
2026-04-02: User rejected SaaS and plugin scope.
2026-04-05: We agreed to keep all product logic in packages/.
Remember: previous discussion emphasized deterministic transforms.
Earlier notes said optimize should not rewrite semantic intent.
History: repeated insistence on explainable changes and dry-run safety.

# Task
Prepare a concise status report from repository state.
`.trim(),
};

export const fixtureOptimizeNoOp: PromptFixture = {
  id: 'optimize-no-op',
  description: 'Prompt that should not be modified by optimize v1.',
  expectsOptimizeChanges: false,
  content: `
# System
You are a careful assistant for repository maintenance.

# Constraints
Do not invent facts.
Keep explanations brief and technical.

# Context
The current prompt has no duplicate blocks, no oversized examples, and no noisy logs.
`.trim(),
};

export const fixtureHardeningKitchenSink: PromptFixture = {
  id: 'hardening-kitchen-sink',
  description: 'Mixed realistic context with duplicate constraints, noisy logs, examples, and memory.',
  expectsOptimizeChanges: true,
  content: `
# System
You are an assistant for repository maintenance.
Use markdown.
Be concise.

# Constraints
Do not invent behavior that is not in the repository.
Prefer deterministic output.
Use markdown.
Be concise.

# Context
The current phase is hardening v1.
The implementation must stay local-only and deterministic.
No AI rewriting, plugins, integrations, frontend, or large refactors are in scope.

# Constraints
Do not invent behavior that is not in the repository.
Prefer deterministic output.
Use markdown.
Be concise.

# Memory
2026-04-01: Stabilize v1 completed with config-driven rules and transforms.
2026-04-05: README claims should be backed by tests or benchmark output.
Remember: optimize must explain every remove or replace change.

# Investigation
Use this command output to identify any hardening risk.

\`\`\`bash
task 001 build package core alpha beta gamma delta epsilon zeta eta theta
task 002 build package rules alpha beta gamma delta epsilon zeta eta theta
task 003 build package config alpha beta gamma delta epsilon zeta eta theta
task 004 build package tokenizers alpha beta gamma delta epsilon zeta eta theta
task 005 test parser alpha beta gamma delta epsilon zeta eta theta
task 006 test analyzer alpha beta gamma delta epsilon zeta eta theta
task 007 test optimizer alpha beta gamma delta epsilon zeta eta theta
task 008 test cli alpha beta gamma delta epsilon zeta eta theta
warning: fixture snapshot drift detected in local summary
task 010 lint rules alpha beta gamma delta epsilon zeta eta theta
task 011 lint transforms alpha beta gamma delta epsilon zeta eta theta
task 012 lint config alpha beta gamma delta epsilon zeta eta theta
task 013 typecheck workspace alpha beta gamma delta epsilon zeta eta theta
task 014 benchmark fixtures alpha beta gamma delta epsilon zeta eta theta
error: unknown transform id ignored by config filter
task 016 rerun config tests alpha beta gamma delta epsilon zeta eta theta
task 017 verify idempotency alpha beta gamma delta epsilon zeta eta theta
task 018 verify docs alpha beta gamma delta epsilon zeta eta theta
task 019 prepare summary alpha beta gamma delta epsilon zeta eta theta
task 020 done alpha beta gamma delta epsilon zeta eta theta
task 021 archive alpha beta gamma delta epsilon zeta eta theta
task 022 close alpha beta gamma delta epsilon zeta eta theta
\`\`\`

# Examples
Example 1: Keep analysis summaries stable and deterministic.
Example 2: Keep optimize changes explicit and explainable.
Example 3: Keep benchmarks local and repeatable.
Example 4: Keep config validation strict for unknown IDs.
Example 5: Keep fixtures realistic but compact.
Example 6: Keep README claims tied to commands.
Example 7: Keep tests focused on behavior, not implementation detail.
Example 8: Keep scope limited to hardening v1.
`.trim(),
};

export const fixtureStructuredNoopContext: PromptFixture = {
  id: 'structured-noop-context',
  description: 'Structured JSON and table context expected to remain unchanged by optimize v1.',
  expectsOptimizeChanges: false,
  content: `
{
  "project": "context-compiler",
  "phase": "hardening-v1",
  "constraints": [
    "local-only",
    "no-ai",
    "no-plugins",
    "no-frontend"
  ],
  "evidence": {
    "tests": ["golden", "idempotency", "config-validation"],
    "benchmark": "local fixture loop"
  }
}

| command | purpose | expected |
|---|---|---|
| pnpm test | run unit and golden tests | pass |
| pnpm typecheck | validate TypeScript | pass |
| pnpm build | compile packages | pass |
| pnpm benchmark | measure fixture pipeline | report metrics |
`.trim(),
};

export const promptFixtures: PromptFixture[] = [
  fixtureLongPromptWithDuplicates,
  fixtureLargeToolOutput,
  fixtureStructuredJsonContext,
  fixtureOversizedExamples,
  fixturePersistentMemory,
  fixtureOptimizeNoOp,
  fixtureHardeningKitchenSink,
  fixtureStructuredNoopContext,
];

export const promptFixturesById: Record<string, PromptFixture> = Object.fromEntries(
  promptFixtures.map(fixture => [fixture.id, fixture]),
);
