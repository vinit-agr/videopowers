import { describe, expect, it } from "vitest";
import { formatTranscript, splitPhrases } from "../transcript.js";
import type { Prepared, PreparedWord } from "../prepared.js";

function seq(spec: Array<[string, number]>): PreparedWord[] {
  // [text, start]; each word lasts 0.3 s
  return spec.map(([text, start], i) => ({ i, text, start, end: start + 0.3 }));
}

const words = seq([
  ["And", 0], ["if", 0.4], ["you're", 0.8], ["thinking...", 1.2],
  ["And", 4.0], ["if", 4.4], ["you're", 4.8], ["thinking", 5.2], ["that", 5.6], ["helps.", 6.0],
]);

const prep: Prepared = {
  project: "/p",
  parts: [{ part: 1, file: "part1.mp4", path: "/p/part1.mp4", info: { width: 1, height: 1, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration: 10 }, words }],
  sections: [{ number: 1, title: "Hook", point: "p", cards: [{ id: "1a", title: "t", bullets: [], locks: ["if you're thinking that helps"] }] }],
};

describe("splitPhrases", () => {
  it("splits at pauses of 0.5 s or more", () => {
    expect(splitPhrases(words).map((p) => [p[0]!.i, p[p.length - 1]!.i])).toEqual([[0, 3], [4, 9]]);
  });
});

describe("formatTranscript", () => {
  const md = formatTranscript(prep);
  it("labels each phrase with its part and word range", () => {
    expect(md).toContain("`p1 #0–#3`");
    expect(md).toContain("`p1 #4–#9`");
  });
  it("marks a cut-off phrase and a restart of it", () => {
    expect(md).toMatch(/`p1 #0–#3`.*CUT-OFF/);
    expect(md).toMatch(/`p1 #4–#9`.*RESTART of #0/);
  });
  it("shows the pause before a phrase", () => {
    expect(md).toMatch(/`p1 #4–#9`.*pause 2\.5s/);
  });
  it("lists fixed-line candidates under the card", () => {
    expect(md).toMatch(/1a.*if you're thinking that helps[\s\S]*p1 #5–#9 sim 1/);
  });
});
