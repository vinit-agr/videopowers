import { describe, expect, it } from "vitest";
import { buildCut, DEFAULT_BUDGETS } from "../cut.js";
import type { AlignedPhrase } from "../align.js";
import { parseScript } from "../script.js";
import type { MediaInfo, PartSource, Phrase, Word } from "../types.js";

const SCRIPT = parseScript(`## BEAT 1
**Say:**
Sentence one here. Sentence two here.

New concept sentence.

## BEAT 2
**Say:**
Second beat opens.
`);
// sentences: 0,1 (para A) · 2 (para B) · 3 (beat 2)

function info(duration = 100): MediaInfo {
  return { width: 1920, height: 1080, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration };
}

function mkPhrase(text: string, start: number, end: number): Phrase {
  const tokens = text.split(/\s+/).filter(Boolean);
  const dt = (end - start) / Math.max(1, tokens.length);
  const words: Word[] = tokens.map((t, i) => ({ text: t, start: start + i * dt, end: start + (i + 1) * dt, type: "word" as const }));
  return { words, start, end, text };
}

function kp(text: string, start: number, end: number, span: [number, number], part = 0, order = 0): AlignedPhrase {
  return {
    phrase: mkPhrase(text, start, end),
    part,
    order,
    span,
    similarity: 1,
    lowConfidence: false,
    dropped: false,
    dropReason: null,
    droppedBy: null,
  };
}

function wordsOf(kept: AlignedPhrase[], part: number): Word[] {
  return kept.filter((k) => k.part === part).flatMap((k) => k.phrase.words);
}

