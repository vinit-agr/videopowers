import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { runFfmpeg } from "./ffmpeg.js";

/**
 * Produce the authoring mezzanine: 1920×1080 CFR 8-bit H.264, audio stream
 * copied untouched. Always runs, whatever the source — 10-bit HEVC crashes
 * Remotion's frame extractor, and normalizing unconditionally keeps every
 * project identical. The original stays the quality source for mg-render.
 */
export async function makeMezzanine(input: string, dest: string, fps: number): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await runFfmpeg([
    "-y", "-i", input,
    "-vf", "scale=1920:1080:flags=lanczos",
    "-r", String(fps),
    "-pix_fmt", "yuv420p",
    "-c:v", "libx264", "-crf", "18", "-preset", "medium",
    "-c:a", "copy",
    "-movflags", "+faststart",
    dest,
  ]);
}
