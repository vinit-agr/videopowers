// project.ts — orchestrate PROJECT mode: many part recordings + script.md →
// aligned, retake-cleaned, script-paced rough cut → XML / MP4 / Resolve.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { probe } from "./probe.js";
import { transcribe } from "./transcribe.js";
import { clampWordEnds, detectSilences } from "./silence.js";
import { toPhrases } from "./phrases.js";
import { removeFillers } from "./fillers.js";
import { trimRestart } from "./retakes.js";
import { loadScript } from "./script.js";
import { alignToScript, type SourcePhrase } from "./align.js";
import { buildCut } from "./cut.js";
import { placeSegments, writeFcpXml } from "./xml.js";
import { renderPlan } from "./render.js";
import { planAsEdl, writeSidecars } from "./subtitles.js";
import type { Config, CutPlan, Interval, PartSource, Word } from "./types.js";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

/** part<N>.<ext> files in numeric order. */
export function discoverParts(dir: string): string[] {
  if (!existsSync(dir)) throw new Error(`parts dir not found: ${dir}`);
  return readdirSync(dir)
    .map((f) => ({ f, m: f.match(/^part(\d+)\.(mp4|mov|m4v)$/i) }))
    .filter((x): x is { f: string; m: RegExpMatchArray } => x.m !== null)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => join(dir, x.f));
}

