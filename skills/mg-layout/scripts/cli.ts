import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { lintShots } from "./lint.js";
import { renderLayoutMd, renderMediaShotsMd, renderShotsTs } from "./render.js";
import { resolveShots } from "./resolve.js";
import type { BeatSheet, Problem, Word, YamlShot } from "./types.js";

const USAGE = `mg-layout — lint the layout doc and apply it to the composition.

  tsx scripts/cli.ts <remotion-project-dir> lint
  tsx scripts/cli.ts <remotion-project-dir> apply

  Expects, inside <remotion-project-dir>:
    layout/layout.yaml        the layout doc (source of truth)
    src/data/beat-sheet.json  from mg-setup
    src/data/words.json       from mg-setup

  lint   resolves anchors + checks rhythm rules; errors and warnings, no writes
  apply  lint (errors block), then writes src/layout/shots.ts and regenerates
         layout/layout.md + layout/media-shots.md
`;

function load(dir: string): { yaml: Record<string, YamlShot[]>; sheet: BeatSheet; words: Word[] } {
  const yamlPath = join(dir, "layout", "layout.yaml");
  const sheetPath = join(dir, "src", "data", "beat-sheet.json");
  const wordsPath = join(dir, "src", "data", "words.json");
  for (const p of [yamlPath, sheetPath, wordsPath]) {
    if (!existsSync(p)) throw new Error(`missing ${p}`);
  }
  const yaml = parseYaml(readFileSync(yamlPath, "utf8")) as Record<string, YamlShot[]>;
  if (!yaml || typeof yaml !== "object" || Array.isArray(yaml)) {
    throw new Error("layout.yaml must be a mapping of chapter id → list of shots");
  }
  const sheet = JSON.parse(readFileSync(sheetPath, "utf8")) as BeatSheet;
  const words = JSON.parse(readFileSync(wordsPath, "utf8")) as Word[];
  return { yaml, sheet, words };
}

function print(problems: Problem[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const p of problems) {
    if (p.level === "error") {
      errors++;
      console.error(`  ✗ [${p.where}] ${p.message}`);
    } else {
      warnings++;
      console.log(`  ⚠ [${p.where}] ${p.message}`);
    }
  }
  return { errors, warnings };
}

async function main(): Promise<void> {
  const [dirArg, cmd] = process.argv.slice(2);
  if (!dirArg || !cmd || !["lint", "apply"].includes(cmd)) {
    console.log(USAGE);
    process.exit(dirArg || cmd ? 2 : 0);
  }
  const dir = resolve(dirArg);
  const { yaml, sheet, words } = load(dir);

  const { shots, problems } = resolveShots(yaml, sheet, words);
  const all = [...problems, ...lintShots(shots)];
  const yamlShots = shots.filter((s) => s.origin === "yaml").length;
  console.log(`shots: ${yamlShots} from yaml, ${shots.length - yamlShots} generated (leads + chapter cards)`);
  const { errors, warnings } = print(all);
  console.log(`${errors} error(s), ${warnings} warning(s)`);

  if (cmd === "lint") {
    process.exit(errors > 0 ? 1 : 0);
  }
  if (errors > 0) {
    console.error("apply blocked — fix the errors in layout.yaml first");
    process.exit(1);
  }

  const files: Array<[string, string]> = [
    [join(dir, "src", "layout", "shots.ts"), renderShotsTs(shots)],
    [join(dir, "layout", "layout.md"), renderLayoutMd(shots, sheet)],
    [join(dir, "layout", "media-shots.md"), renderMediaShotsMd(shots)],
  ];
  for (const [path, content] of files) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    console.log(`  wrote ${path}`);
  }
  console.log("✓ applied — reload Studio to review");
}

main().catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
