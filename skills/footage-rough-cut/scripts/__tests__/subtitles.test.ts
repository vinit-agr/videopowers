import { describe, expect, it } from "vitest";
import { outputWords, toSrt, toVtt } from "../subtitles.js";
import type { Edl } from "../types.js";
import { w } from "./helpers.js";

const edl: Edl = {
  source: "x.mp4",
  ranges: [
    { start: 0.9, end: 2.1, words: [w("Hello", 1.0, 1.4), w("world", 1.5, 2.0)], note: "" },
    { start: 9.96, end: 11.06, words: [w("again", 10.0, 10.5)], note: "" },
  ],
  totalDuration: 2.3,
};

describe("outputWords", () => {
  it("remaps words onto the concatenated output timeline", () => {
    const out = outputWords(edl);
    // first range offset 0: Hello at 1.0-0.9=0.1
    expect(out[0]).toMatchObject({ text: "Hello" });
    expect(out[0]!.start).toBeCloseTo(0.1, 5);
    // second range offset = range0 duration (1.2): again at 1.2 + (10.0-9.96)=1.24
    expect(out[2]!.start).toBeCloseTo(1.2 + 0.04, 5);
  });
});

describe("toSrt / toVtt", () => {
  it("emits numbered SRT cues with comma millis", () => {
    const srt = toSrt(edl);
    expect(srt).toMatch(/^1\n00:00:00,100 --> /);
  });
  it("emits a WEBVTT header with dot millis", () => {
    expect(toVtt(edl).startsWith("WEBVTT")).toBe(true);
    expect(toVtt(edl)).toMatch(/00:00:00\.100 --> /);
  });
});