describe("buildCut", () => {
  it("merges a sentence join whose real gap is within budget (no cut)", () => {
    const kept = [
      kp("Sentence one here.", 1, 3, [0, 0]),
      kp("Sentence two here.", 3.3, 5.3, [1, 1]), // 0.3s gap ≤ 0.15 + slack
    ];
    const parts: PartSource[] = [{ index: 0, path: "/p/part1.mp4", info: info() }];
    const r = buildCut({ parts, kept, script: SCRIPT, partWords: [wordsOf(kept, 0)], droppedByPart: [[]], budgets: DEFAULT_BUDGETS });
    expect(r.plan.segments).toHaveLength(1);
    expect(r.boundaries[0]!.merged).toBe(true);
    expect(r.boundaries[0]!.type).toBe("sentence");
  });

  it("cuts a long reading pause down to the sentence budget", () => {
    const kept = [
      kp("Sentence one here.", 1, 3, [0, 0]),
      kp("Sentence two here.", 9, 11, [1, 1]), // 6s reading pause
    ];
    const parts: PartSource[] = [{ index: 0, path: "/p/part1.mp4", info: info() }];
    const r = buildCut({ parts, kept, script: SCRIPT, partWords: [wordsOf(kept, 0)], droppedByPart: [[]], budgets: DEFAULT_BUDGETS });
    expect(r.plan.segments).toHaveLength(2);
    const b = r.boundaries[0]!;
    expect(b.type).toBe("sentence");
    expect(b.merged).toBe(false);
    expect(b.keptAir).toBeCloseTo(0.15, 5);
  });

  it("gives a concept (paragraph) join the bigger budget", () => {
    const kept = [
      kp("Sentence two here.", 1, 3, [1, 1]),
      kp("New concept sentence.", 9, 11, [2, 2]),
    ];
    const parts: PartSource[] = [{ index: 0, path: "/p/part1.mp4", info: info() }];
    const r = buildCut({ parts, kept, script: SCRIPT, partWords: [wordsOf(kept, 0)], droppedByPart: [[]], budgets: DEFAULT_BUDGETS });
    expect(r.boundaries[0]!.type).toBe("concept");
    expect(r.boundaries[0]!.keptAir).toBeCloseTo(0.35, 5);
  });

  it("inserts a black gap at a beat boundary", () => {
    const kept = [
      kp("New concept sentence.", 1, 3, [2, 2], 0, 0),
      kp("Second beat opens.", 1, 3, [3, 3], 1, 1),
    ];
    const parts: PartSource[] = [
      { index: 0, path: "/p/part1.mp4", info: info() },
      { index: 1, path: "/p/part2.mp4", info: info() },
    ];
    const r = buildCut({
      parts, kept, script: SCRIPT,
      partWords: [wordsOf(kept, 0), wordsOf(kept, 1)],
      droppedByPart: [[], []],
      budgets: DEFAULT_BUDGETS,
    });
    expect(r.plan.segments.map((s) => s.kind)).toEqual(["clip", "black", "clip"]);
    const black = r.plan.segments[1]!;
    expect(black.kind === "black" && black.duration).toBe(2.0);
  });

  it("escalates a mid-paragraph part change (crash split) to concept air", () => {
    const kept = [
      kp("Sentence one here.", 1, 3, [0, 0], 0, 0),
      kp("Sentence two here.", 1, 3, [1, 1], 1, 1), // same paragraph, new part
    ];
    const parts: PartSource[] = [
      { index: 0, path: "/p/part1.mp4", info: info() },
      { index: 1, path: "/p/part2.mp4", info: info() },
    ];
    const r = buildCut({
      parts, kept, script: SCRIPT,
      partWords: [wordsOf(kept, 0), wordsOf(kept, 1)],
      droppedByPart: [[], []],
      budgets: DEFAULT_BUDGETS,
    });
    expect(r.boundaries[0]!.type).toBe("concept");
  });

  it("never merges across dropped material (a cut retake between two keeps)", () => {
    const kept = [
      kp("Sentence one here.", 1, 3, [0, 0]),
      kp("Sentence two here.", 3.4, 5.4, [1, 1]),
    ];
    const parts: PartSource[] = [{ index: 0, path: "/p/part1.mp4", info: info() }];
    const r = buildCut({
      parts, kept, script: SCRIPT,
      partWords: [wordsOf(kept, 0)],
      droppedByPart: [[{ start: 3.05, end: 3.35 }]], // filler cut inside the gap
      budgets: DEFAULT_BUDGETS,
    });
    expect(r.plan.segments).toHaveLength(2);
    expect(r.boundaries[0]!.merged).toBe(false);
  });

  it("keeps real-footage air only as far as real silence allows", () => {
    // Next word starts 0.2s after phrase A ends → trail can't exceed 0.2s.
    const a = kp("Sentence one here.", 1, 3, [0, 0]);
    const b = kp("Sentence two here.", 3.2, 5.2, [1, 1]);
    // Force a cut by planting dropped material in the tiny gap.
    const parts: PartSource[] = [{ index: 0, path: "/p/part1.mp4", info: info() }];
    const r = buildCut({
      parts, kept: [a, b], script: SCRIPT,
      partWords: [[...a.phrase.words, ...b.phrase.words]],
      droppedByPart: [[{ start: 3.05, end: 3.15 }]],
      budgets: DEFAULT_BUDGETS,
    });
    const bo = r.boundaries[0]!;
    expect(bo.merged).toBe(false);
    expect(bo.keptAir).toBeLessThanOrEqual(0.2 + 1e-6);
  });

  it("picks the majority resolution for the plan", () => {
    const kept = [
      kp("Sentence one here.", 1, 3, [0, 0], 0, 0),
      kp("Sentence two here.", 1, 3, [1, 1], 1, 1),
      kp("New concept sentence.", 1, 3, [2, 2], 2, 2),
    ];
    const parts: PartSource[] = [
      { index: 0, path: "/p/part1.mp4", info: { ...info(), width: 3840, height: 2160 } },
      { index: 1, path: "/p/part2.mp4", info: info() },
      { index: 2, path: "/p/part3.mp4", info: info() },
    ];
    const r = buildCut({
      parts, kept, script: SCRIPT,
      partWords: [wordsOf(kept, 0), wordsOf(kept, 1), wordsOf(kept, 2)],
      droppedByPart: [[], [], []],
      budgets: DEFAULT_BUDGETS,
    });
    expect(r.plan.width).toBe(1920);
    expect(r.plan.height).toBe(1080);
  });
});
