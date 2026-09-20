// Smoke test for the PROJECT-mode renderer (renderPlan). Run with:
//   pnpm exec tsx scripts/__smoke__/render-plan.smoke.ts
//
// Builds two synthetic parts at DIFFERENT resolutions (1280x720 and 640x360)
// plus a plan that interleaves clips from both with a black beat gap, renders
// it, and relies on renderPlan's built-in verifyOutput gate (phantom audio /
// VFR / A-V length / plan duration). Also asserts the output resolution is
// the plan's target and the duration matches the plan.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg, runFfprobe } from "../ffmpeg.js";
import { renderPlan } from "../render.js";
import type { CutPlan, MediaInfo } from "../types.js";

async function makePart(dir: string, name: string, w: number, h: number, dur: number): Promise<string> {
  const path = join(dir, name);
  await runFfmpeg([
    "-y",
    "-f", "lavfi", "-i", `testsrc2=size=${w}x${h}:rate=30:duration=${dur}`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${dur}`,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    path,
  ]);
  return path;
}

function info(w: number, h: number, dur: number): MediaInfo {
  return { width: w, height: h, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration: dur };
}

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "vrc-smoke-"));
  try {
    const a = await makePart(dir, "part1.mp4", 1280, 720, 12);
    const b = await makePart(dir, "part2.mp4", 640, 360, 12);
    const plan: CutPlan = {
      parts: [
        { index: 0, path: a, info: info(1280, 720, 12) },
        { index: 1, path: b, info: info(640, 360, 12) },
      ],
      segments: [
        { kind: "clip", part: 0, start: 0.137, end: 2.51, words: [], note: "a1", beatIndex: 0 },
        { kind: "clip", part: 0, start: 4.02, end: 6.339, words: [], note: "a2", beatIndex: 0 },
        { kind: "black", duration: 2.0, beatIndex: 1 },
        { kind: "clip", part: 1, start: 1.0, end: 3.47, words: [], note: "b1", beatIndex: 1 },
        { kind: "clip", part: 0, start: 8.11, end: 9.6, words: [], note: "a3", beatIndex: 1 },
      ],
      fps: 30,
      width: 1280,
      height: 720,
      totalDuration: 0,
    };
    plan.totalDuration =
      Math.round(
        plan.segments.reduce((s, x) => s + (x.kind === "black" ? x.duration : x.end - x.start), 0) * 1000,
      ) / 1000;

    const out = join(dir, "rough.mp4");
    await renderPlan(plan, out, {
      quality: "native", crf: 23, preset: "ultrafast", normalize: true, workDir: join(dir, "work"),
    });

    const raw = await runFfprobe([
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration", "-print_format", "json", out,
    ]);
    const s = (JSON.parse(raw) as { streams: Array<Record<string, string>> }).streams[0]!;
    if (Number(s.width) !== 1280 || Number(s.height) !== 720) {
      throw new Error(`expected 1280x720 output, got ${s.width}x${s.height}`);
    }
    if (Math.abs(Number(s.duration) - plan.totalDuration) > 0.2) {
      throw new Error(`duration ${s.duration} vs plan ${plan.totalDuration}`);
    }
    console.error(`\nrender-plan smoke: PASS (${plan.totalDuration}s, mixed-res inputs, black gap)`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`render-plan smoke FAILED: ${(e as Error).message}`);
  process.exitCode = 1;
});
