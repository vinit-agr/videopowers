// reel.ts — rough-cut.review.mp4: every judgment call, kept version then alternatives.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Call, Span } from "./edit.js";
import type { Prepared } from "./prepared.js";
import { renderPlan, type RenderPlanOptions } from "./render.js";
import { clock } from "./report.js";
import type { CutPlan, PartSource, Segment } from "./types.js";

const PAD = 0.3;
const TITLE_SEC = 2.5;
const LABEL_SEC = 1.0;

export interface CardSpec {
  title: string;
  subtitle: string;
  body: string;
  duration: number;
}

/** Plan the reel. `makeCard` turns a card spec into an image path. */
export function reelSegments(
  calls: Call[],
  prep: Prepared,
  callFrames: Map<number, number>,
  fps: number,
  makeCard: (c: CardSpec) => string,
): Segment[] {
  const segs: Segment[] = [];
  const card = (c: CardSpec) => segs.push({ kind: "image", path: makeCard(c), duration: c.duration });
  const clip = (s: Span, label: string) => {
    const idx = prep.parts.findIndex((p) => p.part === s.part);
    const part = prep.parts[idx]!;
    const first = part.words[s.from]!;
    const last = part.words[s.to]!;
    segs.push({
      kind: "clip",
      part: idx,
      start: Math.max(0, first.start - PAD),
      end: Math.min(part.info.duration, last.end + PAD),
      words: [],
      note: label,
      beatIndex: -1,
    });
  };
  calls.forEach((c) => {
    const f = callFrames.get(c.id);
    card({
      title: `Call ${c.id} of ${calls.length}`,
      subtitle: `${f === undefined ? "not in the cut" : `${clock(f / fps)} in the cut`} · ${c.kind}`,
      body: c.reason,
      duration: TITLE_SEC,
    });
    card({ title: "Kept", subtitle: `Call ${c.id}`, body: "", duration: LABEL_SEC });
    clip(c.kept, `call ${c.id} kept`);
    c.alternatives.forEach((a, k) => {
      card({ title: `Alternative ${k + 1}`, subtitle: `Call ${c.id}${a.label ? ` · ${a.label}` : ""}`, body: "", duration: LABEL_SEC });
      clip(a, `call ${c.id} alternative ${k + 1}`);
    });
  });
  return segs;
}

/** The card font (Helvetica) has no emoji: name the lock, drop the rest. */
export function cardText(text: string): string {
  return text
    .replace(/🔒/gu, "locked")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CARD_PY = join(dirname(fileURLToPath(import.meta.url)), "card.py");

export async function buildReel(
  calls: Call[],
  prep: Prepared,
  parts: PartSource[],
  callFrames: Map<number, number>,
  outPath: string,
  opts: RenderPlanOptions,
): Promise<void> {
  const base = parts[0]!.info;
  const cardDir = join(opts.workDir, "..", ".reel-cards");
  mkdirSync(cardDir, { recursive: true });
  let n = 0;
  const segments = reelSegments(calls, prep, callFrames, base.fps, (c) => {
    const path = join(cardDir, `card_${String(n++).padStart(3, "0")}.png`);
    execFileSync("python3", [CARD_PY, path, String(base.width), String(base.height), cardText(c.title), cardText(c.subtitle), cardText(c.body)]);
    return path;
  });
  const fps = base.fps;
  const frames = segments.reduce((t, s) => {
    if (s.kind === "clip") return t + Math.max(1, Math.round(s.end * fps) - Math.round(s.start * fps));
    return t + Math.max(1, Math.round(s.duration * fps));
  }, 0);
  const plan: CutPlan = { parts, segments, fps, width: base.width, height: base.height, totalDuration: frames / fps };
  try {
    await renderPlan(plan, outPath, opts);
  } finally {
    rmSync(cardDir, { recursive: true, force: true });
  }
}
