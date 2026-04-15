/**
 * Block parser v1.
 *
 * Heuristics (applied in order):
 *  1. JSON files → single block (content already serialized by loader)
 *  2. Fenced code blocks (```...```) → each is its own block
 *  3. Markdown headings (# / ## / …) → split before each heading
 *  4. Double newlines → split remaining prose
 *
 * No structural parsing. No dependency on external libs.
 */

import { PROTECT_END_MARKER, PROTECT_START_MARKER } from './protection.js';
import type { BlockMetadata } from './types.js';

export type RawBlock = { id: string; content: string; metadata?: BlockMetadata };

/**
 * Split `content` into raw blocks.
 * @param content - text to parse (already normalized by loader)
 * @param ext     - file extension, e.g. '.md', '.txt', '.json'
 */
export function parseBlocks(content: string, ext = '.txt', sourceLabel = '<input>'): RawBlock[] {
  if (!content.trim()) return [];

  if (ext === '.json') {
    return [{ id: 'block-1', content: content.trim() }];
  }

  const blocks = splitProtectedSegments(content, sourceLabel).flatMap(segment => {
    if (segment.protected) {
      return [
        {
          id: '',
          content: segment.text.trim(),
          metadata: { protected: true },
        },
      ];
    }

    return segmentText(segment.text).map(block => ({
      id: '',
      content: block.content,
    }));
  });

  return blocks.map((block, i) => ({ ...block, id: `block-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Regex that matches a complete fenced code block (``` ... ```). */
const CODE_FENCE_RE = /```[^\n]*\n[\s\S]*?```/g;

type ProtectedSegment = {
  text: string;
  protected: boolean;
};

function splitProtectedSegments(content: string, sourceLabel: string): ProtectedSegment[] {
  const segments: ProtectedSegment[] = [];
  const unprotectedLines: string[] = [];
  let protectedLines: string[] = [];
  let protectedStartLine = 0;
  let inProtected = false;

  const flushUnprotected = () => {
    const text = unprotectedLines.join('\n');
    if (text.trim()) segments.push({ text, protected: false });
    unprotectedLines.length = 0;
  };

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNo = i + 1;
    const marker = line.trim();

    if (!inProtected && marker === PROTECT_END_MARKER) {
      throw new Error(`Protected block end marker without start in ${sourceLabel} at line ${lineNo}`);
    }

    if (!inProtected && marker === PROTECT_START_MARKER) {
      flushUnprotected();
      inProtected = true;
      protectedStartLine = lineNo;
      protectedLines = [line];
      continue;
    }

    if (inProtected && marker === PROTECT_START_MARKER) {
      throw new Error(`Nested protected block marker in ${sourceLabel} at line ${lineNo}`);
    }

    if (inProtected && marker === PROTECT_END_MARKER) {
      protectedLines.push(line);
      segments.push({ text: protectedLines.join('\n'), protected: true });
      protectedLines = [];
      protectedStartLine = 0;
      inProtected = false;
      continue;
    }

    if (inProtected) {
      protectedLines.push(line);
    } else {
      unprotectedLines.push(line);
    }
  }

  if (inProtected) {
    throw new Error(`Protected block start marker without end in ${sourceLabel} at line ${protectedStartLine}`);
  }

  flushUnprotected();
  return segments;
}

function segmentText(content: string): RawBlock[] {
  // Step 1: extract fenced code blocks, keep the rest as prose segments.
  const segments: Array<{ isCode: boolean; text: string }> = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CODE_FENCE_RE)) {
    if (match.index > lastIndex) {
      segments.push({ isCode: false, text: content.slice(lastIndex, match.index) });
    }
    segments.push({ isCode: true, text: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ isCode: false, text: content.slice(lastIndex) });
  }

  // Step 2: split prose segments by headings then by double newlines.
  const texts: string[] = [];

  for (const seg of segments) {
    if (seg.isCode) {
      const trimmed = seg.text.trim();
      if (trimmed) texts.push(trimmed);
    } else {
      const parts = seg.text
        // Split *before* any markdown heading (## Title…)
        .split(/(?=^#{1,6} )/m)
        // Then split on double (or more) newlines
        .flatMap(p => p.split(/\n{2,}/))
        .map(p => p.trim())
        .filter(p => p.length > 0);
      texts.push(...parts);
    }
  }

  return texts.map((text, i) => ({ id: `block-${i + 1}`, content: text }));
}
