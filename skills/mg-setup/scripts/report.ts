import type { ChapterInfo, Gap, MediaInfo } from "./types.js";

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function chapterTable(chapters: ChapterInfo[]): string {
  const rows = chapters.map((c) => {
    const span = `${fmtTime(c.startSec)}–${fmtTime(c.endSec)}`;
    const dur = fmtTime(c.endSec - c.startSec);
    return `  ${c.id.padEnd(44)} ${span.padStart(17)}  ${dur.padStart(7)}  ${c.title}`;
  });
  return ["  id" + " ".repeat(42) + "span".padStart(17) + "  length".padStart(9) + "  script beat", ...rows].join("\n");
}

export function mediaWarnings(media: MediaInfo, chapters: ChapterInfo[]): string[] {
  const warnings: string[] = [];
  if (media.pixFmt.includes("10le") || media.pixFmt.includes("10be")) {
    warnings.push(
      `source is 10-bit (${media.videoCodec} ${media.pixFmt}) — Remotion's frame extractor crashes on it; the 8-bit mezzanine handles this (never point the comp at the original).`,
    );
  }
  const durations = chapters.map((c) => c.endSec - c.startSec).sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)] ?? 0;
  for (const c of chapters) {
    const d = c.endSec - c.startSec;
    if (median > 0 && d > median * 3) {
      warnings.push(`${c.id} runs ${fmtTime(d)} (median chapter is ${fmtTime(median)}) — long chapter; confirm no gap was lost in the edit.`);
    }
    if (d < 10) {
      warnings.push(`${c.id} is only ${fmtTime(d)} — unusually short; confirm the gap boundaries are real.`);
    }
  }
  return warnings;
}

export function mismatchTable(beatTitles: string[], gaps: Gap[], durationSec: number): string {
  const lines: string[] = [];
  lines.push(`  script beats (${beatTitles.length}):`);
  beatTitles.forEach((t, i) => lines.push(`    ${String(i + 1).padStart(2)}. ${t}`));
  lines.push(`  detected black gaps ≥ threshold (${gaps.length}) → ${gaps.length + 1} chapters:`);
  gaps.forEach((g, i) =>
    lines.push(`    gap ${String(i + 1).padStart(2)}: ${fmtTime(g.start)} → ${fmtTime(g.end)} (${(g.end - g.start).toFixed(1)}s)`),
  );
  lines.push(`  video duration: ${fmtTime(durationSec)}`);
  lines.push("");
  lines.push("  Fix one side: add/remove the gap in the edit, adjust --threshold if a real");
  lines.push("  gap fell just under it, or align script.md's beats — then re-run.");
  return lines.join("\n");
}
