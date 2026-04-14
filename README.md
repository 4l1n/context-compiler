# context-compiler

`context-compiler` is a local-first context compiler for LLM workflows.

It is not a prompt generator.
It inspects, diagnoses, and safely compacts existing context.

## Positioning

`analyze` = inspection  
`lint` = diagnosis  
`optimize` = safe, explainable action

Current phase goals:
- deterministic behavior
- no external API calls
- no AI-based rewriting
- local file in, local result out

## Local-First Philosophy

- Runs on local files.
- No remote inference dependency.
- No hidden prompt mutation.
- Every optimize change is explicit (`remove` or `replace`) with reason and token delta.

## Workspace Layout

| Package | Purpose |
|---|---|
| `@context-compiler/core` | parsing, classification, analysis, optimization pipeline |
| `@context-compiler/rules` | lint rules and lint runner |
| `@context-compiler/tokenizers` | tokenizer interface + char tokenizer |
| `@context-compiler/config` | config schema, defaults, config loader |
| `@context-compiler/fixtures` | realistic prompt/context fixtures |
| `apps/cli` | command orchestration + terminal rendering |

## Setup

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Commands

```bash
node apps/cli/dist/index.js help
node apps/cli/dist/index.js analyze <file> [--json] [--config <path>]
node apps/cli/dist/index.js lint <file> [--json] [--config <path>]
node apps/cli/dist/index.js optimize <file> [--dry-run] [--write] [--json] [--config <path>]
```

## Command Behavior

### `analyze`

Returns structural report:
- blocks
- token totals and percentages
- heuristic warnings

Example:

```bash
node apps/cli/dist/index.js analyze ./prompt.md
```

Example output:

```text
Analysis: ./prompt.md
────────────────────────────────────────────────────
Blocks : 6
Tokens : 812
```

### `lint`

Runs rule checks on analyzed blocks and reports:
- analysis warnings
- lint issues

Example:

```bash
node apps/cli/dist/index.js lint ./prompt.md
```

Example output:

```text
Lint: ./prompt.md
────────────────────────────────────────────────────
Rules  : duplicated-instruction, repeated-formatting-rules, oversized-example-section, noisy-tool-output
Blocks : 6  Tokens: 812
```

### `optimize`

Applies deterministic transforms from `core`:
- `remove-exact-duplicates`
- `collapse-formatting-rules`
- `truncate-tool-output`
- `trim-oversized-examples`

Default mode does not write.
Use `--write` to persist.

Example:

```bash
node apps/cli/dist/index.js optimize ./prompt.md --dry-run
```

Example output:

```text
Optimize: ./prompt.md
────────────────────────────────────────────────────
Tokens : 479 → 400  (−79, −16%)
Changes: 3 applied
```

## Configuration

By default, CLI looks for `context-compiler.config.json` in the current working directory.
You can also pass `--config <path>`.

Config controls:
- lint warning thresholds
- lint rule thresholds
- optimize transform thresholds
- default tokenizer settings
- enable/disable lists for rules and transforms

Minimal example:

```json
{
  "tokenizer": {
    "default": "char",
    "char": { "charsPerToken": 4 }
  },
  "lint": {
    "warnings": {
      "blockTooLong": 500,
      "structuredDataTooLarge": 200,
      "toolOutputTooLarge": 300,
      "unknownRatio": 0.3
    },
    "thresholds": {
      "noisyToolOutputTokens": 300,
      "oversizedExampleRatio": 0.4
    },
    "rules": {
      "enabled": [],
      "disabled": []
    }
  },
  "optimize": {
    "thresholds": {
      "truncateToolOutputTokens": 300,
      "trimOversizedExamplesPercent": 40
    },
    "transforms": {
      "enabled": [],
      "disabled": []
    }
  }
}
```
