import type { Word } from "./types.js";

/** Normalize one token the same way across anchors and transcript words. */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, "");
}

export interface SpokenWord {
  norm: string;
  start: number;
  end: number;
}

/** Spoken words only, normalized once. */
export function spokenWords(words: Word[]): SpokenWord[] {
  return words
    .filter((w) => (w.type ?? "word") === "word")
    .map((w) => ({ norm: norm(w.text), start: w.start, end: w.end }))
    .filter((w) => w.norm.length > 0);
}

/**
 * Find an anchor phrase in the transcript: the first run of consecutive
 * spoken words matching the phrase's tokens, starting at or after `fromSec`
 * and beginning before `untilSec`. Returns the start time of the first
 * matched word, or null.
 */
export function findAnchor(
  words: SpokenWord[],
  phrase: string,
  fromSec: number,
  untilSec: number,
): number | null {
  const tokens = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (tokens.length === 0) return null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w.start < fromSec) continue;
    if (w.start >= untilSec) break;
    let ok = true;
    for (let j = 0; j < tokens.length; j++) {
      const cand = words[i + j];
      if (!cand || cand.norm !== tokens[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return w.start;
  }
  return null;
}
