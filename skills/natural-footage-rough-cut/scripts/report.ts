// report.ts — rough-cut.report.md (also printed to the terminal) and marker notes.
import { spanText, type Call, type EditFile, type Span } from "./edit.js";
import type { Prepared } from "./prepared.js";
import type { CutPlan } from "./types.js";

export const REVIEW_FILE = "rough-cut.review.mp4";

export function markerNote(call: Call, outDirName: string): string {
  return `Judgment call ${call.id}: ${call.reason} Alternatives in ${outDirName}/${REVIEW_FILE} (Call ${call.id}).`;
}

export function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(1).padStart(4, "0")}`;
}

function where(s: Span, prep: Prepared): string {
  const part = prep.parts.find((p) => p.part === s.part);
  const w = part?.words[s.from];
  return `${part?.file ?? `part${s.part}`} @ ${w ? clock(w.start) : "?"}`;
}

const STATUS: Record<string, string> = { exact: "✅ exact", "facts-ok": "✅ facts OK, wording differs", wrong: "❌ wrong", missing: "⚠️ missing" };

export function renderReport(
  edit: EditFile,
  prep: Prepared,
  plan: CutPlan,
  callFrames: Map<number, number>,
  outDirName: string,
): string {
  const out: string[] = ["# Rough cut report", ""];
  const recorded = new Set(edit.sections.filter((s) => s.spans.length > 0).map((s) => s.section));

  out.push("## Missing", "");
  if (edit.missing.length === 0) out.push("Nothing missing in the recorded sections.");
  for (const m of edit.missing) out.push(`- **${m.section} / ${m.card}**: ${m.what}`);
  const notRecorded = prep.sections.filter((s) => !recorded.has(s.number)).map((s) => s.number);
  if (notRecorded.length) out.push("", `Not recorded: sections ${notRecorded.join(", ")}.`);
  out.push("");

  out.push("## 🔒 check", "", "| Section / card | Fixed line | Said | Result |", "|---|---|---|---|");
  for (const l of edit.locks) {
    const cell = (t: string) => t.replace(/\|/g, "\\|");
    out.push(`| ${l.section} / ${l.card} | ${cell(l.line)} | ${cell(l.said ?? "—")} | ${STATUS[l.status]}${l.note ? ` (${cell(l.note)})` : ""} |`);
  }
  out.push("");

  out.push("## Judgment calls", "");
  if (edit.calls.length === 0) out.push("None.");
  else out.push(`Watch the alternatives in \`${outDirName}/${REVIEW_FILE}\`; the numbered markers on the timeline match these calls.`, "");
  for (const c of edit.calls) {
    const f = callFrames.get(c.id);
    const at = f === undefined ? "not in cut" : clock(f / plan.fps);
    out.push(`- **Call ${c.id}** (${at} in the cut, ${c.kind}): ${c.reason}`);
    out.push(`  - kept: "${spanText(c.kept, prep)}" (${where(c.kept, prep)})`);
    c.alternatives.forEach((a, k) => out.push(`  - alternative ${k + 1}: "${spanText(a, prep)}" (${where(a, prep)})`));
  }
  out.push("");

  out.push("## Removed attempts", "", "<details><summary>" + `${edit.removed.length} removed — each next to what was kept` + "</summary>", "");
  for (const r of edit.removed) {
    out.push(`- ✂ ${where(r, prep)}: "${spanText(r, prep)}" — ${r.why}`);
    if (r.keptInstead) out.push(`  - ↳ kept: "${spanText(r.keptInstead, prep)}" (${where(r.keptInstead, prep)})`);
  }
  out.push("", "</details>", "");

  const raw = prep.parts.reduce((t, p) => t + p.info.duration, 0);
  const clips = plan.segments.filter((s) => s.kind === "clip");
  const blacks = plan.segments.filter((s) => s.kind === "black");
  const spoken = clips.reduce((t, s) => t + (s.kind === "clip" ? s.words.length : 0), 0);
  const talk = plan.totalDuration - blacks.reduce((t, s) => t + (s.kind === "black" ? s.duration : 0), 0);
  out.push(
    "## Stats",
    "",
    `- ${clock(raw)} raw → ${clock(plan.totalDuration)} cut (${Math.round((1 - plan.totalDuration / raw) * 100)}% removed)`,
    `- ${clips.length} clips, ${blacks.length} section gaps`,
    `- ${talk > 0 ? Math.round(spoken / (talk / 60)) : 0} words a minute`,
    "",
  );
  return out.join("\n");
}
