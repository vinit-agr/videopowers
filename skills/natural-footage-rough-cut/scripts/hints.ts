// hints.ts — cheap, deterministic signals printed in transcript.md to help the editor:
// cut-off endings, restarts that open with the same words, and where each 🔒 line
// was probably said. Hints only; the editor (Claude) makes every decision.
import type { PreparedWord } from "./prepared.js";

const SMALL = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

/** Lowercase, drop punctuation, spell 0–20 so "3" and "three" match. */
export function normWord(text: string): string {
  const w = text.toLowerCase().replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");
  if (/^\d+$/.test(w) && Number(w) <= 20) return SMALL[Number(w)]!;
  return w;
}

/** Scribe marks abandoned speech with a trailing hyphen, dash or ellipsis. */
export function isCutOff(text: string): boolean {
  return /(-|—|–|\.\.\.|…)\s*$/.test(text.trim());
}

/**
 * Index of an earlier phrase (within `lookback` phrases) whose first two
 * normalized words match phrase k's — the "pause, then start the same thought
 * again" retake signal. Null when phrase k opens with new words.
 */
export function restartOf(phrases: string[][], k: number, lookback = 6): number | null {
  const cur = phrases[k];
  if (!cur || cur.length < 2) return null;
  for (let j = k - 1; j >= Math.max(0, k - lookback); j--) {
    const prev = phrases[j]!;
    if (prev.length >= 2 && prev[0] === cur[0] && prev[1] === cur[1]) return j;
  }
  return null;
}

export interface LockCandidate {
  part: number;
  from: number;
  to: number;
  sim: number;
}

/**
 * Approximate-substring match of a 🔒 line against one part's words (Sellers
 * edit distance over normalized tokens). Returns up to 3 non-overlapping
 * windows with similarity ≥ minSim, best first.
 */
export function lockCandidates(lock: string, words: PreparedWord[], partNo: number, minSim = 0.55): LockCandidate[] {
  const pat = lock.split(/\s+/).map(normWord).filter(Boolean);
  const toks: Array<{ t: string; i: number }> = [];
  for (const w of words) {
    const t = normWord(w.text);
    if (t) toks.push({ t, i: w.i });
  }
  const m = pat.length;
  const n = toks.length;
  if (m === 0 || n === 0) return [];

  // prev[j] = edit distance of pat[0..i) vs best substring ending at toks[j-1]; start tracks its origin.
  let prev = new Array<number>(n + 1).fill(0);
  let prevStart = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1);
    const curStart = new Array<number>(n + 1);
    cur[0] = i;
    curStart[0] = 0;
    for (let j = 1; j <= n; j++) {
      const sub = prev[j - 1]! + (pat[i - 1] === toks[j - 1]!.t ? 0 : 1);
      const del = prev[j]! + 1;
      const ins = cur[j - 1]! + 1;
      if (sub <= del && sub <= ins) {
        cur[j] = sub;
        curStart[j] = prevStart[j - 1]!;
      } else if (del <= ins) {
        cur[j] = del;
        curStart[j] = prevStart[j]!;
      } else {
        cur[j] = ins;
        curStart[j] = curStart[j - 1]!;
      }
    }
    prev = cur;
    prevStart = curStart;
  }

  const all: Array<{ s: number; e: number; d: number }> = [];
  for (let j = 1; j <= n; j++) all.push({ s: prevStart[j]!, e: j - 1, d: prev[j]! });
  all.sort((a, b) => a.d - b.d || b.e - b.s - (a.e - a.s));
  const out: LockCandidate[] = [];
  for (const c of all) {
    const sim = 1 - c.d / m;
    if (sim < minSim) break;
    if (c.e < c.s) continue;
    const from = toks[c.s]!.i;
    const to = toks[c.e]!.i;
    if (out.some((o) => from <= o.to && to >= o.from)) continue;
    out.push({ part: partNo, from, to, sim: Math.round(sim * 100) / 100 });
    if (out.length === 3) break;
  }
  return out;
}
