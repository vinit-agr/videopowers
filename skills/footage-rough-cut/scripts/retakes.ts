import type { Interval, Phrase, Word } from "./types.js";

export interface RetakeOptions {
  /** Normalized-text similarity (0..1) at/above which two phrases are one line. */
  similarity: number;
  /** Minimum shared leading words to treat as a false-start/extension. */
  minPrefix: number;
  /** Max phrases that can belong to one retake cluster. */
  window: number;
}

export const DEFAULT_RETAKE_OPTIONS: RetakeOptions = {
  similarity: 0.75,
  minPrefix: 2,
  window: 5,
};

export interface RetakeResult {
  kept: Phrase[];
  /** Time spans of dropped earlier takes (for "keep silences" reconstruction). */
  droppedSpans: Interval[];
  /** Number of retake clusters collapsed. */
  clusters: number;
}

function normWords(p: Phrase): string[] {
  return p.words.map((w) => w.text.toLowerCase().replace(/[^a-z0-9']/g, "")).filter(Boolean);
}

function sharedPrefix(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** Last word's raw text lacks sentence-final punctuation, or trails off ("…"). */
function isIncomplete(p: Phrase): boolean {
  const raw = (p.words[p.words.length - 1]?.text ?? "").trim();
  if (/(\.\.\.|…)$/.test(raw)) return true;
  return !/[.?!]$/.test(raw);
}

function levRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]!;
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i]!;
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i]!, dp[i - 1]!);
      prev = tmp;
    }
  }
  return 1 - dp[a.length]! / Math.max(a.length, b.length);
}

/** Are two phrases takes of the same intended line? */
export function sameLine(a: Phrase, b: Phrase, opts: RetakeOptions): boolean {
  const na = normWords(a);
  const nb = normWords(b);
  if (!na.length || !nb.length) return false;

  const ja = na.join(" ");
  const jb = nb.join(" ");
  if (ja === jb) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  const isPrefix = shorter.every((t, i) => longer[i] === t);
  if (isPrefix && shorter.length >= opts.minPrefix) return true;

  const lead = sharedPrefix(na, nb);
  if (lead >= opts.minPrefix && isIncomplete(a)) return true;

  return levRatio(ja, jb) >= opts.similarity;
}

/**
 * Trim a within-phrase restart: if the speaker repeats the opening words mid-
 * phrase ("get them right and… get them right and stops…"), keep from the last
 * restart. Returns the phrase unchanged when no restart is found.
 */
