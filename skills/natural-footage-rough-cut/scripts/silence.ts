import type { Silence, Word } from "./types.js";
import { runFfmpeg } from "./ffmpeg.js";

/**
 * Parse `silencedetect` output from ffmpeg's stderr into intervals.
 * Lines look like: "[silencedetect @ ...] silence_start: 12.34"
 *                   "[silencedetect @ ...] silence_end: 15.67 | silence_duration: 3.33"
 */
export function parseSilences(stderr: string): Silence[] {
  const silences: Silence[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const sm = line.match(/silence_start:\s*(-?[\d.]+)/);
    const em = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (sm) {
      start = parseFloat(sm[1]!);
    } else if (em && start !== null) {
      silences.push({ start, end: parseFloat(em[1]!) });
      start = null;
    }
  }
  return silences;
}

/** Run ffmpeg silencedetect over the source audio and return the intervals. */
export async function detectSilences(
  path: string,
  noiseDb = -32,
  minDur = 0.3,
): Promise<Silence[]> {
  // silencedetect prints to stderr; ffmpeg exits 0 even with -f null.
  const { stderr } = await runFfmpeg([
    "-nostdin",
    "-hide_banner",
    "-i",
    path,
    "-af",
    `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
    "-f",
    "null",
    "-",
  ]);
  return parseSilences(stderr);
}

/**
 * Scribe inflates a word's `end` to the start of the next word when a long
 * pause follows, so a word can appear to last several seconds. Clamp each
 * word's end to the start of the first silence that begins within its span,
 * recovering the true end of the audible word. This is what lets us trim dead
 * air that sits *inside* a reported word without ever cutting mid-word.
 */
export function clampWordEnds(words: Word[], silences: Silence[]): Word[] {
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  return words.map((w) => {
    if (w.type !== "word") return w;
    const inside = sorted.find((s) => s.start > w.start && s.start < w.end);
    return inside ? { ...w, end: inside.start } : w;
  });
}
