// build.ts — step 3: validate edit.json, assemble the cut, write every output.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assemble } from "./assemble.js";
import { validateEdit, type EditFile } from "./edit.js";
import type { Prepared } from "./prepared.js";
import { buildReel } from "./reel.js";
import { renderPlan } from "./render.js";
import { markerNote, renderReport, REVIEW_FILE } from "./report.js";
import { planAsEdl, writeSidecars } from "./subtitles.js";
import type { CutPlan, PartSource, Quality } from "./types.js";
import { placeSegments, writeFcpXml, type XmlMarker } from "./xml.js";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

export interface BuildOptions {
  to: string[];
  dryRun: boolean;
  quality: Quality;
  normalize: boolean;
}

/**
 * The markers and the closing reminder always point at the review reel, so it
 * is built on every (non-dry) build that has judgment calls — not only with
 * --to mp4 — and a stale one is removed when there are none.
 */
export function reelAction(_to: string[], callCount: number): "build" | "remove" {
  return callCount > 0 ? "build" : "remove";
}

export async function runBuild(projectDir: string, outDir: string, opts: BuildOptions): Promise<void> {
  const prepPath = join(outDir, "prepare.json");
  const editPath = join(outDir, "edit.json");
  if (!existsSync(prepPath)) throw new Error(`${prepPath} not found: run prepare first`);
  if (!existsSync(editPath)) throw new Error(`${editPath} not found: the editor writes it after reading transcript.md`);
  const prep = JSON.parse(readFileSync(prepPath, "utf8")) as Prepared;
  const edit = JSON.parse(readFileSync(editPath, "utf8")) as EditFile;

  const { errors, warnings } = validateEdit(edit, prep);
  for (const w of warnings) console.error(`  ⚠ ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    throw new Error(`edit.json has ${errors.length} error(s); fix them and re-run build`);
  }

  const parts: PartSource[] = prep.parts.map((p, index) => ({ index, path: p.path, info: p.info }));
  const { plan, callFrames } = assemble(edit, prep, parts);
  const outName = basename(outDir);
  const report = renderReport(edit, prep, plan, callFrames, outName);
  console.log(report);

  // Kept text per section, so the editor can re-read exactly what the cut says.
  console.error("\n— cut text —");
  for (const seg of plan.segments) {
    if (seg.kind === "black") console.error(`  ■ ${seg.duration}s black · section ${seg.beatIndex + 1}`);
    else if (seg.kind === "clip") console.error(`  ${prep.parts[seg.part]!.file} ${seg.start.toFixed(2)}–${seg.end.toFixed(2)}  ${seg.note}`);
  }
  if (opts.dryRun) {
    console.error("\n[dry-run] no files written.");
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const seqName = `${basename(projectDir)} rough cut`;
  const markers: XmlMarker[] = edit.calls
    .filter((c) => callFrames.has(c.id))
    .map((c) => ({ frame: callFrames.get(c.id)!, name: `Call ${c.id}`, comment: markerNote(c, outName) }));

  writeFileSync(join(outDir, "rough-cut.report.md"), report);
  const planPath = join(outDir, "rough-cut.plan.json");
  writeFileSync(planPath, JSON.stringify(serializePlan(plan, seqName), null, 2));
  const markersPath = join(outDir, "rough-cut.markers.json");
  writeFileSync(markersPath, JSON.stringify(markers, null, 2));
  console.error(`\n✅ ${join(outDir, "rough-cut.report.md")}\n✅ ${planPath}`);

  if (opts.to.includes("xml")) {
    writeFcpXml(plan, join(outDir, "rough-cut.xml"), seqName, markers);
    console.error(`✅ ${join(outDir, "rough-cut.xml")}  →  DaVinci Resolve: File → Import Timeline → Import AAF, EDL, XML…`);
  }
  const renderOpts = { quality: opts.quality, crf: 18, preset: "veryfast", normalize: opts.normalize };
  if (opts.to.includes("mp4")) {
    const mp4 = join(outDir, "rough-cut.mp4");
    await renderPlan(plan, mp4, { ...renderOpts, workDir: join(outDir, ".render-tmp") });
    console.error(`✅ ${mp4}`);
    for (const s of await writeSidecars(planAsEdl(plan), join(outDir, "rough-cut"), { json: true, srt: true, vtt: true })) console.error(`   ${s}`);
  }
  const reel = join(outDir, REVIEW_FILE);
  if (reelAction(opts.to, edit.calls.length) === "build") {
    await buildReel(edit.calls, prep, parts, callFrames, reel, { ...renderOpts, workDir: join(outDir, ".reel-tmp") });
    console.error(`✅ ${reel}`);
  } else {
    rmSync(reel, { force: true });
  }
  if (opts.to.includes("resolve")) await runBridgeAppend(planPath, seqName, markersPath);

  if (edit.calls.length) {
    console.error(
      `\n👉 Review file: ${join(outDir, REVIEW_FILE)}\n   ${edit.calls.length} judgment call(s); the numbered markers on the timeline ("Call N") point into it.`,
    );
  }
}

interface SerializedPlan {
  name: string;
  fps: number;
  width: number;
  height: number;
  totalDuration: number;
  parts: Array<{ index: number; path: string; duration: number; width: number; height: number }>;
  segments: Array<
    | { kind: "clip"; part: number; start: number; end: number; startFrame: number; endFrame: number; recordFrame: number; beat: number; text: string }
    | { kind: "black"; duration: number; frames: number; recordFrame: number; beat: number }
  >;
}

/** Plan JSON: same shape as footage-rough-cut's (bridge input, scorecard, mg pipeline). */
export function serializePlan(plan: CutPlan, name: string): SerializedPlan {
  const fps = plan.fps;
  const { clips } = placeSegments(plan);
  const byIndex = new Map(clips.map((c) => [c.seg, c] as const));
  let cursor = 0;
  const segments: SerializedPlan["segments"] = [];
  for (const seg of plan.segments) {
    if (seg.kind === "clip") {
      const placed = byIndex.get(seg)!;
      cursor = placed.recEnd;
      segments.push({
        kind: "clip", part: seg.part, start: seg.start, end: seg.end,
        startFrame: placed.srcIn, endFrame: placed.srcOut, recordFrame: placed.recStart,
        beat: seg.beatIndex, text: seg.note.slice(0, 120),
      });
    } else if (seg.kind === "black") {
      const frames = Math.round(seg.duration * fps);
      segments.push({ kind: "black", duration: seg.duration, frames, recordFrame: cursor, beat: seg.beatIndex });
      cursor += frames;
    }
  }
  return {
    name, fps, width: plan.width, height: plan.height, totalDuration: plan.totalDuration,
    parts: plan.parts.map((p) => ({ index: p.index, path: resolve(p.path), duration: p.info.duration, width: p.info.width, height: p.info.height })),
    segments,
  };
}

function runBridgeAppend(planPath: string, seqName: string, markersPath: string): Promise<void> {
  return new Promise((ok, fail) => {
    const py = spawn("python3", [join(SCRIPTS_DIR, "resolve-append.py"), planPath, "--new-timeline", seqName, "--markers", markersPath], { stdio: "inherit" });
    py.on("close", (code) => (code === 0 ? ok() : fail(new Error(`resolve-append.py exited with code ${code}`))));
    py.on("error", (e) => fail(new Error(`could not run python3: ${e.message}`)));
  });
}
