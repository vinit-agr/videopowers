// align.ts — match spoken phrases (across all parts, in recording order) to
// the script's sentences, then decide retakes against the SCRIPT rather than
// take-vs-take similarity.
//
// Why script-anchored: take-vs-take matching misses paraphrased retakes (two
// takes that reword each other by >25%) and can false-positive on genuinely
// similar neighbouring lines. Matching each take against the script kills
// both failure modes: two takes of one script sentence both match that
// sentence no matter how differently they're worded, and two similar takes of
// two DIFFERENT script sentences never merge.

import type { Phrase } from "./types.js";
import type { ScriptModel } from "./script.js";
import { normTokens } from "./script.js";
import { DEFAULT_RETAKE_OPTIONS, sameLine } from "./retakes.js";

export interface AlignOptions {
  /** Similarity at/above which a phrase counts as matched to a span. */
  matchThreshold: number;
  /** Matched-but-flag-for-review band upper bound. */
  confidentThreshold: number;
  /** How many sentences behind the cursor a match may start (retake reach). */
  back: number;
  /** How many sentences ahead of the cursor a match may start (skip reach). */
  forward: number;
  /** Max sentences one phrase may span. */
  maxSpan: number;
  /** After this many consecutive unmatched phrases, search the WHOLE script. */
  resyncAfter: number;
  /** Similarity a whole-script resync match must reach. */
  resyncThreshold: number;
  /** Phrases with fewer tokens than this need shortPhraseThreshold to match. */
  shortPhraseTokens: number;
  shortPhraseThreshold: number;
  /** A match jumping the cursor backward by more than this many sentences… */
  farBackJump: number;
  /** …must reach this similarity (guards against spurious back-matches). */
  farBackThreshold: number;
}

export const DEFAULT_ALIGN_OPTIONS: AlignOptions = {
  matchThreshold: 0.55,
  confidentThreshold: 0.75,
  back: 20,
  forward: 12,
  maxSpan: 4,
  resyncAfter: 6,
  resyncThreshold: 0.68,
  shortPhraseTokens: 3,
  shortPhraseThreshold: 0.85,
  farBackJump: 6,
  farBackThreshold: 0.75,
};

/** A phrase from one part, in global recording order. */
export interface SourcePhrase {
  phrase: Phrase;
  /** Index into the project's parts array. */
  part: number;
}

export interface AlignedPhrase extends SourcePhrase {
  /** Global recording-order index. */
  order: number;
  /** Inclusive sentence-index span [first, last]; null = ad-lib/off-script. */
  span: [number, number] | null;
  similarity: number;
  lowConfidence: boolean;
  dropped: boolean;
  dropReason: string | null;
  /** Recording-order index of the surviving take that superseded this one. */
  droppedBy: number | null;
}

export interface AlignResult {
  phrases: AlignedPhrase[];
  kept: AlignedPhrase[];
  retakeClusters: number;
  adLibs: number;
  lowConfidence: number;
}

interface WindowMatch {
  /** 1 - (edit distance of phrase to best substring of span) / phrase length */
  similarity: number;
  /** Matched token window [start, end) within the span's token array. */
  winStart: number;
  winEnd: number;
}

/**
 * Word-level approximate-substring match: how well do the phrase tokens match
 * SOME contiguous window of the span tokens? Free deletions at the span's
 * edges (classic approximate string matching), so a half-sentence fragment
 * still scores ~1.0 against its sentence.
 */
export function matchInSpan(phraseTokens: string[], spanTokens: string[]): WindowMatch {
  const n = phraseTokens.length;
  const m = spanTokens.length;
  if (n === 0 || m === 0) return { similarity: 0, winStart: 0, winEnd: 0 };

  // dp[i][j] = min edits to match phrase[0..i) ending at span position j,
  // with the window start tracked alongside.
  let prev = new Array<number>(m + 1).fill(0);
  let prevStart = Array.from({ length: m + 1 }, (_, j) => j);
  let cur = new Array<number>(m + 1).fill(0);
  let curStart = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    curStart[0] = 0;
    for (let j = 1; j <= m; j++) {
      const sub = prev[j - 1]! + (phraseTokens[i - 1] === spanTokens[j - 1] ? 0 : 1);
      const del = prev[j]! + 1; // skip a phrase token
      const ins = cur[j - 1]! + 1; // skip a span token inside the window
      let best = sub;
      let start = prevStart[j - 1]!;
      if (del < best) { best = del; start = prevStart[j]!; }
      if (ins < best) { best = ins; start = curStart[j - 1]!; }
      cur[j] = best;
      curStart[j] = start;
    }
    [prev, cur] = [cur, prev];
    [prevStart, curStart] = [curStart, prevStart];
  }

  let bestJ = 0;
  for (let j = 1; j <= m; j++) if (prev[j]! < prev[bestJ]!) bestJ = j;
  const dist = prev[bestJ]!;
  return {
    similarity: Math.max(0, 1 - dist / n),
    winStart: prevStart[bestJ]!,
    winEnd: bestJ,
  };
}

