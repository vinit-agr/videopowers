import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runFfmpeg } from "./ffmpeg.js";
import { verifyOutput } from "./verify.js";
import type { Edl, Quality } from "./types.js";

export interface RenderOptions {
  quality: Quality;
  crf: number;
  preset: string;
  normalize: boolean;
  workDir: string;
  /** Source r_frame_rate as an ffprobe rational ("60/1"); "" for audio-only. */
  fpsRational: string;
  hasVideo: boolean;
}

interface LoudnormStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

async function measureLoudness(path: string): Promise<LoudnormStats> {
  const { stderr } = await runFfmpeg([
    "-i", path, "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-",
  ]);
  const block = stderr.match(/\{[^{}]*"input_i"[\s\S]*?\}/);
  if (!block) throw new Error("could not parse loudnorm measurement");
  return JSON.parse(block[0]) as LoudnormStats;
}

function fpsValue(rational: string): number {
  const [n, d] = rational.split("/").map(Number);
  if (!n) return 0;
  return d ? n / d : n;
}

/** Snap a time to the video frame grid so per-segment A/V durations agree. */
function snapToFrame(t: number, fps: number): number {
  if (fps <= 0) return t;
  return Math.round(t * fps) / fps;
}

/**
 * Render the EDL without ever creating audio/video timing disagreements.
 *
 * WHY THIS SHAPE (learned the hard way): the old pipeline encoded each kept
 * segment's audio to AAC and lossless-concatenated the results. AAC can only
 * hold whole 1024-sample packets, so every segment carried up to ~21ms of
 * extra sound past its cut point, plus its own encoder priming. Concatenating
 * ~230 such segments accumulated ~4s of "phantom audio" whose timestamps were
 * squeezed to hide it — QuickTime played it fine, while continuous decoders
 * (Remotion/ffmpeg) drifted ~0.9s per minute. The fix is structural:
 *
 *   1. Cut boundaries snap to the video frame grid (A/V agree per segment).
 *   2. Segment audio is intermediate PCM (sample-exact, no packet padding,
 *      no priming) inside .mov; video is libx264 forced to CFR.
 *   3. Segments concat losslessly (exact for PCM), then the audio is encoded
 *      to AAC exactly ONCE in the final pass (with loudnorm when enabled).
 *   4. verifyOutput() measures the result and fails the render if any
 *      phantom audio, VFR, or A/V length mismatch slipped through.
 *
 * Audio-only inputs follow the same path with .wav intermediates and an .m4a
 * (or .mp3) final encode.
 */
