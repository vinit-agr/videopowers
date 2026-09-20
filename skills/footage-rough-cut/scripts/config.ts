import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveApiKey as sharedResolveApiKey } from "../../../scripts/shared/env.js";
import type { Config, FillerMode, Pacing, PauseBudgets, Quality } from "./types.js";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

export const USAGE = `footage-rough-cut — build a script-aware rough cut from a multi-part
talking-head recording, or clean a single video/audio file.

PROJECT MODE (input is a project directory):
  tsx scripts/cli.ts <project-dir> [options]

  Expects <project-dir>/script.md (beats = ## headings with **Say:** blocks)
  and <project-dir>/assets/camera/part<N>.mp4 in recording order. Retakes are
  detected against the script (keep-last), and air at each join is sized by
  the script hierarchy: sentence / concept (paragraph) / beat (black gap).

  --to <list>                Outputs, comma-separated: xml,mp4,resolve (default: xml)
                             xml     → FCP XML timeline (Resolve: File → Import Timeline)
                             mp4     → baked rough-cut video + subtitle sidecars
                             resolve → live append into DaVinci Resolve via the
                                       scripting bridge (Resolve must be open)
  --script <path>            Script file (default: <project-dir>/script.md)
  --parts-dir <path>         Recordings dir (default: <project-dir>/assets/camera)
  --out-dir <path>           Output dir (default: <project-dir>/rough-cut)
  --name <name>              Timeline/sequence name (default: "<dir> rough cut")
  --pause-preset <p>         tight | medium | loose (default: medium)
  --sentence-pause <s>       Air between sentences (default: preset; medium 0.15)
  --concept-pause <s>        Air between paragraphs/concepts (default: preset; medium 0.35)
  --beat-gap <s>             Black gap between beats (default: preset; medium 2.0)

SINGLE-FILE MODE (input is a media file — the original voice-cleanup):
  tsx scripts/cli.ts <input.mp4> [options]
  -o, --output <path>        Output (default: <name>.clean.mp4; audio → .clean.m4a)
  --pacing <p>               tight | medium | loose gap collapse (default: tight)

COMMON:
  --no-remove-silences       Keep pauses; only drop retakes + fillers
  --no-remove-fillers        Keep filler words
  --filler-mode <m>          safe | aggressive (default: safe)
  --filler-words "a,b,c"     Override the edge-filler list
  --quality <q>              native | 1080p (default: native)
  --crf <n>                  libx264 CRF (default: 18)
  --preset <p>               libx264 preset (default: medium)
  --no-normalize             Skip -14 LUFS loudness normalization
  --lang <code>              Language hint for Scribe (default: auto-detect)
  --no-srt / --no-vtt / --no-json   Skip subtitle/word sidecars (mp4 outputs)
  --dry-run                  Print the cut plan and exit (no files written)
  --cache-dir <path>         Transcript cache (default: <skill>/.cache)
  --api-key <key>            ElevenLabs key (else ELEVENLABS_API_KEY / .env)
  -h, --help                 Show this help
`;

/**
 * Resolve the Scribe key: explicit flag → env var → .env files walking up
 * from the input (project dir or media file), then the skill's own .env.
 */
export function resolveApiKey(explicit: string | null, startPath?: string): string | null {
  return sharedResolveApiKey(explicit, startPath ?? process.cwd(), SKILL_DIR);
}

const PACINGS = new Set(["tight", "medium", "loose"]);
const QUALITIES = new Set(["native", "1080p"]);
const MODES = new Set(["safe", "aggressive"]);
const OUTPUTS = new Set(["xml", "mp4", "resolve"]);

/**
 * Pause-budget presets for project mode (seconds). "medium" (the default) is
 * calibrated from Vinit's own manual Resolve edit of the harness video
 * (151 measured joins: ~0.12s median, ~0.35s p90) and confirmed by ear on
 * the v2 timeline 2026-09-19.
 */
export const PAUSE_PRESETS: Record<Pacing, PauseBudgets> = {
  tight: { sentence: 0.1, concept: 0.25, beat: 1.5 },
  medium: { sentence: 0.15, concept: 0.35, beat: 2.0 },
  loose: { sentence: 0.5, concept: 1.0, beat: 3.0 },
};

export interface ParsedCli {
  config: Config;
  help: boolean;
  error?: string;
}

