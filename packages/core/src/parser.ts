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

export type RawBlock = { id: string; content: string };

/**
 * Split `content` into raw blocks.
 * @param content - text to parse (already normalized by loader)
 * @param ext     - file extension, e.g. '.md', '.txt', '.json'
 */
export function parseBlocks(content: string, ext = '.txt'): RawBlock[] {
  if (!content.trim()) return [];

  if (ext === '.json') {
    return [{ id: 'block-1', content: content.trim() }];
  }

  return segmentText(content);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Regex that matches a complete fenced code block (``` ... ```). */
const CODE_FENCE_RE = /```[^\n]*\n[\s\S]*?```/g;

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
