// cli.ts — natural-footage-rough-cut entry point.
//   prepare <project-dir> [--out-dir <dir>]
//   build   <project-dir> [--out-dir <dir>] [--to xml,mp4,resolve] [--dry-run] [--quality q] [--normalize]
import { parseArgs } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertBinaries } from "./ffmpeg.js";
import { resolveApiKey } from "../../../scripts/shared/env.js";
import { runPrepare } from "./prepare.js";
import type { Quality } from "./types.js";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const USAGE = `usage:
  pnpm prepare:cut <project-dir> [--out-dir <dir>]
  pnpm build:cut   <project-dir> [--out-dir <dir>] [--to xml,mp4,resolve] [--dry-run] [--quality native|1080p|720p|480p] [--normalize]`;

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      "out-dir": { type: "string" },
      to: { type: "string" },
      "dry-run": { type: "boolean" },
      quality: { type: "string" },
      normalize: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const project = positionals[0];
  if (values.help || !project || (cmd !== "prepare" && cmd !== "build")) {
    console.log(USAGE);
    if (!values.help) process.exitCode = 1;
    return;
  }
  const projectDir = resolve(project);
  const outDir = resolve(values["out-dir"] ?? join(projectDir, "rough-cut"));
  await assertBinaries();

  if (cmd === "prepare") {
    const apiKey = resolveApiKey(null, projectDir, SKILL_DIR);
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set (env, or a .env in the project dir / a parent / the skill dir)");
    await runPrepare(projectDir, outDir, apiKey, join(SKILL_DIR, ".cache"));
    return;
  }

  const quality = (values.quality ?? "native") as Quality;
  if (!["native", "1080p", "720p", "480p"].includes(quality)) throw new Error(`--quality must be native|1080p|720p|480p`);
  const { runBuild } = await import("./build.js");
  await runBuild(projectDir, outDir, {
    to: (values.to ?? "xml,mp4").split(",").map((s) => s.trim()),
    dryRun: values["dry-run"] ?? false,
    quality,
    normalize: values.normalize ?? false,
  });
}

main().catch((e: unknown) => {
  console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