export function parseCliConfig(argv: string[]): ParsedCli {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        output: { type: "string", short: "o" },
        "remove-silences": { type: "boolean" },
        "no-remove-silences": { type: "boolean" },
        "remove-fillers": { type: "boolean" },
        "no-remove-fillers": { type: "boolean" },
        "filler-mode": { type: "string" },
        "filler-words": { type: "string" },
        take: { type: "string" },
        pacing: { type: "string" },
        quality: { type: "string" },
        crf: { type: "string" },
        preset: { type: "string" },
        normalize: { type: "boolean" },
        "no-normalize": { type: "boolean" },
        lang: { type: "string" },
        "no-srt": { type: "boolean" },
        "no-vtt": { type: "boolean" },
        "no-json": { type: "boolean" },
        "dry-run": { type: "boolean" },
        "cache-dir": { type: "string" },
        "api-key": { type: "string" },
        to: { type: "string" },
        script: { type: "string" },
        "parts-dir": { type: "string" },
        "out-dir": { type: "string" },
        name: { type: "string" },
        "pause-preset": { type: "string" },
        "sentence-pause": { type: "string" },
        "concept-pause": { type: "string" },
        "beat-gap": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    return { config: blankConfig(), help: false, error: (e as Error).message };
  }

  const raw = parsed.values as Record<string, string | boolean | undefined>;
  const str = (x: string | boolean | undefined): string | undefined => (typeof x === "string" ? x : undefined);
  const on = (x: string | boolean | undefined): boolean => x === true;

  const help = on(raw.help);
  const input = parsed.positionals[0];
  if (!help && !input) return { config: blankConfig(), help, error: "No input given." };

  const pacing = (str(raw.pacing) ?? "tight") as Pacing;
  const quality = (str(raw.quality) ?? "native") as Quality;
  const fillerMode = (str(raw["filler-mode"]) ?? "safe") as FillerMode;
  const take = str(raw.take);
  const pausePreset = (str(raw["pause-preset"]) ?? "medium") as Pacing;
  if (str(raw.pacing) && !PACINGS.has(pacing)) return err(`--pacing must be tight|medium|loose`);
  if (str(raw["pause-preset"]) && !PACINGS.has(pausePreset)) return err(`--pause-preset must be tight|medium|loose`);
  if (str(raw.quality) && !QUALITIES.has(quality)) return err(`--quality must be native|1080p`);
  if (str(raw["filler-mode"]) && !MODES.has(fillerMode)) return err(`--filler-mode must be safe|aggressive`);
  if (take && take !== "last") return err(`--take "best" is not available in v1; use --take last`);

  const to = (str(raw.to) ?? "xml").split(",").map((s) => s.trim()).filter(Boolean);
  for (const t of to) if (!OUTPUTS.has(t)) return err(`--to entries must be xml|mp4|resolve (got "${t}")`);

  const num = (x: string | undefined, name: string): number | null | { err: string } => {
    if (x === undefined) return null;
    const v = Number(x);
    return Number.isFinite(v) && v >= 0 ? v : { err: `${name} must be a non-negative number` };
  };
  const sp = num(str(raw["sentence-pause"]), "--sentence-pause");
  const cp = num(str(raw["concept-pause"]), "--concept-pause");
  const bg = num(str(raw["beat-gap"]), "--beat-gap");
  for (const v of [sp, cp, bg]) if (v && typeof v === "object") return err(v.err);
  const preset = PAUSE_PRESETS[pausePreset];
  const budgets: PauseBudgets = {
    sentence: (sp as number | null) ?? preset.sentence,
    concept: (cp as number | null) ?? preset.concept,
    beat: (bg as number | null) ?? preset.beat,
  };

  const inPath = input ?? "";
  const fillerWords = str(raw["filler-words"]);
  const crfStr = str(raw.crf);
  const output =
    str(raw.output) ?? (inPath ? join(dirname(inPath), `${basename(inPath, extname(inPath))}.clean.mp4`) : "");

  const config: Config = {
    input: inPath,
    output,
    outputWasExplicit: Boolean(str(raw.output)),
    removeSilences: !on(raw["no-remove-silences"]),
    removeFillers: !on(raw["no-remove-fillers"]),
    fillerMode,
    fillerWords: fillerWords ? fillerWords.split(",").map((s) => s.trim()).filter(Boolean) : null,
    take: "last",
    pacing,
    quality,
    crf: crfStr ? Number(crfStr) : 18,
    preset: str(raw.preset) ?? "medium",
    normalize: !on(raw["no-normalize"]),
    lang: str(raw.lang) ?? null,
    srt: !on(raw["no-srt"]),
    vtt: !on(raw["no-vtt"]),
    json: !on(raw["no-json"]),
    dryRun: on(raw["dry-run"]),
    cacheDir: str(raw["cache-dir"]) ?? join(SKILL_DIR, ".cache"),
    apiKey: str(raw["api-key"]) ?? null,
    to,
    scriptPath: str(raw.script) ?? null,
    partsDir: str(raw["parts-dir"]) ?? null,
    outDir: str(raw["out-dir"]) ?? null,
    seqName: str(raw.name) ?? null,
    budgets,
  };

  if (Number.isNaN(config.crf)) return err("--crf must be a number");
  return { config, help };
}

function blankConfig(): Config {
  return {
    input: "", output: "", outputWasExplicit: false,
    removeSilences: true, removeFillers: true, fillerMode: "safe",
    fillerWords: null, take: "last", pacing: "tight", quality: "native", crf: 18,
    preset: "medium", normalize: true, lang: null, srt: true, vtt: true, json: true,
    dryRun: false, cacheDir: join(SKILL_DIR, ".cache"), apiKey: null,
    to: ["xml"], scriptPath: null, partsDir: null, outDir: null, seqName: null,
    budgets: PAUSE_PRESETS.medium,
  };
}

function err(message: string): ParsedCli {
  return { config: blankConfig(), help: false, error: message };
}
