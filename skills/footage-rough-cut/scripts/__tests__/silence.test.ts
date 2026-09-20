import { describe, expect, it } from "vitest";
import { clampWordEnds, parseSilences } from "../silence.js";
import { w } from "./helpers.js";

describe("parseSilences", () => {
  it("pairs silence_start with the following silence_end", () => {
    const stderr = [
      "[silencedetect @ 0x1] silence_start: 1.5",
      "[silencedetect @ 0x1] silence_end: 3.25 | silence_duration: 1.75",
      "[silencedetect @ 0x1] silence_start: 10.0",
      "[silencedetect @ 0x1] silence_end: 12.5 | silence_duration: 2.5",
    ].join("\n");
    expect(parseSilences(stderr)).toEqual([
      { start: 1.5, end: 3.25 },
      { start: 10.0, end: 12.5 },
    ]);
  });

  it("ignores a dangling silence_start with no end", () => {
    expect(parseSilences("silence_start: 5.0")).toEqual([]);
  });
});

describe("clampWordEnds", () => {
  it("clamps an inflated word end to the start of an interior silence", () => {
    const words = [w("right", 78.2, 82.4)];
    const out = clampWordEnds(words, [{ start: 78.8, end: 82.4 }]);
    expect(out[0]!.end).toBeCloseTo(78.8, 5);
  });

  it("leaves words without an interior silence untouched", () => {
    const words = [w("worked", 5.4, 5.8)];
    const out = clampWordEnds(words, [{ start: 6.0, end: 9.0 }]);
    expect(out[0]!.end).toBe(5.8);
  });
});