interface SpanMatch {
  span: [number, number];
  similarity: number;
}

/**
 * Find the best sentence span for a phrase within the cursor window.
 *
 * matchInSpan allows free deletions at the span's edges, so ANY span that
 * contains the truly-spoken sentences scores just as high as the tight one.
 * To keep spans honest, the winning candidate is TRIMMED to the sentences
 * its matched token window actually touches before being returned.
 */
function bestSpan(
  tokens: string[],
  script: ScriptModel,
  cursor: number,
  opts: AlignOptions,
): SpanMatch | null {
  const M = script.sentences.length;
  const lo = Math.max(0, cursor - opts.back);
  const hi = Math.min(M - 1, cursor + opts.forward);
  return bestSpanInRange(tokens, script, lo, hi, cursor, opts);
}

/** bestSpan over an explicit sentence index range. */
function bestSpanInRange(
  tokens: string[],
  script: ScriptModel,
  lo: number,
  hi: number,
  cursor: number,
  opts: AlignOptions,
): SpanMatch | null {
  const M = script.sentences.length;
  let best: (SpanMatch & { winStart: number; winEnd: number; offsets: number[] }) | null = null;
  for (let s = lo; s <= hi; s++) {
    let spanTokens: string[] = [];
    const offsets: number[] = [];
    let prevSim = -1;
    for (let e = s; e < Math.min(M, s + opts.maxSpan); e++) {
      offsets.push(spanTokens.length);
      spanTokens = spanTokens.concat(script.sentences[e]!.tokens);
      const m = matchInSpan(tokens, spanTokens);
      // Greedy extension: stop growing once adding a sentence stops helping.
      if (m.similarity < prevSim + 0.02 && e > s) break;
      prevSim = Math.max(prevSim, m.similarity);
      const better =
        !best ||
        m.similarity > best.similarity + 1e-9 ||
        (Math.abs(m.similarity - best.similarity) <= 1e-9 &&
          Math.abs(s - cursor) < Math.abs(best.span[0] - cursor));
      if (better) {
        best = { span: [s, e], similarity: m.similarity, winStart: m.winStart, winEnd: m.winEnd, offsets: [...offsets] };
      }
    }
  }
  if (!best) return null;
  // Trim to sentences the matched window overlaps.
  const { span, winStart, winEnd, offsets } = best;
  let first = span[0];
  let last = span[0];
  for (let k = 0; k < offsets.length; k++) {
    if (offsets[k]! <= winStart) first = span[0] + k;
    if (offsets[k]! < winEnd) last = span[0] + k;
  }
  if (last < first) last = first;
  return { span: [first, last], similarity: best.similarity };
}

/**
 * Align phrases to the script and mark retakes (keep-LAST per script span).
 *
 * A matched phrase is dropped when every sentence it covers is spoken again
 * by a LATER phrase that is a re-take (not a continuation) of it. An ad-lib
 * phrase is dropped when it immediately follows a dropped phrase (abandoned-
 * take debris: "okay, wait—", a sigh transcribed as words, etc.).
 */
