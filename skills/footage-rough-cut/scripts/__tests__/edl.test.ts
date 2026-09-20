import { describe, expect, it } from "vitest";
import { buildEdl } from "../edl.js";
import { pacingPreset } from "../pacing.js";
import { phrase, w } from "./helpers.js";

const TIGHT = pacingPreset("tight");

describe("buildEdl — removeSilences", () => {
  const p1 = phrase([w("hello", 1, 1.5), w("there", 1.6, 2.0)]);
  const p2 = phrase([w("again", 10, 10.5), w("friend", 10.6, 11.0)]);

  it("emits one padded range per kept phrase", () => {
    const edl = buildEdl({ source: "x.mp4", keptPhrases: [p1, p2], dropSpans: [], removeSilences: true, pacing: TIGHT, duration: 20 });
    expect(edl.ranges).toHaveLength(2);
    expect(edl.ranges[0]!.start).toBeCloseTo(1 - TIGHT.padLead * 2, 5); // doubled lead on first
    expect(edl.ranges[0]!.end).toBeCloseTo(2 + TIGHT.padTrail, 5);
  });

  it("produces non-overlapping ranges and a positive total", () => {
    const edl = buildEdl({ source: "x.mp4", keptPhrases: [p1, p2], dropSpans: [], removeSilences: true, pacing: TIGHT, duration: 20 });
    for (let i = 0; i < edl.ranges.length - 1; i++) {
      expect(edl.ranges[i]!.end).toBeLessThanOrEqual(edl.ranges[i + 1]!.start + 1e-9);
    }
    expect(edl.totalDuration).toBeGreaterThan(0);
  });

  it("clamps the first range to 0", () => {
    const early = phrase([w("hi", 0.02, 0.2)]);
    const edl = buildEdl({ source: "x.mp4", keptPhrases: [early], dropSpans: [], removeSilences: true, pacing: TIGHT, duration: 5 });
    expect(edl.ranges[0]!.start).toBe(0);
  });
});

describe("buildEdl — keepSilences", () => {
  it("keeps original timing minus dropped spans", () => {
    const kept = [phrase([w("a", 1, 2), w("b", 8, 9)])];
    const edl = buildEdl({ source: "x.mp4", keptPhrases: kept, dropSpans: [{ start: 4, end: 6 }], removeSilences: false, pacing: TIGHT, duration: 12 });
    // content window [~0.92, 9.06] minus [4,6] → two ranges
    expect(edl.ranges).toHaveLength(2);
    expect(edl.ranges[0]!.end).toBeCloseTo(4, 5);
    expect(edl.ranges[1]!.start).toBeCloseTo(6, 5);
  });
});
