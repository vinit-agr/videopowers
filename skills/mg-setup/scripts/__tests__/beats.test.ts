import { describe, expect, it } from "vitest";
import { ChapterMismatchError, makeChapters, slugify } from "../beats.js";
import type { Gap } from "../types.js";

const gaps: Gap[] = [
  { start: 47.166667, end: 49.166667 },
  { start: 117.866667, end: 119.866667 },
];
const titles = ["COLD OPEN", "BEAT 1 — The rough cut", "CLOSE"];

describe("slugify", () => {
  it("kebab-cases with punctuation and dashes collapsed", () => {
    expect(slugify("BEAT 5 — Three passes in Remotion")).toBe("beat-5-three-passes-in-remotion");
    expect(slugify("Vinit's CLOSE!")).toBe("vinits-close");
  });
  it("caps at 40 chars on a word boundary", () => {
    const s = slugify("a very long chapter title that keeps going and going and going");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("never returns empty", () => {
    expect(slugify("—–!")).toBe("chapter");
  });
});

describe("makeChapters", () => {
  it("zips beats with gaps into contiguous chapters", () => {
    const ch = makeChapters(titles, gaps, 180, 30);
    expect(ch).toHaveLength(3);
    expect(ch[0]).toMatchObject({ id: "ch01-cold-open", startSec: 0, startFrame: 0 });
    expect(ch[0]!.endSec).toBeCloseTo(47.166667);
    expect(ch[1]!.startSec).toBeCloseTo(49.166667);
    expect(ch[1]!.displayName).toBe("02 · BEAT 1 — The rough cut");
    expect(ch[2]!.endSec).toBe(180);
    expect(ch[2]!.gapAfterSec).toBe(0);
    expect(ch[1]!.gapAfterSec).toBeCloseTo(2.0);
  });

  it("frame math is consistent (no drift between sec and frames)", () => {
    const ch = makeChapters(titles, gaps, 180, 30);
    for (const c of ch) {
      expect(c.startFrame).toBe(Math.round(c.startSec * 30));
      expect(c.startFrame + c.durationInFrames).toBe(Math.round(c.endSec * 30));
    }
  });

  it("hard-fails when gaps + 1 != beats", () => {
    expect(() => makeChapters(titles, gaps.slice(0, 1), 180, 30)).toThrow(ChapterMismatchError);
    expect(() => makeChapters(titles.slice(0, 2), gaps, 180, 30)).toThrow(ChapterMismatchError);
  });
});
