import { describe, it, expect } from 'vitest';
import { parseBlocks } from './parser.js';

describe('parseBlocks — JSON', () => {
  it('returns a single block for JSON content', () => {
    const content = '{\n  "key": "value"\n}';
    const blocks = parseBlocks(content, '.json');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.content).toBe(content);
  });

  it('returns [] for empty JSON content', () => {
    expect(parseBlocks('   ', '.json')).toHaveLength(0);
  });
});

describe('parseBlocks — double newlines', () => {
  it('splits prose on double newlines', () => {
    const content = 'First paragraph.\n\nSecond paragraph.';
    const blocks = parseBlocks(content, '.txt');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.content).toBe('First paragraph.');
    expect(blocks[1]?.content).toBe('Second paragraph.');
  });

  it('assigns sequential ids', () => {
    const content = 'A\n\nB\n\nC';
    const blocks = parseBlocks(content, '.txt');
    expect(blocks.map(b => b.id)).toEqual(['block-1', 'block-2', 'block-3']);
  });

  it('filters out empty segments', () => {
    const content = 'Hello\n\n\n\nWorld';
    const blocks = parseBlocks(content, '.md');
    expect(blocks).toHaveLength(2);
  });
});

describe('parseBlocks — markdown headings', () => {
  it('splits before headings', () => {
    const content = '## Section A\nContent A\n\n## Section B\nContent B';
    const blocks = parseBlocks(content, '.md');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.content).toMatch(/## Section A/);
    expect(blocks[1]?.content).toMatch(/## Section B/);
  });

  it('keeps heading and its body in the same block', () => {
    const content = '## Intro\nThis is the intro text.';
    const blocks = parseBlocks(content, '.md');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.content).toContain('Intro');
    expect(blocks[0]?.content).toContain('intro text');
  });
});

describe('parseBlocks — fenced code blocks', () => {
  it('treats a fenced code block as one block', () => {
    const content = 'Some prose.\n\n```python\nprint("hello")\n```\n\nMore prose.';
    const blocks = parseBlocks(content, '.md');
    const codeBlock = blocks.find(b => b.content.startsWith('```'));
    expect(codeBlock).toBeDefined();
    expect(codeBlock?.content).toContain('print("hello")');
  });

  it('does not split inside a fenced code block', () => {
    const content = '```json\n{\n  "a": 1\n}\n```';
    const blocks = parseBlocks(content, '.md');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.content).toContain('"a": 1');
  });
});

describe('parseBlocks — protected blocks', () => {
  const protectedContent = [
    '<!-- context-compiler: protect:start -->',
    '# Protected',
    'Be concise.',
    '<!-- context-compiler: protect:end -->',
  ].join('\n');

  it('creates one protected block for a marker pair', () => {
    const blocks = parseBlocks(`Intro.\n\n${protectedContent}\n\nOutro.`, '.md', 'sample.md');
    expect(blocks).toHaveLength(3);
    expect(blocks[1]?.metadata?.protected).toBe(true);
  });

  it('preserves marker lines inside protected block content', () => {
    const blocks = parseBlocks(protectedContent, '.md', 'sample.md');
    expect(blocks[0]?.content).toContain('<!-- context-compiler: protect:start -->');
    expect(blocks[0]?.content).toContain('<!-- context-compiler: protect:end -->');
  });

  it('supports multiple protected ranges', () => {
    const blocks = parseBlocks(`${protectedContent}\n\nMiddle.\n\n${protectedContent}`, '.txt', 'sample.txt');
    expect(blocks.filter(block => block.metadata?.protected === true)).toHaveLength(2);
  });

  it('throws on unmatched start marker and includes source label', () => {
    expect(() =>
      parseBlocks('<!-- context-compiler: protect:start -->\nNo end.', '.md', '<text>'),
    ).toThrow('<text>');
  });

  it('throws on unmatched end marker and includes source label', () => {
    expect(() =>
      parseBlocks('No start.\n<!-- context-compiler: protect:end -->', '.md', '<stdin>'),
    ).toThrow('<stdin>');
  });

  it('throws on nested marker and includes source label', () => {
    expect(() =>
      parseBlocks(
        [
          '<!-- context-compiler: protect:start -->',
          '<!-- context-compiler: protect:start -->',
          '<!-- context-compiler: protect:end -->',
        ].join('\n'),
        '.md',
        'nested.md',
      ),
    ).toThrow('nested.md');
  });

  it('does not parse protection markers in JSON input', () => {
    const content = JSON.stringify({
      value: '<!-- context-compiler: protect:start -->',
    });
    const blocks = parseBlocks(content, '.json', 'sample.json');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.metadata).toBeUndefined();
  });
});

describe('parseBlocks — empty input', () => {
  it('returns [] for empty string', () => {
    expect(parseBlocks('', '.md')).toHaveLength(0);
    expect(parseBlocks('   \n  ', '.txt')).toHaveLength(0);
  });
});
