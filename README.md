# context-compiler

Deterministic local-first CLI for inspecting, linting, and compacting prompt/context files.

## Quick Value (Start Here)

```bash
ctxc compact --text "You are helpful. You are helpful."
```

Expected compacted result:

```text
You are helpful.
```

No model calls. No semantic rewriting. Only explicit deterministic transforms.

## Install

```bash
npm install -g context-compiler-cli
```

Primary command:

```bash
ctxc --help
```

Compatibility alias:

```bash
context-compiler --help
```

## 30-Second Quick Start

```bash
# Preview deterministic compaction (no file writes)
ctxc compact --text "You are helpful. You are helpful."

# Analyze structure/tokens/warnings
ctxc analyze --text "You are helpful. You are helpful."

# Lint deterministic prompt debt
ctxc lint --text "You are helpful. You are helpful."

# Optimize pipeline preview
ctxc optimize --text "You are helpful. You are helpful." --dry-run --diff
```

Path and directory shortcuts:

```bash
ctxc @prompt.md
ctxc @prompts/
cat prompt.md | ctxc
```

## Commands

| Command | Purpose | Writes files by default |
|---|---|---|
| `ctxc compact` | Front door: preview deterministic compaction and see resulting text | No (preview-only) |
| `ctxc analyze` | Inspect structure, token counts, and warnings | No |
| `ctxc lint` | Detect prompt/context debt with deterministic rules | No |
| `ctxc optimize` | Advanced pipeline workflow (`--write`, `--check`, transform controls) | No (`--write` required) |

`compact` supports file, directory, `--text`, and `--stdin` like other commands.

```bash
ctxc compact examples/basic-prompt.md
ctxc compact examples --diff
ctxc compact --text "You are helpful. You are helpful."
echo "You are helpful. You are helpful." | ctxc compact --stdin
```

`compact` reuses optimize results and JSON shape; it does not introduce a separate output schema.

`optimize` is intentionally more operational than `compact`. Use `compact` for quick preview and readability; use `optimize` when you need pipeline controls, check mode, and explicit write workflows.

## Tokenizer Selection

Default tokenizer is `char`. Optional real model-family tokenizer: `o200k_base`.

Use CLI override (highest precedence):

```bash
ctxc compact --text "You are helpful. You are helpful." --tokenizer o200k_base
ctxc analyze examples/basic-prompt.md --tokenizer char
```

Or set it in config:

```json
{
  "tokenizer": {
    "default": "o200k_base"
  }
}
```

Notes:
- `char` is stable and lightweight.
- `o200k_base` is more faithful for its model family than char fallback.
- Neither option is a universal tokenizer for every model/runtime.

## Input Modes

Inputs are explicit:
- positional path => file or directory
- raw text => `--text "..."`
- stdin => `--stdin`

No guessing between path and raw text.

## Deterministic Transform Scope

Current optimize/compact transforms:
- `remove-exact-duplicates`
- `collapse-repeated-sentences`
- `collapse-formatting-rules`
- `truncate-tool-output`
- `trim-oversized-examples`

Protected blocks are preserved exactly:

```markdown
<!-- context-compiler: protect:start -->
Do not modify this section.
<!-- context-compiler: protect:end -->
```

## Config

By default, config is loaded from `context-compiler.config.json` in the current directory.

```bash
ctxc analyze examples/basic-prompt.md --config examples/context-compiler.config.json
ctxc compact examples/basic-prompt.md --config examples/context-compiler.config.json
```

Unknown lint rule IDs and unknown transform IDs fail clearly.

## When To Use / Not Use

Use when you need:
- deterministic, local prompt/context cleanup
- explainable token savings
- CI-friendly checks (`--fail-on`, `--check`, `--max-tokens`)

Do not use when you need:
- semantic rewriting/paraphrasing
- model-in-the-loop prompt generation
- plugin/integration workflows

## Verification And Benchmark

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm benchmark
```

Or:

```bash
pnpm verify
```

Benchmark is local fixture-based measurement. Use it for same-machine comparisons, not universal performance claims.

## Development (From Source)

```bash
git clone https://github.com/4l1n/context-compiler.git
cd context-compiler
pnpm install
pnpm build
pnpm cc compact --text "You are helpful. You are helpful."
```

`pnpm cc` is an in-repo alias. Outside the repo, use installed `ctxc`.

## License

MIT
