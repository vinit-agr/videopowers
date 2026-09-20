import type { Edl, Interval, PacingPreset, Phrase, Range, Word } from "./types.js";

export interface BuildEdlParams {
  source: string;
  keptPhrases: Phrase[];
  /** Retake + filler spans to excise (used only when removeSilences is false). */
  dropSpans: Interval[];
  removeSilences: boolean;
  pacing: PacingPreset;
  duration: number;
}

function mergeIntervals(spans: Interval[]): Interval[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + 1e-6) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/** [lo, hi) minus the given (merged) intervals. */
function complement(lo: number, hi: number, drops: Interval[]): Interval[] {
  const out: Interval[] = [];
  let cursor = lo;
  for (const d of drops) {
    if (d.end <= lo || d.start >= hi) continue;
    const s = Math.max(lo, d.start);
    if (s > cursor + 1e-6) out.push({ start: cursor, end: s });
    cursor = Math.max(cursor, Math.min(hi, d.end));
  }
  if (hi > cursor + 1e-6) out.push({ start: cursor, end: hi });
  return out;
}

function wordsIn(phrases: Phrase[], start: number, end: number): Word[] {
  const out: Word[] = [];
  for (const p of phrases) {
    for (const w of p.words) {
      if (w.start >= start - 1e-3 && w.end <= end + 1e-3) out.push(w);
    }
  }
  return out;
}

/**
 * Build the edit decision list.
 *  - removeSilences=true: one padded range per kept phrase (gaps collapse).
 *  - removeSilences=false: keep original timing, excising only retake/filler
 *    spans, but still trimming leading/trailing dead air.
 */
export function buildEdl(params: BuildEdlParams): Edl {
  const { source, keptPhrases, dropSpans, removeSilences, pacing, duration } = params;
  const ranges: Range[] = [];

  if (removeSilences) {
    keptPhrases.forEach((p, i) => {
      const lead = i === 0 ? pacing.padLead * 2 : pacing.padLead;
      const start = Math.max(0, p.start - lead);
      const end = Math.min(duration, p.end + pacing.padTrail);
      if (end > start) ranges.push({ start, end, words: p.words, note: p.text });
    });
    // Resolve padding overlaps between neighbours so no source audio is duplicated.
    for (let i = 0; i < ranges.length - 1; i++) {
      const a = ranges[i]!;
      const b = ranges[i + 1]!;
      if (a.end > b.start) {
        const mid = (keptPhrases[i]!.end + keptPhrases[i + 1]!.start) / 2;
        a.end = Math.min(a.end, mid);
        b.start = Math.max(b.start, mid);
      }
    }
  } else {
    if (keptPhrases.length > 0) {
      const contentStart = Math.max(0, keptPhrases[0]!.start - pacing.padLead * 2);
      const contentEnd = Math.min(duration, keptPhrases[keptPhrases.length - 1]!.end + pacing.padTrail);
      const drops = mergeIntervals(dropSpans);
      for (const seg of complement(contentStart, contentEnd, drops)) {
        if (seg.end > seg.start) {
          ranges.push({ ...seg, words: wordsIn(keptPhrases, seg.start, seg.end), note: "" });
        }
      }
    }
  }

  const totalDuration = ranges.reduce((s, r) => s + (r.end - r.start), 0);
  return { source, ranges, totalDuration: Math.round(totalDuration * 1000) / 1000 };
}
