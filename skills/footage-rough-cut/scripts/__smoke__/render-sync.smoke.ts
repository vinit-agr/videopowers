// Smoke test for the sync-safe render path. Run with:
//   pnpm exec tsx scripts/__smoke__/render-sync.smoke.ts
//
// 1. Builds a synthetic 60s 60fps video (testsrc2 + tone bursts) and cuts it
//    with a 40-segment EDL through render() — verifyOutput must PASS.
// 2. Same for a bare .wav input rendered to .m4a — must PASS.
// 3. Recreates the OLD pipeline (per-segment AAC + lossless concat) on the
//    same EDL and runs verifyOutput on it — it must FAIL with a phantom-audio
//    report, proving the gate catches the defect that shipped in July.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg } from "../ffmpeg.js";
import { render } from "../render.js";
import { verifyOutput } from "../verify.js";
import type { Edl, Range } from "../types.js";

function makeEdl(source: string, segCount: number, srcDur: number): Edl {
  const ranges: Range[] = [];
  const step = srcDur / segCount;
  for (let i = 0; i < segCount; i++) {
    // keep ~60% of each step, at awkward non-frame-aligned offsets on purpose
    const start = i * step + 0.137;
    const end = i * step + step * 0.6 + 0.0891;
    ranges.push({ start, end, words: [], note: `seg ${i}` });
  }
  const totalDuration = ranges.reduce((s, r) => s + (r.end - r.start), 0);
  return { source, ranges, totalDuration: Math.round(totalDuration * 1000) / 1000 };
}

async function oldPipeline(edl: Edl, output: string, work: string): Promise<void> {
  const segs: string[] = [];
  for (let i = 0; i < edl.ranges.length; i++) {
    const r = edl.ranges[i]!;
    const seg = join(work, `old_${i}.mp4`);
    await runFfmpeg([
      "-y", "-ss", r.start.toFixed(3), "-i", edl.source, "-t", (r.end - r.start).toFixed(3),
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", seg,
    ]);
    segs.push(seg);
  }
  const list = join(work, "old_concat.txt");
  await writeFile(list, segs.map((p) => `file '${p}'\n`).join(""));
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", output]);
}

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "vvc-smoke-"));
  try {
    // --- synthetic sources ---
    const srcVideo = join(dir, "src.mp4");
    await runFfmpeg([
      "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=60:duration=60",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=60",
      "-af", "volume='if(lt(mod(t,3),2),1,0)':eval=frame",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "48000", srcVideo,
    ]);
    const srcAudio = join(dir, "src.wav");
    await runFfmpeg(["-y", "-f", "lavfi", "-i", "sine=frequency=330:duration=30", "-ar", "48000", "-ac", "2", srcAudio]);

    // --- 1. new pipeline, video, 40 segments ---
    const edl = makeEdl(srcVideo, 40, 60);
    const outVideo = join(dir, "out.clean.mp4");
    await render(edl, outVideo, {
      quality: "native", crf: 30, preset: "ultrafast", normalize: true,
      workDir: join(dir, "w1"), fpsRational: "60/1", hasVideo: true,
    });
    console.error("smoke 1 (video, 40 cuts, new pipeline): PASS\n");

    // --- 2. new pipeline, audio-only, 10 segments ---
    const edlA = makeEdl(srcAudio, 10, 30);
    const outAudio = join(dir, "out.clean.m4a");
    await render(edlA, outAudio, {
      quality: "native", crf: 18, preset: "medium", normalize: true,
      workDir: join(dir, "w2"), fpsRational: "", hasVideo: false,
    });
    console.error("smoke 2 (audio-only → m4a, new pipeline): PASS\n");

    // --- 3. OLD pipeline must FAIL verification ---
    const outOld = join(dir, "out.old.mp4");
    await oldPipeline(edl, outOld, dir);
    let failed = false;
    try {
      await verifyOutput(outOld, { hasVideo: true, expectedDuration: edl.totalDuration });
    } catch (e) {
      failed = true;
      console.error(`smoke 3 (old pipeline correctly REJECTED):\n${(e as Error).message}\n`);
    }
    if (!failed) throw new Error("smoke 3 FAILED: verifier did not catch the old pipeline's defect");

    console.error("ALL SMOKE TESTS PASSED");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main().catch((e) => {
  console.error(`SMOKE FAILURE: ${(e as Error).message}`);
  process.exitCode = 1;
});
