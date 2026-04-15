# Examples

Run these from the repository root.

`pnpm cc` is an in-repo convenience alias. If you have done a source-linked install,
replace `pnpm cc` with `ctxc` (primary) or `context-compiler` (compatibility alias).

```bash
pnpm install
pnpm build
pnpm cc analyze examples/basic-prompt.md
pnpm cc lint examples/basic-prompt.md
pnpm cc optimize examples/basic-prompt.md --dry-run
pnpm cc optimize examples/basic-prompt.md --dry-run --diff
pnpm cc compact examples/basic-prompt.md
```

Run the same commands across the example directory:

```bash
pnpm cc analyze examples
pnpm cc lint examples
pnpm cc optimize examples --dry-run
pnpm cc optimize examples --dry-run --diff
pnpm cc compact examples --diff
```

Limit which optimize transforms run:

```bash
pnpm cc optimize examples/basic-prompt.md --dry-run --only remove-exact-duplicates
pnpm cc optimize examples --dry-run --except truncate-tool-output
```

Use the example config explicitly:

```bash
pnpm cc analyze examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cc lint examples/basic-prompt.md --config examples/context-compiler.config.json
pnpm cc optimize examples/basic-prompt.md --dry-run --config examples/context-compiler.config.json
```

The default tokenizer is `char`. You can override it directly:

```bash
pnpm cc analyze examples/basic-prompt.md --tokenizer o200k_base
pnpm cc compact examples/basic-prompt.md --tokenizer o200k_base
```

Or set `tokenizer.default` to `o200k_base` in a config file and pass it with `--config`.

Use explicit non-file input:

```bash
pnpm cc analyze --text "Be concise. Be concise."
pnpm cc lint --text "Be concise. Be concise."
pnpm cc optimize --text "Be concise. Be concise." --dry-run

echo "Be concise. Be concise." | pnpm cc analyze --stdin
echo "Be concise. Be concise." | pnpm cc lint --stdin
echo "Be concise. Be concise." | pnpm cc optimize --stdin --dry-run
```

`--text` and `--stdin` are single-input modes; directory mode uses a positional path.

Use check mode for CI enforcement:

```bash
# Fail (exit 2) if any lint issues exist at or above the threshold
pnpm cc lint examples/basic-prompt.md --fail-on error
pnpm cc lint examples --fail-on warning

# Fail (exit 2) if any file would change under optimize
pnpm cc optimize examples/basic-prompt.md --check
pnpm cc optimize examples --check --diff

# Fail (exit 2) if any file exceeds the token budget (per file)
pnpm cc analyze examples/basic-prompt.md --max-tokens 500
pnpm cc analyze examples --max-tokens 200
```

Exit codes: `0` = success, `1` = error, `2` = check failure.

Filter which files are processed in directory mode:

```bash
pnpm cc analyze examples --include "*.md"
pnpm cc lint examples --exclude protected-prompt.md
pnpm cc optimize examples --dry-run --include "basic-prompt.md"
pnpm cc optimize examples --dry-run --exclude "protected-prompt.md"
```

`--include` and `--exclude` accept comma-separated patterns. `--exclude` wins when both match the same file.

Use protected markers when specific markdown/text ranges must stay unchanged:

```bash
pnpm cc analyze examples/protected-prompt.md
pnpm cc optimize examples/protected-prompt.md --dry-run --diff
```

`optimize` does not write by default. Use `--write` only when you want to replace the input file with the optimized content.
