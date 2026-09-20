// plan.ts — run the cleanup pipeline but STOP before rendering: write the cut
// plan as JSON instead. Used by the rough-cut-to-DaVinci-Resolve workflow,
// where the cuts become trimmable timeline clips rather than a rendered file.
//
// Usage:  tsx scripts/plan.ts <input.mp4> [-o out.cutplan.json] [same flags as cli.ts]
//
// The JSON's `ranges` are kept slices of the *input file's* timeline, in both
// seconds (authoritative) and frames at the probed fps (for NLE building;
// endFrame is exclusive).

import { existsSync, writeFileSync } from "node:fs";
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

async function main(): Promise<void> {
  const { config, help, error } = parseCliConfig(process.argv.slice(2));
  if (help) {
    console.log(USAGE);
    return;
  }
  if (error) {
    console.error(`error: ${error}\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  await assertBinaries();
  if (!existsSync(config.input)) throw new Error(`Input not found: ${config.input}`);

  const apiKey = resolveApiKey(config.apiKey, config.input);
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set (flag, env, or app/*/.env)");

  const outPath = config.outputWasExplicit && config.output.endsWith(".json")
    ? config.output
    : config.input.replace(/\.[^./\\]+$/, "") + ".cutplan.json";

  const info = await probe(config.input);
  console.error(`source: ${info.width}x${info.height} @ ${info.fps}fps, ${info.duration.toFixed(2)}s`);

  const rawWords = await transcribe(config.input, { apiKey, lang: config.lang, cacheDir: config.cacheDir });
  console.error(`transcript: ${rawWords.filter((w) => w.type === "word").length} words`);

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
  if (edl.ranges.length === 0) throw new Error("Nothing left to keep — loosen options or check input.");

  const fps = info.fps;
  const plan = {
    source: config.input,
    generatedAt: new Date().toISOString(),
    video: { width: info.width, height: info.height, fps, fpsRational: info.fpsRational, duration: info.duration },
    options: {
      pacing: config.pacing,
      removeSilences: config.removeSilences,
      removeFillers: config.removeFillers,
      fillerMode: config.fillerMode,
    },
    stats: {
      retakeClustersCollapsed: retake.clusters,
      fillerWordsRemoved: filler.removed,
      keptSegments: edl.ranges.length,
      sourceDuration: info.duration,
      keptDuration: edl.totalDuration,
      removedPct: Math.round((1 - edl.totalDuration / info.duration) * 100),
    },
    ranges: edl.ranges.map((r, i) => ({
      index: i + 1,
      start: r.start,
      end: r.end,
      startFrame: Math.round(r.start * fps),
      endFrame: Math.round(r.end * fps), // exclusive
      duration: Math.round((r.end - r.start) * 1000) / 1000,
      text: r.note || r.words.map((w) => w.text).join(""),
    })),
  };

  writeFileSync(outPath, JSON.stringify(plan, null, 2));
  console.error(
    `\nplan: ${plan.stats.keptSegments} segments, ` +
      `${info.duration.toFixed(1)}s → ${edl.totalDuration.toFixed(1)}s (-${plan.stats.removedPct}%), ` +
      `${retake.clusters} retake clusters, ${filler.removed} fillers`,
  );
  console.error(`✅ ${outPath}`);
}

main().catch((e) => {
  console.error(`\nerror: ${(e as Error).message}`);
  process.exitCode = 1;
});
