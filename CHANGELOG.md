# Changelog

## 0.1.0

Initial public release prep for a GitHub tag.

### Added

- `analyze` command for structural prompt/context inspection.
- `lint` command with deterministic rule checks.
- `optimize` command with safe v1 deterministic transforms.
- JSON and text output modes for CLI workflows.
- Config loading from `context-compiler.config.json` or `--config <path>`.
- Config-driven warning thresholds, lint rule selection, and optimize transform selection.
- Unknown rule and transform ID validation.
- Realistic fixtures, compact golden tests, and optimize idempotency tests.
- Local benchmark utility over repository fixtures.
- Example prompt and config files for reproducible CLI usage.

### Notes

- This release is prepared for a public GitHub tag, not npm publishing.
- No AI rewriting, plugins, integrations, frontend, or remote API calls are included.
- Token counting uses the current char-tokenizer placeholder.
