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

## Install

Install package `context-compiler-cli`:

```bash
npm install -g context-compiler-cli
```

Use `ctxc` as the primary command:

```bash
ctxc --help
```

`context-compiler` is kept as a compatibility alias:

```bash
context-compiler --help
```

## Quick Start

Use `ctxc` as the short command:

```bash
# Analyze raw text
ctxc "You are helpful. You are helpful."

# Analyze a file
ctxc @prompt.md

# Analyze a directory
ctxc @prompts/

# Pipe from stdin
cat prompt.md | ctxc
```

Advanced subcommands for power users:

```bash
ctxc analyze @prompts/
ctxc lint @prompts/ --fail-on warning
ctxc optimize @prompts/ --check
```

`-h` / `--help` works anywhere:

```bash
ctxc --help
ctxc -h
```

## Run from source (in-repo)

```bash
git clone https://github.com/4l1n/context-compiler.git
cd context-compiler
pnpm install
pnpm build
```

`pnpm cc` and `pnpm cli` are in-repo convenience aliases — they are not available outside
the cloned repo. After the build, any of these work from the repo root:

```bash
pnpm cc @examples/basic-prompt.md     # in-repo alias, simple mode
pnpm cc analyze examples/basic-prompt.md  # in-repo alias, advanced mode
node apps/cli/dist/ctxc.js --help     # direct node invocation
```

`optimize` does not write by default. Use `--write` only when you want to replace the input file.

## Source-Linked Global Install (Development)

This is a **development/source-linked install** for package `context-compiler-cli` — the CLI
binary is symlinked to the cloned repo. You must keep the repo on disk for the install to work.
The linked bin map exposes both `ctxc` (short) and `context-compiler` (compatibility name).

```bash
git clone https://github.com/4l1n/context-compiler.git
cd context-compiler
pnpm install
pnpm build
pnpm --filter context-compiler-cli link --global
```

After linking, `ctxc` and `context-compiler` are available anywhere on the machine:

```bash
ctxc @prompt.md
ctxc lint examples/basic-prompt.md --fail-on error
context-compiler @prompt.md
```

To remove:

```bash
pnpm --filter context-compiler-cli unlink --global
```

## Commands

`pnpm cc` is an in-repo convenience alias. After npm install or source-linked install, replace `pnpm cc` with
`ctxc` (short) or `context-compiler` (compatibility name) in any command below.

```bash
pnpm cc analyze <file-or-directory> [--json] [--config <path>]
pnpm cc analyze --text "<raw content>" [--json] [--config <path>]
pnpm cc analyze --stdin [--json] [--config <path>]

pnpm cc lint <file-or-directory> [--json] [--config <path>]
pnpm cc lint --text "<raw content>" [--json] [--config <path>]
pnpm cc lint --stdin [--json] [--config <path>]

pnpm cc optimize <file-or-directory> [--dry-run] [--write] [--diff] [--only <ids>] [--except <ids>] [--json] [--config <path>]
pnpm cc optimize --text "<raw content>" [--dry-run] [--diff] [--only <ids>] [--except <ids>] [--json] [--config <path>]
pnpm cc optimize --stdin [--dry-run] [--diff] [--only <ids>] [--except <ids>] [--json] [--config <path>]
```

Input modes are explicit. A positional argument is always treated as a file or directory path.
Raw text must use `--text`, and piped input must use `--stdin`. `--text` and `--stdin` are always single-input modes.

## Analyze

`analyze` returns block structure, block types, selected-tokenizer counts, token percentages, and heuristic warnings.

```bash
pnpm cc analyze examples/basic-prompt.md
pnpm cc analyze examples
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
pnpm cc lint examples
pnpm cc lint --text "Be concise. Be concise."
echo "Be concise. Be concise." | pnpm cc lint --stdin
pnpm cc lint examples/basic-prompt.md --json
```

### Lint fail-on

`--fail-on error|warning|info` exits 2 if any issue at or above the threshold exists. Counts both analysis warnings and lint-rule issues combined.

```bash
pnpm cc lint examples/basic-prompt.md --fail-on error   # exit 2 if any errors
pnpm cc lint examples --fail-on warning                 # exit 2 if any warnings or errors
pnpm cc lint examples/basic-prompt.md --fail-on info    # exit 2 if any issues at all
```

Severity threshold is at-or-above: `--fail-on warning` fails on warnings **and** errors.

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
pnpm cc optimize examples --dry-run
pnpm cc optimize examples/basic-prompt.md --dry-run --diff
pnpm cc optimize examples --dry-run --diff
pnpm cc optimize --text "Be concise. Be concise." --dry-run
echo "Be concise. Be concise." | pnpm cc optimize --stdin --dry-run
```

Run a specific transform set:

```bash
pnpm cc optimize examples/basic-prompt.md --dry-run --only remove-exact-duplicates
pnpm cc optimize examples --dry-run --except truncate-tool-output
```

Write changes:

```bash
pnpm cc optimize examples/basic-prompt.md --write
pnpm cc optimize examples --write
```

Machine-readable output:

```bash
pnpm cc optimize examples/basic-prompt.md --dry-run --json
```

`--diff` adds compact before/after snippets for each applied change. `--json` takes precedence when both flags are provided.

`--only` and `--except` accept comma-separated transform IDs. They are mutually exclusive, validate IDs before running, and apply to file, text, stdin, and directory inputs.

### Optimize check mode

`--check` exits 2 if any file or content would change, without writing anything. Compatible with `--diff`. Mutually exclusive with `--write`.

```bash
pnpm cc optimize examples/basic-prompt.md --check        # exit 2 if changes exist
pnpm cc optimize examples --check                        # exit 2 if any file would change
pnpm cc optimize examples --check --diff                 # show changes and exit 2
echo "Be concise. Be concise." | pnpm cc optimize --stdin --check
```

### Analyze token budget

`--max-tokens <n>` exits 2 if any file exceeds the given token count. Budget is per-file (not aggregate).

```bash
pnpm cc analyze examples/basic-prompt.md --max-tokens 500
pnpm cc analyze examples --max-tokens 200   # fails if any single file exceeds 200 tokens
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error — usage error, validation error, or runtime failure |
| 2 | Check failure — `--fail-on` threshold exceeded, `--check` finds pending changes, or `--max-tokens` exceeded |

## Directory Mode

Directory inputs are recursive and support `.md`, `.txt`, and `.json` files. Common non-source directories are skipped: `.git`, `node_modules`, `dist`, `build`, and `.turbo`.

Directory output includes per-file results plus an aggregate summary. `optimize` never writes directory changes unless `--write` is passed.

### Directory Filters

Use `--include` and `--exclude` to control which files are processed. Both flags accept comma-separated patterns and apply to directory mode only.

```bash
pnpm cc analyze examples --include "*.md"
pnpm cc lint examples --exclude drafts
pnpm cc optimize examples --dry-run --include "prompts/**" --exclude "drafts,generated"
```

**Pattern semantics:**

- No wildcards: segment-prefix match. `examples` matches `examples/foo.md` and `examples/sub/bar.txt`.
- `*` matches any characters within a single path segment (no `/`). `*.md` matches `foo.md` but not `examples/foo.md`.
- `**` matches any characters including path separators. `**/*.md` matches `.md` files at any depth including the root.
- Patterns match against the normalized relative path from the input directory (using `/` separators).
- `--exclude` wins: a file that matches both include and exclude is excluded.
- Fails clearly if filtering leaves zero supported files.

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
