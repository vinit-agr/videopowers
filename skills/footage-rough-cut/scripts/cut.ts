// cut.ts — turn aligned, retake-cleaned phrases into the rough-cut segment
// list, with air at each join sized by the SCRIPT hierarchy rather than by
// how long the recorded pause was (recorded pauses are dominated by script
// re-reading between takes, so their length is noise):
//
//   intra     two fragments of one sentence     → tight join (~0.1s)
//   sentence  new sentence, same paragraph      → keep ~0.5s of real footage
//   concept   new paragraph, same beat          → keep ~1.0s of real footage
//   beat      new beat (or new part = new beat) → 2s black + silence insert
//
// Kept air is always the speaker's real footage (room tone, breath) trimmed
// down to the budget — never stretched, never synthesized — except the beat
// gap, which is deliberately black. When the real gap between two phrases is
// already within budget and nothing was cut inside it, the footage is left
// UNCUT (merged), avoiding a needless jump cut.

import type {
  BoundaryType,
  ClipSegment,
  CutPlan,
  Interval,
  PartSource,
  PauseBudgets,
  Segment,
  Word,
} from "./types.js";
import type { AlignedPhrase } from "./align.js";
import { effectiveSpans } from "./align.js";
import type { ScriptModel } from "./script.js";

export const DEFAULT_BUDGETS: PauseBudgets = { sentence: 0.15, concept: 0.35, beat: 2.0 };

/** Tight-join pads for intra-sentence cuts (same feel as the old cleanup). */
const INTRA_LEAD = 0.05;
const INTRA_TRAIL = 0.08;
/** Real-footage pads flanking a black beat gap. */
const BEAT_TRAIL = 0.3;
const BEAT_LEAD = 0.2;
/** Merge slack: an uncut gap may exceed the budget by this much. */
const MERGE_SLACK = 0.25;

export interface BoundaryInfo {
  type: BoundaryType;
  /** Air the output actually has at this join (s); black gap for beats. */
  keptAir: number;
  /** True when the original footage was left uncut across the join. */
  merged: boolean;
}

export interface BuildCutParams {
  parts: PartSource[];
  /** Kept phrases in output order. */
  kept: AlignedPhrase[];
  script: ScriptModel;
  /** Per-part spoken words (post silence-clamp) for real-silence bounds. */
  partWords: Word[][];
  /** Per-part dropped intervals (retakes + fillers) — merging must not skip over them. */
  droppedByPart: Interval[][];
  budgets: PauseBudgets;
}

export interface BuildCutResult {
  plan: CutPlan;
  boundaries: BoundaryInfo[];
  /** Kept phrases that re-speak a sentence an earlier kept phrase also covers. */
  overlapWarnings: string[];
}

/** Real silence after `t` in a part: gap until the next spoken word starts. */
function availTrail(words: Word[], t: number, partEnd: number): number {
  for (const w of words) {
    if (w.type !== "word") continue;
    if (w.start >= t - 1e-3) return Math.max(0, w.start - t);
  }
  return Math.max(0, partEnd - t);
}

/** Real silence before `t` in a part: gap since the previous word ended. */
function availLead(words: Word[], t: number): number {
  let prevEnd = 0;
  for (const w of words) {
    if (w.type !== "word") continue;
    if (w.end <= t + 1e-3) prevEnd = Math.max(prevEnd, w.end);
    else break;
  }
  return Math.max(0, t - prevEnd);
}

function anyDroppedWithin(dropped: Interval[], lo: number, hi: number): boolean {
  return dropped.some((d) => d.end > lo + 1e-3 && d.start < hi - 1e-3);
}

export function classifyBoundary(
  a: AlignedPhrase,
  b: AlignedPhrase,
  spanA: [number, number],
  spanB: [number, number],
  script: ScriptModel,
): BoundaryType {
  const sentA = script.sentences[Math.min(spanA[1], script.sentences.length - 1)]!;
  const sentB = script.sentences[Math.min(spanB[0], script.sentences.length - 1)]!;
  let type: BoundaryType;
  if (spanA[1] === spanB[0] && a.span && b.span) type = "intra";
  else if (sentA.beatIndex !== sentB.beatIndex) type = "beat";
  else if (sentA.paragraphIndex !== sentB.paragraphIndex) type = "concept";
  else type = "sentence";
  // A new recording part mid-beat is a crash-split: the join needs concept
  // air (the speaker re-set), even when the script says mid-paragraph.
  if (a.part !== b.part && type !== "beat" && type !== "intra") type = "concept";
  return type;
}

/** Majority resolution across parts (ties → the earliest part's). */
function targetResolution(parts: PartSource[]): { width: number; height: number } {
  const counts = new Map<string, { n: number; w: number; h: number; first: number }>();
  parts.forEach((p, i) => {
    const key = `${p.info.width}x${p.info.height}`;
    const e = counts.get(key) ?? { n: 0, w: p.info.width, h: p.info.height, first: i };
    e.n++;
    counts.set(key, e);
  });
  const best = [...counts.values()].sort((a, b) => b.n - a.n || a.first - b.first)[0]!;
  return { width: best.w, height: best.h };
}

