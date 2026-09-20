import { writeFile } from "node:fs/promises";
import type { Edl, Word } from "./types.js";

export interface OutputWord {
  text: string;
  start: number;
  end: number;
}

interface Cue {
  start: number;
  end: number;
  text: string;
}

const round = (t: number): number => Math.round(t * 1000) / 1000;

/**
 * Map every kept word from source time onto the OUTPUT timeline. Each range's
 * output offset is the summed duration of all preceding ranges, so a word at
 * source `w.start` lands at `offset + (w.start - range.start)`.
 */
export function outputWords(edl: Edl): OutputWord[] {
  const out: OutputWord[] = [];
  let offset = 0;
  for (const r of edl.ranges) {
    const dur = r.end - r.start;
    for (const w of r.words) {
      if (w.type !== "word") continue;
      const start = offset + Math.max(0, w.start - r.start);
      const end = offset + Math.min(dur, w.end - r.start);
      if (end > start) out.push({ text: w.text, start: round(start), end: round(end) });
    }
    offset += dur;
  }
  return out;
}

function buildCues(edl: Edl, maxWords = 5): Cue[] {
  const cues: Cue[] = [];
  let offset = 0;
  for (const r of edl.ranges) {
    const dur = r.end - r.start;
    const ws = r.words.filter((w) => w.type === "word");
    for (let i = 0; i < ws.length; i += maxWords) {
      const chunk = ws.slice(i, i + maxWords);
      const first = chunk[0]!;
      const last = chunk[chunk.length - 1]!;
      const start = offset + Math.max(0, first.start - r.start);
      const end = Math.min(offset + dur, offset + (last.end - r.start));
      if (end > start) cues.push({ start, end, text: chunk.map((w) => w.text).join(" ") });
    }
    offset += dur;
  }
  return cues;
}

function stamp(t: number, sep: "," | "."): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(milli, 3)}`;
}

export function toSrt(edl: Edl): string {
  return buildCues(edl)
    .map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.text}\n`)
    .join("\n");
}

export function toVtt(edl: Edl): string {
  const body = buildCues(edl)
    .map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export interface SidecarOptions {
  json: boolean;
  srt: boolean;
  vtt: boolean;
}

/** Write the requested sidecar files next to `outBase` (path without extension). */
export async function writeSidecars(edl: Edl, outBase: string, opts: SidecarOptions): Promise<string[]> {
  const written: string[] = [];
  if (opts.json) {
    const p = `${outBase}.words.json`;
    await writeFile(p, JSON.stringify(outputWords(edl), null, 2));
    written.push(p);
  }
  if (opts.srt) {
    const p = `${outBase}.srt`;
    await writeFile(p, toSrt(edl));
    written.push(p);
  }
  if (opts.vtt) {
    const p = `${outBase}.vtt`;
    await writeFile(p, toVtt(edl));
    written.push(p);
  }
  return written;
}

// ---------------------------------------------------------------------------
// Project mode: sidecars over a multi-part CutPlan
// ---------------------------------------------------------------------------

import type { CutPlan } from "./types.js";

/**
 * View a CutPlan as an Edl for sidecar generation: only durations and
 * word-offsets-within-range matter here, so a black gap becomes a wordless
 * range of the right length and every clip keeps its own source timing.
 */
export function planAsEdl(plan: CutPlan): Edl {
  const ranges = plan.segments.map((s) =>
    s.kind === "black"
      ? { start: 0, end: s.duration, words: [], note: "" }
      : { start: s.start, end: s.end, words: s.words, note: s.note },
  );
  return { source: "", ranges, totalDuration: plan.totalDuration };
}