export async function runProject(config: Config, apiKey: string): Promise<void> {
  const projectDir = resolve(config.input);
  const scriptPath = config.scriptPath ?? join(projectDir, "script.md");
  const partsDir = config.partsDir ?? join(projectDir, "assets", "camera");
  const outDir = config.outDir ?? join(projectDir, "rough-cut");
  const seqName = config.seqName ?? `${basename(projectDir)} rough cut`;

  if (!existsSync(scriptPath)) throw new Error(`script not found: ${scriptPath} (pass --script)`);
  const partPaths = discoverParts(partsDir);
  if (partPaths.length === 0) throw new Error(`no part<N>.mp4 files in ${partsDir}`);

  const script = loadScript(scriptPath);
  console.error(
    `script: ${script.beats.length} beats, ${script.sentences.length} sentences ` +
      `(${new Set(script.sentences.map((s) => s.paragraphIndex)).size} paragraphs)`,
  );

  // --- per-part ingest ---
  const parts: PartSource[] = [];
  const partWords: Word[][] = [];
  const droppedByPart: Interval[][] = [];
  const sourcePhrases: SourcePhrase[] = [];
  // Coarser than single-file mode: 3-word fragments can't be matched to the
  // script reliably, and any pause >= 0.5s is a boundary/retake point anyway.
  const gapThreshold = 0.5;
  let fillerCount = 0;

  for (let i = 0; i < partPaths.length; i++) {
    const path = partPaths[i]!;
    const info = await probe(path);
    if (!info.hasVideo) throw new Error(`${basename(path)} has no video stream`);
    parts.push({ index: i, path, info });
    const rawWords = await transcribe(path, { apiKey, lang: config.lang, cacheDir: config.cacheDir });
    const silences = await detectSilences(path);
    const words = clampWordEnds(rawWords, silences);
    partWords.push(words);
    const phrases = toPhrases(words, gapThreshold);
    const filler = removeFillers(phrases, {
      enabled: config.removeFillers,
      mode: config.fillerMode,
      edgeWords: config.fillerWords,
    });
    fillerCount += filler.removed;
    droppedByPart.push([...filler.removedSpans]);
    // trimRestart removes within-phrase false starts ("it's like, it's like
    // an X-ray…") before matching, which also sharpens script similarity.
    for (const ph of filler.phrases) sourcePhrases.push({ phrase: trimRestart(ph), part: i });
    console.error(
      `  ${basename(path)}: ${fmt(info.duration)}, ${info.width}x${info.height}@${info.fps.toFixed(0)} — ` +
        `${filler.phrases.length} phrases`,
    );
  }

  const fpsSet = new Set(parts.map((p) => p.info.fps.toFixed(3)));
  if (fpsSet.size > 1) {
    throw new Error(
      `parts have mixed frame rates (${[...fpsSet].join(", ")}) — normalize them first (extract-part.sh emits CFR 30)`,
    );
  }

  // --- script alignment + retakes ---
  const align = alignToScript(sourcePhrases, script);
  for (const p of align.phrases) {
    if (p.dropped) droppedByPart[p.part]!.push({ start: p.phrase.start, end: p.phrase.end });
  }

  // --- cut with typed pauses ---
  const { plan, boundaries, overlapWarnings } = buildCut({
    parts,
    kept: align.kept,
    script,
    partWords,
    droppedByPart,
    budgets: config.budgets,
  });

  // --- report ---
  const srcTotal = parts.reduce((s, p) => s + p.info.duration, 0);
  const covered = new Set<number>();
  for (const p of align.phrases) if (p.span && !p.dropped) for (let s = p.span[0]; s <= p.span[1]; s++) covered.add(s);
  const byType = (t: string) => boundaries.filter((b) => b.type === t);
  const air = (t: string) => {
    const list = byType(t);
    if (list.length === 0) return "—";
    return `${(list.reduce((s, b) => s + b.keptAir, 0) / list.length).toFixed(2)}s avg`;
  };
  console.error(`\nrough-cut plan: "${seqName}"`);
  console.error(`  parts: ${parts.length} (${fmt(srcTotal)} raw) → output ${fmt(plan.totalDuration)}  (-${Math.round((1 - plan.totalDuration / srcTotal) * 100)}%)`);
  console.error(`  retakes dropped: ${align.retakeClusters} phrases · fillers: ${fillerCount} · ad-libs kept: ${align.kept.filter((p) => !p.span).length}/${align.adLibs}`);
  console.error(`  script coverage: ${covered.size}/${script.sentences.length} sentences spoken`);
  console.error(`  joins: ${byType("sentence").length} sentence (${air("sentence")}) · ${byType("concept").length} concept (${air("concept")}) · ${byType("beat").length} beat gaps (${config.budgets.beat.toFixed(1)}s black) · ${byType("intra").length} intra`);
  console.error(`  merged (left uncut): ${boundaries.filter((b) => b.merged).length}/${boundaries.length} joins`);

  const uncovered = script.sentences.filter((s) => !covered.has(s.index));
  if (uncovered.length > 0) {
    console.error(`\n  ⚠ script sentences never spoken (${uncovered.length}):`);
    for (const s of uncovered.slice(0, 12)) console.error(`    [beat ${s.beatIndex}] ${s.text.slice(0, 70)}`);
    if (uncovered.length > 12) console.error(`    … and ${uncovered.length - 12} more`);
  }
  const lowConf = align.phrases.filter((p) => p.lowConfidence && !p.dropped);
  if (lowConf.length > 0) {
    console.error(`\n  ⚠ low-confidence matches — eyeball these (${lowConf.length}):`);
    for (const p of lowConf.slice(0, 12)) {
      console.error(
        `    ${basename(parts[p.part]!.path)} ${fmt(p.phrase.start)} (${(p.similarity * 100).toFixed(0)}%): ${p.phrase.text.slice(0, 60)}`,
      );
    }
    if (lowConf.length > 12) console.error(`    … and ${lowConf.length - 12} more`);
  }
  for (const w of overlapWarnings) console.error(`  ⚠ ${w}`);

  if (config.dryRun) {
    // Audit list: every drop next to the take that superseded it, so a quick
    // skim can confirm no real content died.
    const dropped = align.phrases.filter((p) => p.dropped);
    if (dropped.length > 0) {
      console.error(`\ndropped takes (${dropped.length}) — each with its surviving take:`);
      const byOrder = new Map(align.phrases.map((p) => [p.order, p] as const));
      for (const p of dropped) {
        const survivor = p.droppedBy !== null ? byOrder.get(p.droppedBy) : undefined;
        console.error(`  ✂ ${basename(parts[p.part]!.path)} ${fmt(p.phrase.start)}  ${p.phrase.text.slice(0, 70)}`);
        console.error(`    ↳ ${survivor ? `kept: ${survivor.phrase.text.slice(0, 70)}` : `(${p.dropReason})`}`);
      }
    }
    console.error(`\ndry-run detail (segments):`);
    let cursor = 0;
    for (const seg of plan.segments) {
      if (seg.kind === "black") {
        console.error(`  ${fmt(cursor)}  ── BLACK ${seg.duration.toFixed(1)}s ── beat ${seg.beatIndex} starts`);
        cursor += seg.duration;
      } else {
        console.error(
          `  ${fmt(cursor)}  ${basename(parts[seg.part]!.path)} ${seg.start.toFixed(2)}–${seg.end.toFixed(2)}  ${seg.note.slice(0, 56)}`,
        );
        cursor += seg.end - seg.start;
      }
    }
    console.error(`\n[dry-run] no files written.`);
    return;
  }

  // --- outputs ---
  mkdirSync(outDir, { recursive: true });
  const planPath = join(outDir, "rough-cut.plan.json");
  writeFileSync(planPath, JSON.stringify(serializePlan(plan, seqName), null, 2));
  console.error(`\n✅ ${planPath}`);

  if (config.to.includes("xml")) {
    const xmlPath = join(outDir, "rough-cut.xml");
    writeFcpXml(plan, xmlPath, seqName);
    console.error(`✅ ${xmlPath}  →  DaVinci Resolve: File → Import Timeline → Import AAF, EDL, XML…`);
  }

  if (config.to.includes("mp4")) {
    const mp4Path = join(outDir, "rough-cut.mp4");
    const workDir = join(outDir, ".render-tmp");
    await renderPlan(plan, mp4Path, {
      quality: config.quality,
      crf: config.crf,
      preset: config.preset,
      normalize: config.normalize,
      workDir,
    });
    console.error(`✅ ${mp4Path}`);
    const sidecars = await writeSidecars(planAsEdl(plan), join(outDir, "rough-cut"), {
      json: config.json,
      srt: config.srt,
      vtt: config.vtt,
    });
    for (const s of sidecars) console.error(`   ${s}`);
  }

  if (config.to.includes("resolve")) {
    await runBridgeAppend(planPath, seqName);
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

/** Plan JSON: seconds + frames + absolute record positions (bridge input). */
export function serializePlan(plan: CutPlan, name: string): SerializedPlan {
  const fps = plan.fps;
  const { clips } = placeSegments(plan);
  const byIndex = new Map(clips.map((c) => [c.seg, c] as const));
  let cursor = 0;
  const segments: SerializedPlan["segments"] = plan.segments.map((seg) => {
    if (seg.kind === "black") {
      const frames = Math.round(seg.duration * fps);
      const out = { kind: "black" as const, duration: seg.duration, frames, recordFrame: cursor, beat: seg.beatIndex };
      cursor += frames;
      return out;
    }
    const placed = byIndex.get(seg)!;
    cursor = placed.recEnd;
    return {
      kind: "clip" as const,
      part: seg.part,
      start: seg.start,
      end: seg.end,
      startFrame: placed.srcIn,
      endFrame: placed.srcOut,
      recordFrame: placed.recStart,
      beat: seg.beatIndex,
      text: seg.note.slice(0, 120),
    };
  });
  return {
    name,
    fps,
    width: plan.width,
    height: plan.height,
    totalDuration: plan.totalDuration,
    parts: plan.parts.map((p) => ({
      index: p.index,
      path: resolve(p.path),
      duration: p.info.duration,
      width: p.info.width,
      height: p.info.height,
    })),
    segments,
  };
}

/** Spawn the bridge script; it prints its own onboarding + retry guidance. */
function runBridgeAppend(planPath: string, seqName: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const py = spawn("python3", [join(SCRIPTS_DIR, "resolve-append.py"), planPath, "--new-timeline", seqName], {
      stdio: "inherit",
    });
    py.on("close", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`resolve-append.py exited with code ${code}`)),
    );
    py.on("error", (e) => reject(new Error(`could not run python3: ${e.message}`)));
  });
}
