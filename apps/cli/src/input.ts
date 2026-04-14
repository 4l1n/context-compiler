import { extname } from 'node:path';
import { loadFile } from '@context-compiler/core';

export type ParsedArgsLike = {
  flags: Set<string>;
  options: Map<string, string>;
  positionals: string[];
};

export type CliInputKind = 'path' | 'text' | 'stdin';

export type CliInput = {
  kind: CliInputKind;
  path: string;
  content: string;
  ext: string;
};

export type ResolveInputOptions = {
  command: string;
  usage: string;
  readStdin?: () => Promise<string>;
};

export async function resolveCliInput(
  parsed: ParsedArgsLike,
  options: ResolveInputOptions,
): Promise<CliInput> {
  const positionalCount = parsed.positionals.length;
  const hasPath = positionalCount > 0;
  const hasText = parsed.options.has('text');
  const hasStdin = parsed.flags.has('stdin');
  const modeCount = Number(hasPath) + Number(hasText) + Number(hasStdin);

  if (positionalCount > 1) {
    throw new Error(`${options.command} accepts exactly one path argument\n  usage: ${options.usage}`);
  }

  if (modeCount === 0) {
    throw new Error(`${options.command} requires one input source: <file>, --text, or --stdin\n  usage: ${options.usage}`);
  }

  if (modeCount > 1) {
    throw new Error(`${options.command} accepts only one input source: <file>, --text, or --stdin`);
  }

  if (hasText) {
    return {
      kind: 'text',
      path: '<text>',
      content: parsed.options.get('text') ?? '',
      ext: '.txt',
    };
  }

  if (hasStdin) {
    return {
      kind: 'stdin',
      path: '<stdin>',
      content: await (options.readStdin ?? readProcessStdin)(),
      ext: '.txt',
    };
  }

  const path = parsed.positionals[0];
  const content = await loadFile(path);
  return {
    kind: 'path',
    path,
    content,
    ext: extname(path).toLowerCase(),
  };
}

export function isPathInput(input: CliInput): boolean {
  return input.kind === 'path';
}

function readProcessStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);
    process.stdin.resume();
  });
}
