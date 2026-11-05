// prepare.ts — step 1: transcribe every part and write prepare.json + transcript.md.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { probe } from "./probe.js";
import { transcribe } from "./transcribe.js";
import { clampWordEnds, detectSilences } from "./silence.js";
import { parseNaturalScript } from "./natural-script.js";
import { formatTranscript } from "./transcript.js";
import type { Prepared, PreparedPart } from "./prepared.js";

/** part1.mp4, part2.mp4, … in numeric order. */
export function discoverParts(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => ({ f, m: /^part(\d+)\.mp4$/i.exec(f) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]))
    .map((x) => join(dir, x.f));
}

export async function runPrepare(projectDir: string, outDir: string, apiKey: string, cacheDir: string): Promise<Prepared> {
  const project = resolve(projectDir);
  const scriptPath = join(project, "natural_script.md");
  if (!existsSync(scriptPath)) throw new Error(`natural_script.md not found in ${project}`);
  const sections = parseNaturalScript(readFileSync(scriptPath, "utf8"));
  if (sections.length === 0) throw new Error(`no "## N. Title" sections found in ${scriptPath}`);

  const paths = discoverParts(join(project, "assets", "camera"));
  if (paths.length === 0) throw new Error(`no part<N>.mp4 files in ${join(project, "assets", "camera")}`);

  const parts: PreparedPart[] = [];
  for (const path of paths) {
    const info = await probe(path);
    if (!info.hasVideo) throw new Error(`${basename(path)} has no video stream`);
    const raw = await transcribe(path, { apiKey, lang: null, cacheDir });
    const clamped = clampWordEnds(raw, await detectSilences(path));
    const words = clamped
      .filter((w) => w.type === "word")
      .map((w, i) => ({ i, text: w.text, start: w.start, end: w.end }));
    const part = Number(/part(\d+)/i.exec(basename(path))![1]);
    parts.push({ part, file: basename(path), path, info, words });
    console.error(`  ${basename(path)}: ${info.duration.toFixed(1)}s, ${words.length} words`);
  }
  const fps = new Set(parts.map((p) => p.info.fps.toFixed(3)));
  if (fps.size > 1) throw new Error(`parts have mixed frame rates (${[...fps].join(", ")}); extract them as CFR 30 first`);

  const prep: Prepared = { project, parts, sections };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "prepare.json"), JSON.stringify(prep, null, 2));
  writeFileSync(join(outDir, "transcript.md"), formatTranscript(prep));
  console.error(`✅ ${join(outDir, "prepare.json")}\n✅ ${join(outDir, "transcript.md")}`);
  return prep;
}
