import { runFfmpeg } from "./ffmpeg.js";
import type { Gap } from "./types.js";

/**
 * Parse ffmpeg blackdetect stderr into gaps. Lines look like:
 *   [blackdetect @ 0x...] black_start:47.166667 black_end:49.166667 black_duration:2
 * (Progress noise may share the line — match fields, not whole lines.)
 */
export function parseBlackdetect(stderr: string): Gap[] {
  const gaps: Gap[] = [];
  const re = /black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:[0-9.]+/g;
  for (const m of stderr.matchAll(re)) {
    gaps.push({ start: Number(m[1]), end: Number(m[2]) });
  }
  return gaps.sort((a, b) => a.start - b.start);
}

/**
 * Detect chapter-marker black gaps: black for at least `minDur` seconds.
 * Decodes downscaled for speed — gap timing is unaffected by resolution.
 */
export async function detectGaps(input: string, minDur: number): Promise<Gap[]> {
  const { stderr } = await runFfmpeg([
    "-hide_banner", "-i", input,
    "-vf", `scale=480:-2,blackdetect=d=${minDur}:pix_th=0.08`,
    "-an", "-f", "null", "-",
  ]);
  return parseBlackdetect(stderr);
}
