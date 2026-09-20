import { describe, expect, it } from "vitest";
import { lintShots } from "../lint.js";
import { resolveShots } from "../resolve.js";
import type { BeatSheet, Word, YamlShot } from "../types.js";

const sheet: BeatSheet = {
  slug: "test", title: "Test", fps: 30, width: 1920, height: 1080,
  durationSec: 100, durationInFrames: 3000,
  chapters: [
    { id: "ch01-open", number: 1, title: "OPEN", displayName: "01 · OPEN", startSec: 0, endSec: 40, startFrame: 0, durationInFrames: 1200, gapAfterSec: 2 },
    { id: "ch02-close", number: 2, title: "CLOSE", displayName: "02 · CLOSE", startSec: 42, endSec: 100, startFrame: 1260, durationInFrames: 1740, gapAfterSec: 0 },
  ],
};

const words: Word[] = [];
let t = 0.5;
for (const w of "hello there this is the open now the mechanism appears and we keep talking for a while".split(" ")) {
  words.push({ text: w, start: t, end: t + 0.3 });
  t += 0.4;
}
// ch02 words
t = 42.5;
for (const w of "and now we close the video thanks for watching".split(" ")) {
  words.push({ text: w, start: t, end: t + 0.3 });
  t += 0.4;
}

const yaml: Record<string, YamlShot[]> = {
  "ch01-open": [
    { shot: "s01", layout: "[FULLFACE]", anchor: "start" },
    { shot: "s02", layout: "[FULLGRAPHICS]", anchor: "the mechanism appears", purpose: "viewer sees the mechanism" },
  ],
  "ch02-close": [
    { shot: "s01", layout: "[OVERLAY 6]", anchor: "thanks for watching", purpose: "subscribe card" },
  ],
};

describe("resolveShots", () => {
  const { shots, problems } = resolveShots(yaml, sheet, words);

  it("resolves anchors to word starts and chains boundaries", () => {
    expect(problems.filter((p) => p.level === "error")).toHaveLength(0);
    const s02 = shots.find((s) => s.id === "ch01-s02")!;
    expect(s02.startSec).toBeCloseTo(0.5 + 7 * 0.4); // "the" of "the mechanism"
    expect(s02.endSec).toBe(40);
    const s01 = shots.find((s) => s.id === "ch01-s01")!;
    expect(s01.startSec).toBe(0);
    expect(s01.endSec).toBe(s02.startSec);
  });

  it("generates a chapter card in the gap introducing the next chapter", () => {
    const card = shots.find((s) => s.origin === "chapter-card")!;
    expect(card.startSec).toBe(40);
    expect(card.endSec).toBe(42);
    expect(card.cardTitle).toBe("02 · CLOSE");
  });

  it("adds an implicit FULLFACE lead when a chapter starts before its first anchor", () => {
    const lead = shots.find((s) => s.id === "ch02-s00-lead")!;
    expect(lead.startSec).toBe(42);
    const s01 = shots.find((s) => s.id === "ch02-s01")!;
    expect(lead.endSec).toBe(s01.startSec);
  });

  it("errors on unknown chapters, dup ids, bad anchors, bad tags", () => {
    const bad: Record<string, YamlShot[]> = {
      "ch09-nope": [{ shot: "s01", layout: "[FULLFACE]", anchor: "start" }],
      "ch01-open": [
        { shot: "s01", layout: "[SIDEBAR]", anchor: "start" },
        { shot: "s01", layout: "[FULLFACE]", anchor: "not in transcript" },
      ],
    };
    const { problems: probs } = resolveShots(bad, sheet, words);
    const msgs = probs.filter((p) => p.level === "error").map((p) => p.message).join("\n");
    expect(msgs).toMatch(/unknown chapter/);
    expect(msgs).toMatch(/duplicate shot id/);
    expect(msgs).toMatch(/unknown layout/);
    expect(msgs).toMatch(/anchor not found/);
  });
});

describe("lintShots", () => {
  it("requires purpose on non-FULLFACE shots", () => {
    const y: Record<string, YamlShot[]> = {
      "ch01-open": [{ shot: "s01", layout: "[FULLGRAPHICS]", anchor: "start" }],
    };
    const { shots } = resolveShots(y, sheet, words);
    const msgs = lintShots(shots).filter((p) => p.level === "error").map((p) => p.message).join("\n");
    expect(msgs).toMatch(/purpose is required/);
  });

  it("errors on media splits wider than 20%", () => {
    const y: Record<string, YamlShot[]> = {
      "ch01-open": [{ shot: "s01", layout: "[SPLIT media 30%]", anchor: "start", purpose: "x" }],
    };
    const { shots } = resolveShots(y, sheet, words);
    const msgs = lintShots(shots).filter((p) => p.level === "error").map((p) => p.message).join("\n");
    expect(msgs).toMatch(/must be ≤20%/);
  });

  it("warns on long dwells and cadence gaps", () => {
    const y: Record<string, YamlShot[]> = {
      "ch01-open": [{ shot: "s01", layout: "[FULLFACE]", anchor: "start" }],
      "ch02-close": [{ shot: "s01", layout: "[FULLFACE]", anchor: "start" }],
    };
    const { shots } = resolveShots(y, sheet, words);
    const warns = lintShots(shots).filter((p) => p.level === "warning").map((p) => p.message).join("\n");
    expect(warns).toMatch(/FULLFACE runs/);
    expect(warns).toMatch(/no visual change/);
  });

  it("warns on adjacent identical geometry", () => {
    const y: Record<string, YamlShot[]> = {
      "ch01-open": [
        { shot: "s01", layout: "[SPLIT graphics]", anchor: "start", purpose: "a" },
        { shot: "s02", layout: "[SPLIT graphics]", anchor: "the mechanism appears", purpose: "b" },
      ],
    };
    const { shots } = resolveShots(y, sheet, words);
    const warns = lintShots(shots).filter((p) => p.level === "warning").map((p) => p.message).join("\n");
    expect(warns).toMatch(/same layout \+ geometry/);
  });
});
