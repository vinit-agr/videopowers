import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseCliConfig, resolveApiKey, USAGE } from "./config.js";
import { assertBinaries } from "./ffmpeg.js";
import { probe } from "./probe.js";
import { transcribe } from "./transcribe.js";
import { clampWordEnds, detectSilences } from "./silence.js";
import { toPhrases } from "./phrases.js";
import { removeFillers } from "./fillers.js";
import { keepLastTakes } from "./retakes.js";
import { pacingPreset } from "./pacing.js";
import { buildEdl } from "./edl.js";
import { render } from "./render.js";
import { writeSidecars } from "./subtitles.js";
import { runProject } from "./project.js";
import { statSync } from "node:fs";
import type { Config, Edl } from "./types.js";

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

async function run(config: Config): Promise<void> {
  await assertBinaries();
  if (!existsSync(config.input)) throw new Error(`Input not found: ${config.input}`);

  const apiKey = resolveApiKey(config.apiKey, config.input);
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY not set. Pass --api-key, export ELEVENLABS_API_KEY, or add it to app/feynman-lib/.env",
    );
  }

  // A directory input = PROJECT mode (script.md + part<N>.mp4 recordings).
  if (statSync(config.input).isDirectory()) {
    await runProject(config, apiKey);
    return;
  }

  const info = await probe(config.input);
  if (info.hasVideo) {
    console.error(`source: ${info.width}x${info.height} @ ${info.fps.toFixed(0)}fps, ${fmt(info.duration)}`);
  } else {
    console.error(`source: audio-only, ${fmt(info.duration)}`);
    // Audio in, audio out — default the container to .m4a unless -o was given.
    if (!config.outputWasExplicit) {
      config.output = config.output.replace(/\.mp4$/i, ".m4a");
    }
  }

  // The input may be the only copy of the original footage — never write to it.
  // (Case-insensitive compare: macOS filesystems are case-insensitive by default.)
  if (resolve(config.output).toLowerCase() === resolve(config.input).toLowerCase()) {
    throw new Error(
      `Output would overwrite the input (${config.input}) — the original is never modified. Pick a different -o path.`,
    );
  }

  const rawWords = await transcribe(config.input, { apiKey, lang: config.lang, cacheDir: config.cacheDir });
  const spoken = rawWords.filter((w) => w.type === "word").length;
  console.error(`transcript: ${spoken} words`);

  const silences = await detectSilences(config.input);
  const words = clampWordEnds(rawWords, silences);

  const pacing = pacingPreset(config.pacing);
  const phrases = toPhrases(words, pacing.gapThreshold);

  const filler = removeFillers(phrases, {
    enabled: config.removeFillers,
    mode: config.fillerMode,
    edgeWords: config.fillerWords,
  });

  const retake = keepLastTakes(filler.phrases);

  const edl = buildEdl({
    source: config.input,
    keptPhrases: retake.kept,
    dropSpans: [...retake.droppedSpans, ...filler.removedSpans],
    removeSilences: config.removeSilences,
    pacing,
    duration: info.duration,
  });

  if (edl.ranges.length === 0) {
    throw new Error("Nothing left to keep after cleanup — loosen the options or check the input.");
  }

  report(config, info.duration, edl, filler.removed, retake.clusters);

  if (config.dryRun) {
    console.error("\n[dry-run] no files written.");
    return;
  }

  const workDir = await mkdtemp(join(tmpdir(), "frc-render-"));
  await render(edl, config.output, {
    quality: config.quality,
    crf: config.crf,
    preset: config.preset,
    normalize: config.normalize,
    workDir,
    fpsRational: info.fpsRational,
    hasVideo: info.hasVideo,
  });

  const outBase = config.output.replace(/\.[^./\\]+$/, "");
  const sidecars = await writeSidecars(edl, outBase, { json: config.json, srt: config.srt, vtt: config.vtt });

  console.error(`\n✅ ${config.output}`);
  for (const s of sidecars) console.error(`   ${s}`);
}

function report(config: Config, srcDur: number, edl: Edl, fillers: number, clusters: number): void {
  console.error("\ncleanup plan:");
  console.error(`  retake clusters collapsed: ${clusters}`);
  console.error(`  filler words removed:      ${fillers}`);
  console.error(`  kept segments:             ${edl.ranges.length}`);
  console.error(`  duration: ${fmt(srcDur)} → ${fmt(edl.totalDuration)}  (-${Math.round((1 - edl.totalDuration / srcDur) * 100)}%)`);
  if (config.dryRun) {
    console.error("\nsegments:");
    edl.ranges.forEach((r, i) => {
      console.error(`  [${String(i + 1).padStart(2)}] ${r.start.toFixed(2)}–${r.end.toFixed(2)}  ${r.note.slice(0, 64)}`);
    });
  }
}

async function main(): Promise<void> {
  const { config, help, error } = parseCliConfig(process.argv.slice(2));
  if (help) {
    console.log(USAGE);
    return;
  }
  if (error) {
    console.error(`error: ${error}\n`);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  try {
    await run(config);
  } catch (e) {
    console.error(`\nerror: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

void main();
