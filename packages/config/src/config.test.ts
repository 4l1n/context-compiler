import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig, loadConfig, resolveConfig } from './index.js';

describe('resolveConfig', () => {
  it('merges partial config with defaults', () => {
    const config = resolveConfig({
      tokenizer: { char: { charsPerToken: 6 } },
      optimize: { thresholds: { trimOversizedExamplesPercent: 25 } },
    });
    expect(config.tokenizer.char.charsPerToken).toBe(6);
    expect(config.optimize.thresholds.trimOversizedExamplesPercent).toBe(25);
    expect(config.lint.warnings.blockTooLong).toBe(defaultConfig.lint.warnings.blockTooLong);
  });

  it('throws on invalid ratio values', () => {
    expect(() =>
      resolveConfig({
        lint: { warnings: { unknownRatio: 2 } },
      }),
    ).toThrow();
  });
});

describe('loadConfig', () => {
  it('returns default config when no file exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-config-'));
    try {
      const config = await loadConfig({ cwd });
      expect(config).toEqual(defaultConfig);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('loads and resolves config from explicit path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-config-'));
    const path = join(cwd, 'custom-config.json');
    try {
      await writeFile(
        path,
        JSON.stringify({
          lint: {
            thresholds: {
              noisyToolOutputTokens: 123,
            },
          },
        }),
      );
      const config = await loadConfig({ cwd, configPath: path });
      expect(config.lint.thresholds.noisyToolOutputTokens).toBe(123);
      expect(config.optimize.thresholds.truncateToolOutputTokens).toBe(
        defaultConfig.optimize.thresholds.truncateToolOutputTokens,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