export function trimRestart(p: Phrase): Phrase {
  const tok = normWords(p);
  // normWords drops non-alphanumeric tokens; map back to word indices in parallel.
  const idx: number[] = [];
  p.words.forEach((w, i) => {
    if (w.text.toLowerCase().replace(/[^a-z0-9']/g, "")) idx.push(i);
  });
  let restart = 0;
  for (let j = 1; j < tok.length; j++) {
    let l = 0;
    while (j + l < tok.length && tok[l] === tok[j + l]) l++;
    if (l >= 2) restart = j;
  }
  if (restart === 0) return p;
  const startWord = idx[restart]!;
  const words = p.words.slice(startWord);
  if (!words.length) return p;
  return {
    words,
    start: words[0]!.start,
    end: words[words.length - 1]!.end,
    text: words.map((w) => w.text).join(" "),
  };
}

/**
 * Collapse runs of consecutive phrases that are takes of the same line, keeping
 * the LAST take of each run. Also trims within-phrase restarts first.
 */
/** Is `a` a contiguous word-subsequence of `b`? */
function isContiguousSub(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length > b.length) return false;
  for (let s = 0; s + a.length <= b.length; s++) {
    if (a.every((t, k) => b[s + k] === t)) return true;
  }
  return false;
}

export function keepLastTakes(phrases: Phrase[], opts: RetakeOptions = DEFAULT_RETAKE_OPTIONS): RetakeResult {
  const droppedSpans: Interval[] = [];
  let clusters = 0;

  // Pass 0: drop punctuation-only / empty phrases (Scribe blips like "...").
  const cleaned: Phrase[] = [];
  for (const p of phrases.map(trimRestart)) {
    if (normWords(p).length === 0) droppedSpans.push({ start: p.start, end: p.end });
    else cleaned.push(p);
  }

  // Pass 1: collapse runs of consecutive same-line phrases, keeping the last.
  const pass1: Phrase[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let end = i;
    while (
      end + 1 < cleaned.length &&
      end + 1 - i < opts.window &&
      sameLine(cleaned[end]!, cleaned[end + 1]!, opts)
    ) {
      end++;
    }
    if (end > i) {
      for (let k = i; k < end; k++) droppedSpans.push({ start: cleaned[k]!.start, end: cleaned[k]!.end });
      clusters++;
    }
    pass1.push(cleaned[end]!);
    i = end + 1;
  }

  // Pass 2: prefix-restart collapse. When an *incomplete* phrase's opening
  // words reappear as the start of a later phrase, the speaker abandoned that
  // take and restarted — drop the abandoned fragment(s) up to the restart.
  // Also handles a trailed-off take whose only extra is a stray trailing word
  // (e.g. "...questions to" restarting as "...questions ...").
  const pass2: Phrase[] = [];
  i = 0;
  while (i < pass1.length) {
    let restartTo = -1;
    if (isIncomplete(pass1[i]!)) {
      const ni = normWords(pass1[i]!);
      for (let j = i + 1; j < pass1.length && j - i <= opts.window; j++) {
        const nj = normWords(pass1[j]!);
        const lead = sharedPrefix(ni, nj);
        const fullPrefix = ni.length <= nj.length && ni.every((t, k) => nj[k] === t);
        const trailedOff = lead >= ni.length - 1 && lead >= 3;
        if ((fullPrefix && ni.length >= opts.minPrefix) || trailedOff) restartTo = j;
      }
    }
    if (restartTo >= 0) {
      for (let k = i; k < restartTo; k++) droppedSpans.push({ start: pass1[k]!.start, end: pass1[k]!.end });
      clusters++;
      i = restartTo;
    } else {
      pass2.push(pass1[i]!);
      i++;
    }
  }

  // Pass 3: dedup the survivors — a phrase is dropped when a nearby phrase is an
  // exact LATER duplicate (keep the last) or a strictly fuller take that contains
  // this short fragment. Catches non-adjacent repeats the linear passes miss.
  const norms = pass2.map(normWords);
  const drop: boolean[] = pass2.map(() => false);
  for (let a = 0; a < pass2.length; a++) {
    const na = norms[a]!;
    const lo = Math.max(0, a - opts.window);
    const hi = Math.min(pass2.length - 1, a + opts.window);
    for (let b = lo; b <= hi; b++) {
      if (b === a || drop[b]) continue;
      const nb = norms[b]!;
      const exactLaterDup = b > a && na.length > 0 && na.length === nb.length && na.every((t, k) => nb[k] === t);
      // A swallowed false-start fragment must be at least two words. A lone word
      // that merely reappears inside a neighbouring sentence (e.g. "plan." next
      // to "...implementation plan.") is almost always a distinct utterance, not
      // a fragment of that take — dropping it silently deletes real speech.
      // Genuine single-word retakes are still handled by exactLaterDup above.
      const fragmentInFuller =
        na.length >= 2 && na.length <= 6 && nb.length > na.length && isContiguousSub(na, nb);
      if (exactLaterDup || fragmentInFuller) {
        drop[a] = true;
        break;
      }
    }
  }
  const kept: Phrase[] = [];
  pass2.forEach((p, idx) => {
    if (drop[idx]) {
      droppedSpans.push({ start: p.start, end: p.end });
      clusters++;
    } else {
      kept.push(p);
    }
  });

  return { kept, droppedSpans, clusters };
}
