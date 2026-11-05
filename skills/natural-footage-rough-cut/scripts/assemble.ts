// assemble.ts — edit.json + prepare.json → CutPlan.
//
// Applies the two mechanical rules the editor doesn't decide by hand:
//  - fillers: dropped only where the cut hides (span edge, or beside a pause);
//  - pauses: natural pauses kept, only long dead air shortened (spec §5.4).
// Air always comes from the real footage: a clip edge is extended into the
// recorded silence, clamped so it never reaches a neighbouring word.
import type { EditFile, Span } from "./edit.js";
import type { Prepared, PreparedWord } from "./prepared.js";
import { placeSegments } from "./xml.js";
import type { ClipSegment, CutPlan, PartSource, Segment } from "./types.js";

export interface PauseRules {
  /** Sentence pauses up to this many seconds are kept as recorded. */
  keepUpTo: number;
  /** Longer sentence pauses are shortened to this. */
  longTo: number;
  /** Mid-sentence pauses longer than this are shortened… */
  midOver: number;
  /** …to this. */
  midTo: number;
  /** Air at a join across removed material, after a sentence end. */
  joinSentence: number;
  /** Air at a join across removed material, mid-sentence. */
  joinMid: number;
  /** Black gap between sections (≥ 1.5 s: mg-setup reads these as chapters). */
  sectionGap: number;
  /** Lead-in before a section's first word / tail after its last word. */
  edgeLead: number;
  edgeTrail: number;
}

export const DEFAULT_PAUSES: PauseRules = {
  keepUpTo: 1.0,
  longTo: 0.7,
  midOver: 0.6,
  midTo: 0.3,
  joinSentence: 0.5,
  joinMid: 0.3,
  sectionGap: 2.0,
  edgeLead: 0.12,
  edgeTrail: 0.25,
};

/** Minimum distance kept from a neighbouring word's audio. */
const GUARD = 0.02;
/** A filler next to a gap at least this long is cut (the cut hides in the pause). */
const FILLER_PAUSE = 0.25;
const FILLERS = new Set(["um", "uh", "uhm", "umm", "erm", "er", "ah", "hmm", "mm"]);

function isFiller(w: PreparedWord): boolean {
  return FILLERS.has(w.text.toLowerCase().replace(/[^a-z]/g, ""));
}

