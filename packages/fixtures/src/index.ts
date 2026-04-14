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

export const promptFixtures: PromptFixture[] = [
  fixtureLongPromptWithDuplicates,
  fixtureLargeToolOutput,
  fixtureStructuredJsonContext,
  fixtureOversizedExamples,
  fixturePersistentMemory,
  fixtureOptimizeNoOp,
];

export const promptFixturesById: Record<string, PromptFixture> = Object.fromEntries(
  promptFixtures.map(fixture => [fixture.id, fixture]),
);