export async function render(edl: Edl, output: string, opts: RenderOptions): Promise<void> {
  await mkdir(opts.workDir, { recursive: true });
  const fps = opts.hasVideo ? fpsValue(opts.fpsRational) : 0;
  try {
    // --- 1. per-segment extraction (PCM audio intermediates) ---
    const segExt = opts.hasVideo ? "mov" : "wav";
    const segments: string[] = [];
    for (let i = 0; i < edl.ranges.length; i++) {
      const r = edl.ranges[i]!;
      const start = snapToFrame(r.start, fps);
      let end = snapToFrame(r.end, fps);
      if (fps > 0 && end - start < 1 / fps) end = start + 1 / fps;
      const dur = end - start;
      const seg = join(opts.workDir, `seg_${String(i).padStart(3, "0")}.${segExt}`);
      const fadeOut = Math.max(0, dur - 0.03);
      const af = `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOut.toFixed(3)}:d=0.03`;

      const videoArgs = opts.hasVideo
        ? [
            ...(opts.quality === "1080p" ? ["-vf", "scale=-2:1080"] : []),
            "-c:v", "libx264", "-preset", opts.preset, "-crf", String(opts.crf), "-pix_fmt", "yuv420p",
            // Force constant frame rate at the source's nominal rate so VFR
            // recordings (screen recorders love these) come out clean.
            ...(opts.fpsRational ? ["-r", opts.fpsRational] : []),
            "-fps_mode", "cfr",
          ]
        : ["-vn"];

      await runFfmpeg([
        "-y", "-ss", start.toFixed(5), "-i", edl.source, "-t", dur.toFixed(5),
        "-af", af, ...videoArgs,
        // PCM intermediates: sample-exact cuts, no packet padding, no priming.
        "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2",
        seg,
      ]);
      segments.push(seg);
    }

    // --- 2. lossless concat (exact for PCM audio) ---
    const listFile = join(opts.workDir, "concat.txt");
    await writeFile(listFile, segments.map((p) => `file '${p.replace(/'/g, "'\\''")}'\n`).join(""));
    const base = join(opts.workDir, `base.${segExt}`);
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", base]);

    // --- 3. single final audio encode (with optional 2-pass loudnorm) ---
    const afChain = ["aresample=async=1000:first_pts=0"];
    if (opts.normalize) {
      const m = await measureLoudness(base);
      afChain.push(
        `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      );
    }
    const audioCodec = /\.mp3$/i.test(output)
      ? ["-c:a", "libmp3lame", "-b:a", "192k"]
      : ["-c:a", "aac", "-b:a", "192k"];
    await runFfmpeg([
      "-y", "-i", base,
      ...(opts.hasVideo ? ["-c:v", "copy"] : ["-vn"]),
      "-af", afChain.join(","), ...audioCodec, "-ar", "48000",
      ...(/\.(mp4|m4a|mov)$/i.test(output) ? ["-movflags", "+faststart"] : []),
      output,
    ]);

    // --- 4. prove it ---
    await verifyOutput(output, { hasVideo: opts.hasVideo, expectedDuration: edl.totalDuration });
  } finally {
    await rm(opts.workDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Project-mode rendering: multi-source segments + black beat gaps
// ---------------------------------------------------------------------------

import type { CutPlan } from "./types.js";

export interface RenderPlanOptions {
  quality: Quality;
  crf: number;
  preset: string;
  normalize: boolean;
  workDir: string;
}

/**
 * Render a multi-part cut plan into one MP4. Same sync-safety shape as
 * render(): frame-snapped cuts, PCM intermediates, single final AAC encode,
 * verified output. Every segment is normalized to the plan's target
 * resolution (parts can differ — e.g. a webcam that dropped from 4K to 1080p
 * mid-shoot), and black segments are generated at that same format so the
 * concat is uniform.
 */
export async function renderPlan(plan: CutPlan, output: string, opts: RenderPlanOptions): Promise<void> {
  await mkdir(opts.workDir, { recursive: true });
  const fps = plan.fps;
  const [width, height] =
    opts.quality === "1080p" && plan.height > 1080
      ? [Math.round((plan.width / plan.height) * 1080 / 2) * 2, 1080]
      : [plan.width, plan.height];
  const fpsArg = String(Math.round(fps));
  const scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;

  try {
    const segments: string[] = [];
    for (let i = 0; i < plan.segments.length; i++) {
      const s = plan.segments[i]!;
      const seg = join(opts.workDir, `seg_${String(i).padStart(4, "0")}.mov`);
      if (s.kind === "black") {
        const dur = Math.max(1 / fps, Math.round(s.duration * fps) / fps);
        await runFfmpeg([
          "-y",
          "-f", "lavfi", "-i", `color=black:s=${width}x${height}:r=${fpsArg}:d=${dur.toFixed(5)}`,
          "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo`,
          "-t", dur.toFixed(5),
          "-vf", "setsar=1",
          "-c:v", "libx264", "-preset", opts.preset, "-crf", String(opts.crf), "-pix_fmt", "yuv420p",
          "-r", fpsArg, "-fps_mode", "cfr",
          "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2",
          seg,
        ]);
        segments.push(seg);
        continue;
      }
      const source = plan.parts[s.part]!.path;
      const start = snapToFrame(s.start, fps);
      let end = snapToFrame(s.end, fps);
      if (end - start < 1 / fps) end = start + 1 / fps;
      const dur = end - start;
      const fadeOut = Math.max(0, dur - 0.03);
      await runFfmpeg([
        "-y", "-ss", start.toFixed(5), "-i", source, "-t", dur.toFixed(5),
        "-af", `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOut.toFixed(3)}:d=0.03`,
        "-vf", scale,
        "-c:v", "libx264", "-preset", opts.preset, "-crf", String(opts.crf), "-pix_fmt", "yuv420p",
        "-r", fpsArg, "-fps_mode", "cfr",
        "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2",
        seg,
      ]);
      segments.push(seg);
    }

    const listFile = join(opts.workDir, "concat.txt");
    await writeFile(listFile, segments.map((p) => `file '${p.replace(/'/g, "'\\''")}'\n`).join(""));
    const base = join(opts.workDir, "base.mov");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", base]);

    const afChain = ["aresample=async=1000:first_pts=0"];
    if (opts.normalize) {
      const m = await measureLoudness(base);
      afChain.push(
        `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      );
    }
    await runFfmpeg([
      "-y", "-i", base, "-c:v", "copy",
      "-af", afChain.join(","), "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      "-movflags", "+faststart",
      output,
    ]);

    await verifyOutput(output, { hasVideo: true, expectedDuration: plan.totalDuration });
  } finally {
    await rm(opts.workDir, { recursive: true, force: true });
  }
}