export function alignToScript(
  sourcePhrases: SourcePhrase[],
  script: ScriptModel,
  opts: AlignOptions = DEFAULT_ALIGN_OPTIONS,
): AlignResult {
  const phrases: AlignedPhrase[] = [];
  let cursor = 0;
  let unmatchedRun = 0;

  const accept = (m: SpanMatch | null, tokens: string[]): boolean => {
    if (!m) return false;
    let needed = opts.matchThreshold;
    if (tokens.length < opts.shortPhraseTokens) needed = Math.max(needed, opts.shortPhraseThreshold);
    if (cursor - m.span[1] > opts.farBackJump) needed = Math.max(needed, opts.farBackThreshold);
    return m.similarity >= needed;
  };

  for (let i = 0; i < sourcePhrases.length; i++) {
    const sp = sourcePhrases[i]!;
    const tokens = normTokens(sp.phrase.text);
    let m = tokens.length > 0 ? bestSpan(tokens, script, cursor, opts) : null;
    let matched = accept(m, tokens);

    // Resync: after a run of unmatched phrases the cursor may simply be lost
    // (a stretch of heavy ad-lib, or an earlier bad match). Search the whole
    // script; accept only a confident hit, and move the cursor there.
    if (!matched && tokens.length >= opts.shortPhraseTokens && unmatchedRun >= opts.resyncAfter) {
      const wide: AlignOptions = { ...opts, back: script.sentences.length, forward: script.sentences.length };
      const g = bestSpan(tokens, script, cursor, wide);
      if (g && g.similarity >= opts.resyncThreshold) {
        m = g;
        matched = true;
      }
    }

    phrases.push({
      ...sp,
      order: i,
      span: matched && m ? m.span : null,
      similarity: m?.similarity ?? 0,
      lowConfidence: matched && m !== null && m.similarity < opts.confidentThreshold,
      dropped: false,
      dropReason: null,
      droppedBy: null,
    });
    if (matched && m) {
      cursor = Math.max(cursor, m.span[1]);
      unmatchedRun = 0;
    } else {
      unmatchedRun++;
    }
  }

  // Beat-excursion smoothing: beats are recorded strictly in order, so a
  // short run of matches that jumps into a different beat and RETURNS is a
  // mismatch (similar wording in a neighbouring beat), never real structure.
  // Re-match such runs inside the surrounding beat; failures become ad-libs.
  // Without this, one oscillation plants two spurious black beat gaps.
  const matched = phrases.filter((p) => p.span);
  const beatIdx = (p: AlignedPhrase): number => script.sentences[p.span![0]]!.beatIndex;
  interface Run { beat: number; members: AlignedPhrase[] }
  const runs: Run[] = [];
  for (const p of matched) {
    const b = beatIdx(p);
    const last = runs[runs.length - 1];
    if (last && last.beat === b) last.members.push(p);
    else runs.push({ beat: b, members: [p] });
  }
  const MAX_EXCURSION = 8;
  for (let r = 1; r < runs.length; r++) {
    const prevRun = runs[r - 1]!;
    const run = runs[r]!;
    const nextRun = runs[r + 1];
    const returns = nextRun !== undefined && nextRun.beat === prevRun.beat;
    const tailRegression = nextRun === undefined && run.beat < prevRun.beat;
    if (run.members.length > MAX_EXCURSION || (!returns && !tailRegression)) continue;
    const home = script.beats[prevRun.beat]!;
    const lo = home.sentences[0]!.index;
    const hi = home.sentences[home.sentences.length - 1]!.index;
    const anchor = prevRun.members[prevRun.members.length - 1]!.span![1];
    for (const p of run.members) {
      const tokens = normTokens(p.phrase.text);
      const m = bestSpanInRange(tokens, script, lo, hi, anchor, opts);
      const needed =
        tokens.length < opts.shortPhraseTokens
          ? Math.max(opts.matchThreshold, opts.shortPhraseThreshold)
          : opts.matchThreshold;
      if (m && m.similarity >= needed) {
        p.span = m.span;
        p.similarity = m.similarity;
        p.lowConfidence = m.similarity < opts.confidentThreshold;
      } else {
        p.span = null;
        p.lowConfidence = false;
      }
    }
    if (nextRun && run.members.every((p) => p.span === null || beatIdx(p) === prevRun.beat)) {
      // Merge the healed region so later excursions compare against the
      // stable surrounding beat, not the healed one.
      prevRun.members.push(...run.members.filter((p) => p.span), ...nextRun.members);
      runs.splice(r, 2);
      r--;
    }
  }

  // ------------------------------------------------------------------
  // Drop decisions. Design principle (Vinit, 2026-09-19): losing real
  // content is expensive, keeping a stray retake is cheap. Script evidence
  // ALONE is never sufficient to delete anything — every drop needs the
  // corroboration a human editor would use:
  //   locality    — retakes happen within seconds (or across a crash-split
  //                 part boundary), never minutes apart. A line re-spoken
  //                 far away is a deliberate repetition and is kept.
  //   confidence  — only a strongly script-matched later take can supersede.
  //   containment — the surviving material must actually re-speak the
  //                 victim's words (70% of its unique tokens), so a tail
  //                 fragment or a mismatched stranger can't erase a take.
  //   size        — phrases under 4 tokens are never dropped by span logic
  //                 (one-word phrases match anything at sim 1.0).
  // ------------------------------------------------------------------
  let retakeClusters = 0;
  const LOCALITY_SECONDS = 45;
  const CROSS_PART_ORDER_REACH = 12;
  const KILLER_MIN_SIM = 0.75;
  const MIN_KILL_TOKENS = 4;
  const CONTAINMENT = 0.7;

  const tokensOf = phrases.map((p) => normTokens(p.phrase.text));
  const isLocal = (a: AlignedPhrase, b: AlignedPhrase): boolean => {
    if (b.part === a.part) {
      const dt = b.phrase.start - a.phrase.end;
      return dt >= -1 && dt <= LOCALITY_SECONDS;
    }
    return b.part === a.part + 1 && b.order - a.order <= CROSS_PART_ORDER_REACH;
  };
  const spansOverlap = (x: [number, number], y: [number, number]): boolean =>
    x[0] <= y[1] && y[0] <= x[1];

  for (const a of phrases) {
    if (!a.span) continue;
    const aTokens = tokensOf[a.order]!;
    if (aTokens.length < MIN_KILL_TOKENS) continue;
    const killers = phrases.filter(
      (b) =>
        b.order > a.order &&
        b.span &&
        b.similarity >= KILLER_MIN_SIM &&
        tokensOf[b.order]!.length >= MIN_KILL_TOKENS &&
        spansOverlap(a.span!, b.span) &&
        isLocal(a, b),
    );
    if (killers.length === 0) continue;
    const spoken = new Set<string>();
    for (const k of killers) for (const t of tokensOf[k.order]!) spoken.add(t);
    const unique = [...new Set(aTokens)];
    const covered = unique.filter((t) => spoken.has(t)).length / unique.length;
    if (covered >= CONTAINMENT) {
      a.dropped = true;
      a.dropReason = "retake (script-anchored keep-last)";
      a.droppedBy = killers[killers.length - 1]!.order;
      retakeClusters++;
    }
  }

  // Off-script retakes: take-vs-take matching, ONLY between phrases that are
  // BOTH unmatched (the script has adjudicated anything matched) and local.
  {
    const active = phrases.filter((p) => !p.dropped);
    for (let i = 0; i < active.length; i++) {
      const a = active[i]!;
      if (a.span) continue;
      for (let j = i + 1; j <= Math.min(active.length - 1, i + DEFAULT_RETAKE_OPTIONS.window); j++) {
        const b = active[j]!;
        if (b.span || !isLocal(a, b)) continue;
        if (sameLine(a.phrase, b.phrase, DEFAULT_RETAKE_OPTIONS)) {
          a.dropped = true;
          a.dropReason = "retake (take-vs-take, off-script)";
          a.droppedBy = b.order;
          retakeClusters++;
          break;
        }
      }
    }
  }

  // Ad-lib debris: a SHORT unmatched phrase seconds after a dropped phrase in
  // the same part is abandoned-take junk ("okay, wait—", a stray "Thank you.").
  const DEBRIS_MAX_TOKENS = 5;
  const DEBRIS_MAX_GAP_S = 3;
  for (let i = 0; i < phrases.length; i++) {
    const p = phrases[i]!;
    if (p.span || p.dropped) continue;
    if (normTokens(p.phrase.text).length > DEBRIS_MAX_TOKENS) continue;
    const prev = phrases[i - 1];
    if (
      prev &&
      prev.dropped &&
      prev.part === p.part &&
      p.phrase.start - prev.phrase.end <= DEBRIS_MAX_GAP_S
    ) {
      p.dropped = true;
      p.dropReason = "debris after dropped take";
      p.droppedBy = prev.droppedBy;
    }
  }

  const kept = phrases.filter((p) => !p.dropped);
  return {
    phrases,
    kept,
    retakeClusters,
    adLibs: phrases.filter((p) => !p.span).length,
    lowConfidence: phrases.filter((p) => p.lowConfidence && !p.dropped).length,
  };
}

/**
 * Effective script position of a kept phrase for boundary typing: ad-libs
 * inherit the nearest MATCHED neighbour before them (or after, at the start).
 */
export function effectiveSpans(kept: AlignedPhrase[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let lastKnown: [number, number] | null = null;
  const firstKnown = kept.find((p) => p.span)?.span ?? [0, 0];
  for (const p of kept) {
    if (p.span) lastKnown = p.span;
    out.push(p.span ?? lastKnown ?? (firstKnown as [number, number]));
  }
  return out;
}
