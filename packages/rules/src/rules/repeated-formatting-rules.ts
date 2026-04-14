import type { IRule, LintContext } from '../types.js';
import type { AnalysisIssue } from '@context-compiler/core';

/**
 * repeated-formatting-rules
 *
 * Detects formatting directives that appear in more than one block.
 * Redundant repetition bloats the prompt without adding value.
 *
 * Detection strategy:
 *  - Maintain an explicit list of formatting patterns (regex + human label).
 *  - For each pattern, count how many blocks contain it.
 *  - If count > 1 → emit one warning listing all affected block ids.
 *
 * Adding new patterns: add an entry to FORMATTING_PATTERNS below.
 * Each entry has a stable id, a human label, and a regex.
 * Regexes are case-insensitive and match anywhere in block content.
 */

type FormattingPattern = {
  id: string;
  label: string;
  regex: RegExp;
};

export const FORMATTING_PATTERNS: FormattingPattern[] = [
  {
    id: 'be-concise',
    label: 'be concise',
    regex: /\b(be concise|keep (it|your (response|answer)) (concise|brief|short)|brevity is)\b/i,
  },
  {
    id: 'bullet-points',
    label: 'use bullet points',
    regex: /\b(use bullet[- ]?points?|format (your |the )?(response|answer|output) (as |with |using )?bullets?|bulleted list)\b/i,
  },
  {
    id: 'avoid-jargon',
    label: 'avoid jargon',
    regex: /\b(avoid jargon|no jargon|plain language|simple language|avoid technical terms)\b/i,
  },
  {
    id: 'avoid-verbose',
    label: 'avoid verbosity',
    regex: /\b(avoid verbosity|not (too )?verbose|don.t be verbose|avoid (being )?(wordy|verbose)|no (unnecessary|extra) words)\b/i,
  },
  {
    id: 'use-markdown',
    label: 'use markdown',
    regex: /\b(use markdown|format (with|using|in) markdown|respond (with|using|in) markdown|markdown format(ting)?)\b/i,
  },
  {
    id: 'numbered-list',
    label: 'use numbered lists',
    regex: /\b(use (a )?numbered list|format (as|with) (a )?numbered list|use (a )?numbered format)\b/i,
  },
  {
    id: 'no-repetition',
    label: 'no repetition',
    regex: /\b(don.t repeat (yourself|information)|do not repeat|avoid repeat(ing)?( yourself)?)\b/i,
  },
  {
    id: 'respond-in-language',
    label: 'respond in same language',
    regex: /\brespond (in|using) (the same |the user.?s )?(language|tongue)\b/i,
  },
  {
    id: 'step-by-step',
    label: 'think step by step',
    regex: /\b(think step[- ]by[- ]step|step[- ]by[- ]step (thinking|reasoning|approach)|reason step[- ]by[- ]step)\b/i,
  },
];

export const repeatedFormattingRules: IRule = {
  id: 'repeated-formatting-rules',
  description: 'Detects formatting directives that are redundantly repeated across blocks',

  check({ blocks }: LintContext): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    for (const pattern of FORMATTING_PATTERNS) {
      const matching = blocks.filter(b => pattern.regex.test(b.content));

      if (matching.length > 1) {
        const ids = matching.map(b => b.id).join(', ');
        issues.push({
          ruleId: 'repeated-formatting-rules',
          severity: 'warning',
          message: `"${pattern.label}" directive repeated in ${matching.length} blocks (${ids}) — consolidate into one`,
        });
      }
    }

    return issues;
  },
};