export function buildCut(params: BuildCutParams): BuildCutResult {
  const { parts, kept, script, partWords, droppedByPart, budgets } = params;
  const spans = effectiveSpans(kept);
  const segments: Segment[] = [];
  const boundaries: BoundaryInfo[] = [];
  const overlapWarnings: string[] = [];
  let current: ClipSegment | null = null;

  const partEnd = (i: number): number => parts[i]!.info.duration;
  const beatOf = (span: [number, number]): number =>
    script.sentences[Math.min(span[0], script.sentences.length - 1)]?.beatIndex ?? -1;

  // Warn when two kept phrases still share a sentence (partial retake overlap
  // the keep-last rule could not resolve without mid-phrase trimming).
  for (let i = 1; i < kept.length; i++) {
    const a = kept[i - 1]!;
    const b = kept[i]!;
    if (a.span && b.span && a.span[1] === b.span[0]) {
      const s = script.sentences[a.span[1]]!;
      overlapWarnings.push(
        `sentence ${s.index} ("${s.text.slice(0, 60)}") is touched by two kept takes — ` +
          `verify the join at part ${parts[b.part]!.path.split("/").pop()} ${b.phrase.start.toFixed(1)}s`,
      );
    }
  }

  for (let i = 0; i < kept.length; i++) {
    const p = kept[i]!;
    const words = partWords[p.part]!;
    const pStart = p.phrase.start;
    const pEnd = p.phrase.end;

    if (i === 0) {
      const lead = Math.min(0.25, availLead(words, pStart));
      current = {
        kind: "clip",
        part: p.part,
        start: Math.max(0, pStart - lead),
        end: pEnd,
        words: [...p.phrase.words],
        note: p.phrase.text,
        beatIndex: beatOf(spans[i]!),
      };
      continue;
    }

    const prev = kept[i - 1]!;
    const type = classifyBoundary(prev, p, spans[i - 1]!, spans[i]!, script);
    const prevWords = partWords[prev.part]!;
    const trailAvail = availTrail(prevWords, prev.phrase.end, partEnd(prev.part));
    const leadAvail = availLead(words, pStart);

    if (type === "beat") {
      const trail = Math.min(BEAT_TRAIL, trailAvail);
      current!.end = prev.phrase.end + trail;
      segments.push(current!);
      segments.push({ kind: "black", duration: budgets.beat, beatIndex: beatOf(spans[i]!) });
      boundaries.push({ type, keptAir: budgets.beat, merged: false });
      const lead = Math.min(BEAT_LEAD, leadAvail);
      current = {
        kind: "clip",
        part: p.part,
        start: Math.max(0, pStart - lead),
        end: pEnd,
        words: [...p.phrase.words],
        note: p.phrase.text,
        beatIndex: beatOf(spans[i]!),
      };
      continue;
    }

    const budget = type === "intra" ? INTRA_LEAD + INTRA_TRAIL : budgets[type];
    const gap = prev.part === p.part ? pStart - prev.phrase.end : Infinity;
    const canMerge =
      prev.part === p.part &&
      gap <= budget + MERGE_SLACK &&
      !anyDroppedWithin(droppedByPart[p.part]!, prev.phrase.end, pStart);

    if (canMerge && current) {
      current.end = pEnd;
      current.words.push(...p.phrase.words);
      current.note += ` ${p.phrase.text}`;
      boundaries.push({ type, keptAir: Math.max(0, gap), merged: true });
      continue;
    }

    // Cut: split the budget between the outgoing trail and incoming lead,
    // never keeping more air than real silence provides on each side. On a
    // same-file cut the two pads draw from ONE physical gap, so they must
    // also (a) never overlap each other (that would duplicate footage) and
    // (b) never cross into dropped material inside the gap.
    const wantTrail = type === "intra" ? INTRA_TRAIL : budget * 0.6;
    let trailMax = trailAvail;
    let leadMax = leadAvail;
    let gapTotal = Infinity;
    if (prev.part === p.part) {
      gapTotal = Math.max(0, pStart - prev.phrase.end);
      const inside = droppedByPart[p.part]!.filter(
        (d) => d.end > prev.phrase.end + 1e-3 && d.start < pStart - 1e-3,
      );
      const firstDrop = inside.length > 0 ? Math.min(...inside.map((d) => d.start)) : Infinity;
      const lastDrop = inside.length > 0 ? Math.max(...inside.map((d) => d.end)) : -Infinity;
      trailMax = Math.min(trailMax, gapTotal, Math.max(0, firstDrop - prev.phrase.end));
      leadMax = Math.min(leadMax, gapTotal, inside.length > 0 ? Math.max(0, pStart - lastDrop) : gapTotal);
    }
    const trail = Math.min(wantTrail, trailMax);
    const lead = Math.min(budget - trail, leadMax, gapTotal - trail);
    current!.end = Math.min(prev.phrase.end + trail, partEnd(prev.part));
    segments.push(current!);
    boundaries.push({ type, keptAir: trail + lead, merged: false });
    current = {
      kind: "clip",
      part: p.part,
      start: Math.max(0, pStart - lead),
      end: pEnd,
      words: [...p.phrase.words],
      note: p.phrase.text,
      beatIndex: beatOf(spans[i]!),
    };
  }

  if (current) {
    const last = kept[kept.length - 1]!;
    const trail = Math.min(0.4, availTrail(partWords[last.part]!, last.phrase.end, partEnd(last.part)));
    current.end = Math.min(last.phrase.end + trail, partEnd(last.part));
    segments.push(current);
  }

  const fps = parts[0]?.info.fps ?? 30;
  const res = parts.length > 0 ? targetResolution(parts) : { width: 0, height: 0 };
  const totalDuration = segments.reduce(
    (s, seg) => s + (seg.kind === "black" ? seg.duration : seg.end - seg.start),
    0,
  );
  return {
    plan: {
      parts,
      segments,
      fps,
      width: res.width,
      height: res.height,
      totalDuration: Math.round(totalDuration * 1000) / 1000,
    },
    boundaries,
    overlapWarnings,
  };
}
