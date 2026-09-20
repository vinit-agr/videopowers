import { join } from "node:path";
import { parseArgs } from "node:util";

export { resolveApiKey } from "../../../scripts/shared/env.js";

export const USAGE = `mg-setup — turn a final-cut MP4 + script.md into a per-video Remotion project.

  tsx scripts/cli.ts <project-dir> --input <final-cut.mp4> [options]

  Expects <project-dir>/script.md (beats = ## headings with **Say:** blocks).
  The final cut must carry ~2s black gaps between chapters (the pipeline's
  machine-readable chapter markers). Scaffolds <project-dir>/remotion/.

  --input <path>        Final-cut video file (required)
  --script <path>       Script file (default: <project-dir>/script.md)
  --out-dir <path>      Remotion project dir (default: <project-dir>/remotion)
  --threshold <s>       Minimum black duration counted as a chapter gap (default: 1.5)
  --fps <n>             Composition fps (default: 30)
  --lang <code>         Language hint for Scribe (default: auto-detect)
  --dry-run             Probe, detect chapters, print the report, write nothing
  --force               Re-copy template files and rebuild the mezzanine even if present
  --skip-install        Skip pnpm install + typecheck (CI/offline)
  --cache-dir <path>    Transcript cache (default: <skill>/.cache)
  --api-key <key>       ElevenLabs key (else ELEVENLABS_API_KEY / .env discovery)
  -h, --help            Show this help
`;

export interface Config {
  projectDir: string;
  input: string;
  scriptPath: string;
  outDir: string;
  threshold: number;
  fps: number;
  lang: string | null;
  dryRun: boolean;
  force: boolean;
  skipInstall: boolean;
  cacheDir: string;
  apiKey: string | null;
}

export interface ParsedCli {
  config: Config | null;
  help: boolean;
  error?: string;
}

export function parseCliConfig(argv: string[], skillDir: string): ParsedCli {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        input: { type: "string" },
        script: { type: "string" },
        "out-dir": { type: "string" },
        threshold: { type: "string" },
        fps: { type: "string" },
        lang: { type: "string" },
        "dry-run": { type: "boolean" },
        force: { type: "boolean" },
        "skip-install": { type: "boolean" },
        "cache-dir": { type: "string" },
        "api-key": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    return { config: null, help: false, error: (e as Error).message };
  }

  const v = parsed.values as Record<string, string | boolean | undefined>;
  const str = (x: string | boolean | undefined): string | undefined => (typeof x === "string" ? x : undefined);
  if (v.help === true) return { config: null, help: true };

  const projectDir = parsed.positionals[0];
  if (!projectDir) return { config: null, help: false, error: "No project directory given." };
  const input = str(v.input);
  if (!input) return { config: null, help: false, error: "--input <final-cut.mp4> is required." };

  const threshold = v.threshold !== undefined ? Number(v.threshold) : 1.5;
  const fps = v.fps !== undefined ? Number(v.fps) : 30;
  if (!Number.isFinite(threshold) || threshold <= 0) return { config: null, help: false, error: "--threshold must be a positive number" };
  if (!Number.isFinite(fps) || fps <= 0) return { config: null, help: false, error: "--fps must be a positive number" };

  return {
    help: false,
    config: {
      projectDir,
      input,
      scriptPath: str(v.script) ?? join(projectDir, "script.md"),
      outDir: str(v["out-dir"]) ?? join(projectDir, "remotion"),
      threshold,
      fps,
      lang: str(v.lang) ?? null,
      dryRun: v["dry-run"] === true,
      force: v.force === true,
      skipInstall: v["skip-install"] === true,
      cacheDir: str(v["cache-dir"]) ?? join(skillDir, ".cache"),
      apiKey: str(v["api-key"]) ?? null,
    },
  };
}