function endsSentence(w: PreparedWord): boolean {
  return /[.?!]["”']?$/.test(w.text);
}

/**
 * Drop fillers where the cut hides naturally: at the span's edges, or beside a
 * pause ≥ FILLER_PAUSE. Fillers tight inside a sentence stay (a cut there is a
 * visible jump). Returns the remaining contiguous runs.
 */
export function trimFillers(words: PreparedWord[], allWords: PreparedWord[]): PreparedWord[][] {
  const keep = words.map(() => true);
  let a = 0;
  while (a < words.length && isFiller(words[a]!)) keep[a++] = false;
  let b = words.length - 1;
  while (b >= a && isFiller(words[b]!)) keep[b--] = false;
  for (let k = a; k <= b; k++) {
    const w = words[k]!;
    if (!isFiller(w)) continue;
    const prev = allWords[w.i - 1];
    const next = allWords[w.i + 1];
    const gapBefore = prev ? w.start - prev.end : Infinity;
    const gapAfter = next ? next.start - w.end : Infinity;
    if (gapBefore >= FILLER_PAUSE || gapAfter >= FILLER_PAUSE) keep[k] = false;
  }
  const runs: PreparedWord[][] = [];
  let cur: PreparedWord[] = [];
  words.forEach((w, k) => {
    if (keep[k]) cur.push(w);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  });
  if (cur.length) runs.push(cur);
  return runs;
}

interface Piece {
  part: number; // 1-based
  words: PreparedWord[];
  lead: number;
  trail: number;
}

/** Air wanted between two adjacent pieces of footage, or null to keep them in one clip. */
function airBetween(prev: PreparedWord, next: PreparedWord, contiguous: boolean, r: PauseRules): number | null {
  const sentence = endsSentence(prev);
  if (!contiguous) return sentence ? r.joinSentence : r.joinMid;
  const g = next.start - prev.end;
  if (sentence) return g <= r.keepUpTo ? null : r.longTo;
  return g > r.midOver ? r.midTo : null;
}

export function assemble(
  edit: EditFile,
  prep: Prepared,
  parts: PartSource[],
  rules: PauseRules = DEFAULT_PAUSES,
): { plan: CutPlan; callFrames: Map<number, number> } {
  const partIndex = (n: number) => prep.parts.findIndex((p) => p.part === n);
  const wordsOf = (n: number) => prep.parts[partIndex(n)]!.words;

  const sectionPieces: Array<{ section: number; pieces: Piece[] }> = [];
  for (const sec of edit.sections) {
    const pieces: Piece[] = [];
    let last: { part: number; word: PreparedWord } | null = null;
    for (const span of sec.spans) {
      const all = wordsOf(span.part);
      for (const run of trimFillers(all.slice(span.from, span.to + 1), all)) {
        for (const w of run) {
          if (!last) {
            pieces.push({ part: span.part, words: [w], lead: rules.edgeLead, trail: 0 });
          } else {
            const contiguous = last.part === span.part && w.i === last.word.i + 1;
            const air = airBetween(last.word, w, contiguous, rules);
            if (air === null) {
              pieces[pieces.length - 1]!.words.push(w);
            } else {
              const prevPiece = pieces[pieces.length - 1]!;
              const next: Piece = { part: span.part, words: [w], lead: 0, trail: 0 };
              splitAir(prevPiece, next, air, prep);
              pieces.push(next);
            }
          }
          last = { part: span.part, word: w };
        }
      }
    }
    if (pieces.length) {
      pieces[pieces.length - 1]!.trail = rules.edgeTrail;
      sectionPieces.push({ section: sec.section, pieces });
    }
  }

  const segments: Segment[] = [];
  sectionPieces.forEach(({ section, pieces }, k) => {
    if (k > 0) segments.push({ kind: "black", duration: rules.sectionGap, beatIndex: section - 1 });
    for (const p of pieces) segments.push(toClip(p, section, prep, partIndex(p.part)));
  });

  const base = parts[0]!.info;
  const draft: CutPlan = { parts, segments, fps: base.fps, width: base.width, height: base.height, totalDuration: 0 };
  const { clips, totalFrames } = placeSegments(draft);
  const plan: CutPlan = { ...draft, totalDuration: totalFrames / base.fps };

  // Marker = the frame where the call's first kept word plays (even mid-clip);
  // nudged forward when two calls land on one frame (Resolve allows one marker per frame).
  const callFrames = new Map<number, number>();
  const taken = new Set<number>();
  for (const call of edit.calls) {
    for (const c of clips) {
      if (prep.parts[c.seg.part]!.part !== call.kept.part) continue;
      const w = c.seg.words.find((x) => wordIndexIn(x, call.kept, prep));
      if (!w) continue;
      let frame = c.recStart + Math.max(0, Math.round((w.start - c.seg.start) * base.fps));
      while (taken.has(frame)) frame++;
      taken.add(frame);
      callFrames.set(call.id, frame);
      break;
    }
  }
  return { plan, callFrames };
}

/** Is a clip word (source-timed) inside a span? Matched by start time within the span's part. */
function wordIndexIn(w: { start: number }, span: Span, prep: Prepared): boolean {
  const part = prep.parts.find((p) => p.part === span.part)!;
  const from = part.words[span.from];
  const to = part.words[span.to];
  return !!from && !!to && w.start >= from.start - 1e-6 && w.start <= to.start + 1e-6;
}

/** Share `air` between prev's tail and next's lead, each clamped to its real silence. */
function splitAir(prev: Piece, next: Piece, air: number, prep: Prepared): void {
  const tailRoom = room(prev, "after", prep);
  const leadRoom = room(next, "before", prep);
  prev.trail = Math.min(tailRoom, Math.max(air / 2, air - leadRoom));
  next.lead = Math.min(leadRoom, air - prev.trail);
}

/** Recorded silence available before/after a piece, minus a guard. */
function room(p: Piece, side: "before" | "after", prep: Prepared): number {
  const part = prep.parts.find((x) => x.part === p.part)!;
  if (side === "before") {
    const first = p.words[0]!;
    const prevWord = part.words[first.i - 1];
    return Math.max(0, first.start - (prevWord ? prevWord.end : 0) - GUARD);
  }
  const last = p.words[p.words.length - 1]!;
  const nextWord = part.words[last.i + 1];
  return Math.max(0, (nextWord ? nextWord.start : part.info.duration) - last.end - GUARD);
}

function toClip(p: Piece, section: number, prep: Prepared, idx: number): ClipSegment {
  const first = p.words[0]!;
  const last = p.words[p.words.length - 1]!;
  const lead = Math.min(p.lead, room(p, "before", prep));
  const trail = Math.min(p.trail, room(p, "after", prep));
  return {
    kind: "clip",
    part: idx,
    start: first.start - lead,
    end: last.end + trail,
    words: p.words.map((w) => ({ text: w.text, start: w.start, end: w.end, type: "word" as const })),
    note: p.words.map((w) => w.text).join(" "),
    beatIndex: section - 1,
  };
}
