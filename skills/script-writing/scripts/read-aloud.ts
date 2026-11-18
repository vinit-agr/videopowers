// read-aloud.ts — the speaker's reading files, made from script.md.
//
//   build         script.md → read-aloud.md (Say text only, one code block per
//                 take, one sentence per line, link lines kept between blocks)
//   check         do script.md and read-aloud.md say the same words?
//   teleprompter  read-aloud.md → teleprompter.md (spoken words only)
//
// script.md stays the source for the parser downstream (footage-rough-cut,
// mg-setup). read-aloud.md is what the speaker reads and edits by hand, so
// `build` never overwrites one without --force, and `check` is how edits in
// either file are caught before recording.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { normTokens, parseScript, type ScriptModel } from "../../../scripts/shared/script.ts";

export interface ReadAloudBlock {
  /** The `## ` section the block sits under ("" before the first one). */
  section: string;
  lines: string[];
  /** Lines between this block and the next one (link lines, notes). */
  after: string[];
}

export interface ReadAloud {
  title: string | null;
  blocks: ReadAloudBlock[];
}

/** One take = one Say paragraph, as sentences. Grouped by beat. */
export function takes(model: ScriptModel): { section: string; sentences: string[] }[] {
  const out: { section: string; sentences: string[] }[] = [];
  let lastPara = -1;
  for (const s of model.sentences) {
    if (s.paragraphIndex !== lastPara) {
      out.push({ section: model.beats[s.beatIndex]!.title, sentences: [] });
      lastPara = s.paragraphIndex;
    }
    out[out.length - 1]!.sentences.push(s.text);
  }
  return out;
}

export function parseReadAloud(markdown: string): ReadAloud {
  const lines = markdown.split("\n");
  const blocks: ReadAloudBlock[] = [];
  let title: string | null = null;
  let section = "";
  let inBlock = false;
  let current: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("```")) {
      if (inBlock) {
        blocks.push({ section, lines: current, after: [] });
        current = [];
      }
      inBlock = !inBlock;
      continue;
    }
    if (inBlock) {
      if (t) current.push(t);
      continue;
    }
    if (/^#\s/.test(t)) {
      if (title === null) title = t.replace(/^#\s+/, "");
      continue;
    }
    if (/^##\s/.test(t)) {
      section = t.replace(/^##\s+/, "");
      continue;
    }
    if (t && blocks.length > 0) blocks[blocks.length - 1]!.after.push(t);
  }
  return { title, blocks };
}

const key = (lines: string[]) => normTokens(lines.join(" ")).join(" ");

/**
 * Builds read-aloud.md. If `previous` is given, a block whose words are
 * unchanged keeps the link lines that followed it there.
 */
export function buildReadAloud(model: ScriptModel, previous?: ReadAloud): string {
  const kept = new Map<string, string[]>();
  for (const b of previous?.blocks ?? []) if (b.after.length) kept.set(key(b.lines), b.after);
  const out: string[] = [`# ${model.title ?? "Read aloud"}`, ""];
  let section: string | null = null;
  for (const take of takes(model)) {
    if (take.section !== section) {
      out.push("", `## ${take.section}`, "");
      section = take.section;
    }
    out.push("```", ...take.sentences, "```");
    const links = kept.get(key(take.sentences));
    if (links) out.push("", ...links);
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export interface CheckResult {
  same: boolean;
  scriptWords: number;
  readAloudWords: number;
  /** Where the two first differ, with a few words either side. */
  scriptAt?: string;
  readAloudAt?: string;
}

export function check(model: ScriptModel, readAloud: ReadAloud): CheckResult {
  const a = model.sentences.flatMap((s) => s.tokens);
  const b = readAloud.blocks.flatMap((bl) => normTokens(bl.lines.join(" ")));
  const res: CheckResult = { same: true, scriptWords: a.length, readAloudWords: b.length };
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return res;
  // Trim the common tail too, so the report shows only the changed stretch.
  let ea = a.length, eb = b.length;
  while (ea > i && eb > i && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const span = (t: string[], end: number) =>
    `…${t.slice(Math.max(0, i - 6), i).join(" ")} [${t.slice(i, Math.min(end, i + 25)).join(" ")}] ${t.slice(end, end + 6).join(" ")}…`;
  return { ...res, same: false, scriptAt: span(a, ea), readAloudAt: span(b, eb) };
}

/** Lines a Markdown viewer would turn into a list, heading or quote. */
const SPECIAL = /^([-*+]\s|\d+[.)]\s|#|>)/;

export function teleprompter(readAloud: ReadAloud): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  const takesOut = readAloud.blocks.map((b) => {
    for (const l of b.lines) if (SPECIAL.test(l)) warnings.push(`renders as Markdown: "${l}"`);
    return b.lines.join("\n");
  });
  return { text: takesOut.join("\n\n") + "\n", warnings };
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const [cmd, first, second] = process.argv.slice(2);
  const usage =
    "usage:\n" +
    "  read-aloud build <script.md> [--out read-aloud.md] [--force]\n" +
    "  read-aloud check <script.md> <read-aloud.md>\n" +
    "  read-aloud teleprompter <read-aloud.md> [--out teleprompter.md]";
  if (!cmd || !first) {
    console.error(usage);
    process.exit(2);
  }
  if (cmd === "build") {
    const out = arg("--out") ?? first.replace(/script\.md$/, "read-aloud.md");
    const exists = existsSync(out);
    if (exists && !process.argv.includes("--force")) {
      console.error(`${out} exists and may hold the speaker's edits. Run check first; rebuild with --force only if they are in script.md.`);
      process.exit(1);
    }
    const model = parseScript(readFileSync(first, "utf8"));
    const previous = exists ? parseReadAloud(readFileSync(out, "utf8")) : undefined;
    writeFileSync(out, buildReadAloud(model, previous));
    console.log(`${out}: ${takes(model).length} takes, ${model.sentences.flatMap((s) => s.tokens).length} words`);
  } else if (cmd === "check") {
    if (!second) { console.error(usage); process.exit(2); }
    const r = check(parseScript(readFileSync(first, "utf8")), parseReadAloud(readFileSync(second, "utf8")));
    if (r.same) {
      console.log(`same words: ${r.scriptWords}`);
    } else {
      console.log(`different: script.md ${r.scriptWords} words, read-aloud.md ${r.readAloudWords}`);
      console.log(`  script.md:     ${r.scriptAt}`);
      console.log(`  read-aloud.md: ${r.readAloudAt}`);
      process.exit(1);
    }
  } else if (cmd === "teleprompter") {
    const out = arg("--out") ?? first.replace(/read-aloud\.md$/, "teleprompter.md");
    const { text, warnings } = teleprompter(parseReadAloud(readFileSync(first, "utf8")));
    writeFileSync(out, text);
    console.log(`${out}: ${normTokens(text).length} words`);
    for (const w of warnings) console.log(`  warning: ${w}`);
  } else {
    console.error(usage);
    process.exit(2);
  }
}

if (process.argv[1] && /read-aloud\.ts$/.test(process.argv[1])) main();
