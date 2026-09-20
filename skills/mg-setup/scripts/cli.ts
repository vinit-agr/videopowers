import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ChapterMismatchError, makeChapters, slugify } from "./beats.js";
import { detectGaps } from "./blackdetect.js";
import { parseCliConfig, resolveApiKey, USAGE } from "./config.js";
import { assertBinaries } from "./ffmpeg.js";
import { makeMezzanine } from "./mezzanine.js";
import { probe } from "./probe.js";
import { chapterTable, fmtTime, mediaWarnings, mismatchTable } from "./report.js";
import { loadScript } from "./script.js";
import { copyTemplate, installAndCheck, patchPackageName, writeGenerated } from "./scaffold.js";
import { transcribe } from "./transcribe.js";
import type { BeatSheet } from "./types.js";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const TEMPLATE_DIR = join(SKILL_DIR, "..", "..", "templates", "remotion-project");

async function main(): Promise<void> {
  const { config, help, error } = parseCliConfig(process.argv.slice(2), SKILL_DIR);
  if (help || error) {
    if (error) console.error(`error: ${error}\n`);
    console.log(USAGE);
    process.exit(error ? 2 : 0);
  }
  const cfg = config!;
  await assertBinaries();

  if (!existsSync(cfg.scriptPath)) throw new Error(`script not found: ${cfg.scriptPath}`);
  if (!existsSync(cfg.input)) throw new Error(`input not found: ${cfg.input}`);
  if (!existsSync(TEMPLATE_DIR)) throw new Error(`template missing: ${TEMPLATE_DIR}`);

  const projectDir = resolve(cfg.projectDir);
  const slug = slugify(basename(projectDir));

  // 1. Script → beats
  const script = loadScript(cfg.scriptPath);
  if (script.beats.length === 0) {
    throw new Error(`${cfg.scriptPath} has no beats (## headings containing **Say:** blocks).`);
  }
  const beatTitles = script.beats.map((b) => b.title);
  console.log(`script: ${script.beats.length} beats, ${script.sentences.length} sentences`);

  // 2. Probe
  const media = await probe(cfg.input);
  console.log(
    `input:  ${media.width}x${media.height} ${media.videoCodec} ${media.pixFmt} ` +
      `${media.fps.toFixed(3)}fps ${fmtTime(media.duration)}`,
  );

  // 3–4. Chapter markers → zip with beats (hard stop on mismatch)
  console.log(`detecting chapter gaps (black ≥ ${cfg.threshold}s)…`);
  const gaps = await detectGaps(cfg.input, cfg.threshold);
  let chapters;
  try {
    chapters = makeChapters(beatTitles, gaps, media.duration, cfg.fps);
  } catch (e) {
    if (e instanceof ChapterMismatchError) {
      console.error(`\n✗ ${e.message}\n`);
      console.error(mismatchTable(beatTitles, gaps, media.duration));
      process.exit(1);
    }
    throw e;
  }

  // 5. Report
  console.log(`\nchapters (${chapters.length}):`);
  console.log(chapterTable(chapters));
  const warnings = mediaWarnings(media, chapters);
  for (const w of warnings) console.log(`  ⚠ ${w}`);

  const durationInFrames = Math.round(media.duration * cfg.fps);
  const sheet: BeatSheet = {
    slug,
    title: script.title ?? basename(projectDir),
    fps: cfg.fps,
    width: 1920,
    height: 1080,
    durationSec: media.duration,
    durationInFrames,
    chapters,
    input: resolve(cfg.input),
    generatedAt: new Date().toISOString(),
  };

  if (cfg.dryRun) {
    console.log(`\ndry run — nothing written. Would scaffold: ${cfg.outDir}`);
    return;
  }

  // Fail before any slow/paid step if the key is missing.
  const apiKey = resolveApiKey(cfg.apiKey, projectDir, SKILL_DIR);
  if (!apiKey) {
    throw new Error(
      "No ElevenLabs API key. Set ELEVENLABS_API_KEY, pass --api-key, or put it in a .env " +
        "(project dir or any parent, or the skill folder).",
    );
  }

  // 6. Mezzanine
  const mezzPath = join(cfg.outDir, "public", "footage.mp4");
  if (existsSync(mezzPath) && !cfg.force) {
    console.log(`\nmezzanine exists, keeping: ${mezzPath} (--force to rebuild)`);
  } else {
    console.log(`\nencoding mezzanine (1080p${cfg.fps} 8-bit H.264, audio copied)…`);
    await makeMezzanine(cfg.input, mezzPath, cfg.fps);
  }

  // 7. Transcribe (cached by content hash)
  console.log("transcribing mezzanine (ElevenLabs Scribe, cached)…");
  const words = await transcribe(mezzPath, { apiKey, lang: cfg.lang, cacheDir: cfg.cacheDir });
  const spoken = words.filter((w) => (w.type ?? "word") === "word").length;
  console.log(`words: ${spoken} spoken tokens`);

  // 8. Scaffold + generated files + install + boot check
  const fresh = !existsSync(join(cfg.outDir, "package.json"));
  const copyResult = await copyTemplate(TEMPLATE_DIR, cfg.outDir, cfg.force);
  if (fresh || cfg.force) await patchPackageName(cfg.outDir, slug);
  const generated = await writeGenerated(cfg.outDir, sheet, words, {
    input: resolve(cfg.input),
    probe: media,
    note: "Original final cut — mg-render derives its full-resolution render source from this file.",
  });
  console.log(
    `scaffold: ${copyResult.copied.length} file(s) copied, ${copyResult.skipped.length} kept, ` +
      `${generated.length} generated`,
  );

  if (cfg.skipInstall) {
    console.log("skipping pnpm install + typecheck (--skip-install)");
  } else {
    console.log("pnpm install + typecheck…");
    await installAndCheck(cfg.outDir);
  }

  console.log(`\n✓ ${cfg.outDir}`);
  console.log(`  next: cd ${cfg.outDir} && pnpm studio  (comp "main", sync overlay on by default)`);
}

main().catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
