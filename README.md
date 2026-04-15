# context-compiler

`context-compiler` is a local-first CLI for inspecting, linting, and deterministically compacting prompt context.

It helps you understand what is inside a prompt/context file before you send it anywhere.

## What It Does

- Splits `.md`, `.txt`, and `.json` files into analyzable blocks.
- Classifies blocks with deterministic heuristics.
- Counts tokens with a configurable tokenizer.
- Reports warnings and lint issues for prompt/context debt.
- Applies safe, deterministic optimize transforms with explicit change records.
- Preserves explicit protected blocks during optimization.
- Runs locally with no remote API calls.

## What It Does Not Do

- It does not generate prompts.
- It does not use AI or model calls.
- It does not rewrite semantic intent.
- It does not install plugins or integrations.
- It does not include a frontend.
- It is not published to npm yet; this release is prepared for a GitHub tag.

## Quick Start

```bash
git clone https://github.com/4l1n/context-compiler.git
cd context-compiler
pnpm install
pnpm build

pnpm cc help
pnpm cc analyze examples/basic-prompt.md
pnpm cc lint examples/basic-prompt.md
pnpm cc optimize examples/basic-prompt.md --dry-run
```

`optimize` does not write by default. Use `--write` only when you want to replace the input file.

```bash
pnpm cc optimize examples/basic-prompt.md --write
```

## Commands

```bash
pnpm cc analyze <file> [--json] [--config <path>]
pnpm cc analyze --text "<raw content>" [--json] [--config <path>]
pnpm cc analyze --stdin [--json] [--config <path>]

pnpm cc lint <file> [--json] [--config <path>]
pnpm cc lint --text "<raw content>" [--json] [--config <path>]
pnpm cc lint --stdin [--json] [--config <path>]

pnpm cc optimize <file> [--dry-run] [--write] [--diff] [--json] [--config <path>]
pnpm cc optimize --text "<raw content>" [--dry-run] [--diff] [--json] [--config <path>]
pnpm cc optimize --stdin [--dry-run] [--diff] [--json] [--config <path>]
```

You can also run the built CLI directly:

```bash
pnpm cli analyze examples/basic-prompt.md
node apps/cli/dist/index.js analyze examples/basic-prompt.md
```

Input modes are explicit. A positional argument is always treated as a file path.
Raw text must use `--text`, and piped input must use `--stdin`.

## Analyze

`analyze` returns block structure, block types, selected-tokenizer counts, token percentages, and heuristic warnings.

```bash
pnpm cc analyze examples/basic-prompt.md
pnpm cc analyze --text "Be concise. Be concise."
echo "Be concise. Be concise." | pnpm cc analyze --stdin
pnpm cc analyze examples/basic-prompt.md --json
```

## Lint

`lint` runs deterministic rules over the analyzed blocks.

Current rules:

- `duplicated-instruction`
- `repeated-formatting-rules`
- `oversized-example-section`
- `noisy-tool-output`

```bash
pnpm cc lint examples/basic-prompt.md
pnpm cc lint --text "Be concise. Be concise."
echo "Be concise. Be concise." | pnpm cc lint --stdin
pnpm cc lint examples/basic-prompt.md --json
```

## Optimize

`optimize` applies deterministic transforms and reports every change as `remove` or `replace` with a reason and token delta.

Current transforms:

- `remove-exact-duplicates`
- `collapse-formatting-rules`
- `truncate-tool-output`
- `trim-oversized-examples`

Preview changes:

```bash
pnpm cc optimize examples/basic-prompt.md --dry-run
pnpm cc optimize examples/basic-prompt.md --dry-run --diff
pnpm cc optimize --text "Be concise. Be concise." --dry-run
echo "Be concise. Be concise." | pnpm cc optimize --stdin --dry-run
```

Write changes:

```bash
pnpm cc optimize examples/basic-prompt.md --write
```

Machine-readable output:

```bash
pnpm cc optimize examples/basic-prompt.md --dry-run --json
```

`--diff` adds compact before/after snippets for each applied change. `--json` takes precedence when both flags are provided.

## Protected Blocks

Markdown and text inputs can mark content that optimize must preserve exactly:

```markdown
<!-- context-compiler: protect:start -->
This block must stay unchanged.
<!-- context-compiler: protect:end -->
```

Protected ranges become single blocks, including the marker lines. `analyze` marks them as `protected`, and `optimize` skips them for all current transforms. Nested markers or unmatched markers fail with an error that includes the input source.

Try the protected example:

```bash
pnpm cc analyze examples/protected-prompt.md
pnpm cc optimize examples/protected-prompt.md --dry-run --diff
```

## Configuration

By default, the CLI looks for `context-compiler.config.json` in the current working directory.
You can also pass an explicit config path.

```bash
pnpm cc lint examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cc optimize examples/basic-prompt.md --dry-run --config examples/context-compiler.config.json
```

Minimal config shape:

```json
{
  "tokenizer": {
    "default": "char",
    "char": {
      "charsPerToken": 4
    }
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

Unknown rule or transform IDs fail loudly instead of being ignored.

Tokenizer options:

- `char` is the default fallback. It is deterministic, lightweight, and uses `charsPerToken`.
- `o200k_base` is a real model-family tokenizer option. It is more faithful than `char` for matching models, but it is not a universal tokenizer for every model.

Select `o200k_base` explicitly:

```json
{
  "tokenizer": {
    "default": "o200k_base"
  }
}
```

## Workspace Layout

| Package | Purpose |
|---|---|
| `@context-compiler/core` | parsing, classification, analysis, optimization pipeline |
| `@context-compiler/rules` | lint rules and lint runner |
| `@context-compiler/tokenizers` | tokenizer interface, char fallback, and o200k_base tokenizer |
| `@context-compiler/config` | config schema, defaults, and loader |
| `@context-compiler/fixtures` | realistic prompt/context fixtures |
| `apps/cli` | command orchestration and terminal rendering |

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm benchmark
```

Or run the combined local verification script:

```bash
pnpm verify
```

## Evidence

| Claim | Evidence |
|---|---|
| Analysis and optimize behavior are deterministic for current fixtures | `pnpm test` golden fixture summaries |
| Optimize reaches a fixed point for current fixtures | `pnpm test` idempotency coverage |
| Unknown configured rule and transform IDs fail loudly | `pnpm test` config and builder validation coverage |
| Pipeline behavior can be measured locally | `pnpm benchmark` |

## Benchmark

The benchmark is a local measurement utility over repository fixtures.
It is useful for comparing changes on the same machine, but it is not a universal performance guarantee.
It uses the default char tokenizer baseline for comparability.

```bash
pnpm benchmark
BENCH_ITERATIONS=50 pnpm benchmark
```

## Release Status

`0.1.0` is the first public GitHub-tag release target.

Current limitations:

- Packages remain private and are not prepared for npm publishing.
- Token counts default to the char fallback unless `o200k_base` is selected in config.
- Classification, linting, and optimization are heuristic and deterministic.
- Local file, raw text, and stdin workflows are supported.

## License

MIT
