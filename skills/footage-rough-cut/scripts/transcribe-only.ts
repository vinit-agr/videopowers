// Transcribe-only: word-level timestamps for a media file, with NO cutting.
//
// Reuses the cleanup pipeline's Scribe client and sidecar writers by building a
// single-range EDL spanning the whole source. Because that range starts at 0,
// the output-timeline mapping in subtitles.ts collapses to identity, so every
// stamp is a SOURCE timestamp.

import { writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveApiKey } from "./config.js";
import { probe } from "./probe.js";
import { transcribe } from "./transcribe.js";
import { writeSidecars } from "./subtitles.js";
import type { Edl } from "./types.js";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

const USAGE = `transcribe-only — word-level transcript of a media file (no edits).

Usage:
  tsx scripts/transcribe-only.ts <input> [options]

Options:
  -o, --out-base <path>   Output base path (default: alongside input, same name)
  --lang <code>           Language hint for Scribe (default: auto-detect)
  --cache-dir <path>      Transcript cache (default: <skill>/.cache)
  --api-key <key>         ElevenLabs key (else ELEVENLABS_API_KEY / .env)
  -h, --help              Show this help
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      "out-base": { type: "string", short: "o" },
      lang: { type: "string" },
      "cache-dir": { type: "string" },
      "api-key": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    process.stdout.write(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const input = positionals[0]!;
  const outBase = values["out-base"] ?? join(dirname(input), basename(input, extname(input)));
  const apiKey = resolveApiKey(values["api-key"] ?? null, input);
  if (!apiKey) throw new Error("No ElevenLabs API key (set ELEVENLABS_API_KEY or add it to a known .env).");

  const info = await probe(input);
  console.log(
    `source: ${basename(input)} — ${info.width}x${info.height} @ ${info.fps.toFixed(2)}fps, ${info.duration.toFixed(1)}s`,
  );

  console.log("transcribing with ElevenLabs Scribe (cached by file hash)…");
  const words = await transcribe(input, {
    apiKey,
    lang: values.lang ?? null,
    cacheDir: values["cache-dir"] ?? join(SKILL_DIR, ".cache"),
  });

  // One range covering the entire source => sidecar stamps stay on the source timeline.
  const edl: Edl = {
    source: input,
    ranges: [{ start: 0, end: info.duration, words, note: "full source" }],
    totalDuration: info.duration,
  };

  const written = await writeSidecars(edl, outBase, { json: true, srt: true, vtt: true });

  // Plain reading copy: Scribe's `spacing` tokens already carry the whitespace.
  const txtPath = `${outBase}.txt`;
  await writeFile(txtPath, words.map((w) => w.text).join("").trim() + "\n");
  written.push(txtPath);

  const spoken = words.filter((w) => w.type === "word");
  const events = words.filter((w) => w.type === "audio_event");
  console.log(`\n${spoken.length} words${events.length ? `, ${events.length} audio events` : ""}`);
  for (const p of written) console.log(`  wrote ${p}`);
}

main().catch((e) => {
  console.error(`transcribe-only failed: ${(e as Error).message}`);
  process.exit(1);
});
