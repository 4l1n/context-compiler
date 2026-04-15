import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveCliInput } from './input.js';
import type { ParsedArgsLike } from './input.js';

function parsed(args: {
  flags?: string[];
  options?: Record<string, string>;
  positionals?: string[];
} = {}): ParsedArgsLike {
  return {
    flags: new Set(args.flags ?? []),
    options: new Map(Object.entries(args.options ?? {})),
    positionals: args.positionals ?? [],
  };
}

const baseOptions = {
  command: 'analyze',
  usage: 'context-compiler analyze <file> [--text <text>] [--stdin]',
};

describe('resolveCliInput', () => {
  it('loads file path input', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-input-'));
    const path = join(cwd, 'prompt.md');
    try {
      await writeFile(path, '# System\nBe concise.', 'utf8');
      const input = await resolveCliInput(parsed({ positionals: [path] }), baseOptions);
      expect(input).toEqual({
        kind: 'file',
        path,
        content: '# System\nBe concise.',
        ext: '.md',
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('resolves directory path input', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'context-compiler-input-'));
    const path = join(cwd, 'prompts');
    try {
      await mkdir(path);
      const input = await resolveCliInput(parsed({ positionals: [path] }), baseOptions);
      expect(input).toEqual({
        kind: 'directory',
        path,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('uses raw text input', async () => {
    const input = await resolveCliInput(
      parsed({ options: { text: 'Be concise. Be concise.' } }),
      baseOptions,
    );
    expect(input).toEqual({
      kind: 'text',
      path: '<text>',
      content: 'Be concise. Be concise.',
      ext: '.txt',
    });
  });

  it('reads stdin only when requested', async () => {
    const input = await resolveCliInput(parsed({ flags: ['stdin'] }), {
      ...baseOptions,
      readStdin: async () => 'Be concise from stdin.',
    });
    expect(input).toEqual({
      kind: 'stdin',
      path: '<stdin>',
      content: 'Be concise from stdin.',
      ext: '.txt',
    });
  });

  it('rejects missing input', async () => {
    await expect(resolveCliInput(parsed(), baseOptions)).rejects.toThrow(
      'analyze requires one input source',
    );
  });

  it('rejects more than one positional path', async () => {
    await expect(
      resolveCliInput(parsed({ positionals: ['one.md', 'two.md'] }), baseOptions),
    ).rejects.toThrow('analyze accepts exactly one path argument');
  });

  it('rejects path plus text', async () => {
    await expect(
      resolveCliInput(
        parsed({ positionals: ['prompt.md'], options: { text: 'raw' } }),
        baseOptions,
      ),
    ).rejects.toThrow('analyze accepts only one input source');
  });

  it('rejects path plus stdin', async () => {
    await expect(
      resolveCliInput(parsed({ positionals: ['prompt.md'], flags: ['stdin'] }), baseOptions),
    ).rejects.toThrow('analyze accepts only one input source');
  });

  it('rejects text plus stdin', async () => {
    await expect(
      resolveCliInput(
        parsed({ flags: ['stdin'], options: { text: 'raw' } }),
        baseOptions,
      ),
    ).rejects.toThrow('analyze accepts only one input source');
  });
});
