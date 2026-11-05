import type { FillerMode, Interval, Phrase, Word } from "./types.js";

// Disfluencies are almost never meaningful, so they're removed anywhere.
export const DISFLUENCIES = [
  "um", "uh", "uhh", "umm", "uhm", "er", "erm", "hmm", "mm", "mmm",
];

// Edge fillers are removed only at a phrase's start/end in safe mode (anywhere
// in aggressive mode). The default list is deliberately CONSERVATIVE: it omits
// high-value words like "so", "like", "right", "actually" that are usually
// meaningful (e.g. "So you build…", "Get them right"). Add them via
// --filler-words if a given speaker uses them as crutches.
export const DEFAULT_EDGE_FILLERS = [
  "you know", "i mean", "kind of", "sort of", "basically", "literally",
];

export interface FillerOptions {
  enabled: boolean;
  mode: FillerMode;
  /** Overrides DEFAULT_EDGE_FILLERS when provided. */
  edgeWords?: string[] | null;
}

export interface FillerResult {
  phrases: Phrase[];
  /** Time spans of removed words (for "keep silences" reconstruction). */
  removedSpans: Interval[];
  removed: number;
}

function norm(t: string): string {
  return t.toLowerCase().replace(/[^a-z']/g, "");
}

/** Longest edge-filler phrase (in tokens) matching `tokens` starting at `pos`. */
function matchLen(tokens: string[], pos: number, fillers: string[][]): number {
  let best = 0;
  for (const f of fillers) {
    if (pos + f.length > tokens.length) continue;
    if (f.every((t, k) => tokens[pos + k] === t) && f.length > best) best = f.length;
  }
  return best;
}

/** Longest edge-filler phrase ending exactly at `endExclusive`. */
function matchLenEnding(tokens: string[], endExclusive: number, lo: number, fillers: string[][]): number {
  let best = 0;
  for (const f of fillers) {
    const start = endExclusive - f.length;
    if (start < lo) continue;
    if (f.every((t, k) => tokens[start + k] === t) && f.length > best) best = f.length;
  }
  return best;
}

function mergeSpans(spans: Interval[]): Interval[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + 1e-6) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/**
 * Remove filler words from each phrase.
 *  - Disfluencies (um/uh/…) are dropped wherever they appear.
 *  - Edge fillers ("you know", …) are dropped only from the leading/trailing
 *    run in safe mode, or anywhere in aggressive mode.
 * Returns the rebuilt phrases plus the time spans that were excised.
 */
export function removeFillers(phrases: Phrase[], opts: FillerOptions): FillerResult {
  if (!opts.enabled) return { phrases, removedSpans: [], removed: 0 };

  const dis = new Set(DISFLUENCIES.map(norm));
  const edge = (opts.edgeWords ?? DEFAULT_EDGE_FILLERS).map((p) => p.split(/\s+/).map(norm).filter(Boolean));
  const removedSpans: Interval[] = [];
  let removed = 0;
  const out: Phrase[] = [];

  for (const p of phrases) {
    const tokens = p.words.map((w) => norm(w.text));
    const keep = p.words.map(() => true);

    // 1) disfluencies anywhere
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] && dis.has(tokens[i]!)) keep[i] = false;
    }

    // 2) edge fillers — operate over the indices that survived step 1
    const surv = p.words.map((_, i) => i).filter((i) => keep[i]);
    const survTok = surv.map((i) => tokens[i]!);

    const drop = (survLo: number, survHiExcl: number) => {
      for (let k = survLo; k < survHiExcl; k++) keep[surv[k]!] = false;
    };

    if (opts.mode === "aggressive") {
      let k = 0;
      while (k < survTok.length) {
        const m = matchLen(survTok, k, edge);
        if (m > 0) { drop(k, k + m); k += m; } else k++;
      }
    } else {
      // safe: leading run, then trailing run
      let lo = 0;
      while (lo < survTok.length) {
        const m = matchLen(survTok, lo, edge);
        if (m > 0) { drop(lo, lo + m); lo += m; } else break;
      }
      let hi = survTok.length;
      while (hi > lo) {
        const m = matchLenEnding(survTok, hi, lo, edge);
        if (m > 0) { drop(hi - m, hi); hi -= m; } else break;
      }
    }

    // 3) collect removed spans + rebuild the phrase
    const kept: Word[] = [];
    for (let i = 0; i < p.words.length; i++) {
      const w = p.words[i]!;
      if (keep[i]) kept.push(w);
      else { removedSpans.push({ start: w.start, end: w.end }); removed++; }
    }
    if (kept.length > 0) {
      out.push({
        words: kept,
        start: kept[0]!.start,
        end: kept[kept.length - 1]!.end,
        text: kept.map((w) => w.text).join(" "),
      });
    }
  }

  return { phrases: out, removedSpans: mergeSpans(removedSpans), removed };
}
