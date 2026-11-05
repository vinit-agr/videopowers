import { describe, expect, it } from "vitest";
import { toFcpXml } from "../xml.js";
import { markerNote, renderReport } from "../report.js";
import type { EditFile } from "../edit.js";
import type { Prepared } from "../prepared.js";
import type { CutPlan } from "../types.js";

const info = { width: 1920, height: 1080, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration: 60 };
const words = "so those first three days are very critical okay".split(" ").map((text, i) => ({ i, text, start: i, end: i + 0.5 }));
const prep: Prepared = {
  project: "/p",
  parts: [{ part: 1, file: "part1.mp4", path: "/p/part1.mp4", info, words }],
  sections: [
    { number: 1, title: "Hook", point: "", cards: [{ id: "1a", title: "", bullets: [], locks: ["Not a week later. Just 3 days."] }] },
    { number: 2, title: "Step", point: "", cards: [] },
    { number: 3, title: "Who", point: "", cards: [] },
  ],
};
const plan: CutPlan = {
  parts: [{ index: 0, path: "/p/part1.mp4", info }],
  segments: [{ kind: "clip", part: 0, start: 0.9, end: 4.6, words: [], note: "those first three days", beatIndex: 0 }],
  fps: 30, width: 1920, height: 1080, totalDuration: 3.7,
};
const edit: EditFile = {
  version: 1,
  sections: [{ section: 1, spans: [{ part: 1, from: 1, to: 4, card: "1a" }] }],
  calls: [
    { id: 1, kind: "earlier-attempt", reason: "Last attempt said 'half'; the 🔒 says 'nearly half'.", kept: { part: 1, from: 1, to: 4 }, alternatives: [{ part: 1, from: 5, to: 7 }] },
    { id: 2, kind: "repeat", reason: "Unsure this repeats the line before.", kept: { part: 1, from: 1, to: 2 }, alternatives: [] },
  ],
  locks: [{ section: 1, card: "1a", line: "Not a week later. Just 3 days.", said: null, status: "missing" }],
  removed: [{ part: 1, from: 5, to: 7, why: "earlier attempt", keptInstead: { part: 1, from: 1, to: 4 } }],
  missing: [{ section: 1, card: "1a", what: "Not a week later. Just 3 days." }],
};

describe("markerNote", () => {
  it("names the call and points into the review file", () => {
    expect(markerNote(edit.calls[0]!, "new-rough-cut")).toBe(
      "Judgment call 1: Last attempt said 'half'; the 🔒 says 'nearly half'. Alternatives in new-rough-cut/rough-cut.review.mp4 (Call 1).",
    );
  });
});

describe("toFcpXml markers", () => {
  it("writes one sequence marker per call at its frame", () => {
    const xml = toFcpXml(plan, "seq", [
      { frame: 0, name: "Call 1", comment: markerNote(edit.calls[0]!, "new-rough-cut") },
      { frame: 45, name: "Call 2", comment: markerNote(edit.calls[1]!, "new-rough-cut") },
    ]);
    expect(xml.match(/<marker>/g)).toHaveLength(2);
    expect(xml).toContain("<name>Call 2</name>");
    expect(xml).toContain("<in>45</in>");
    expect(xml).toContain("rough-cut.review.mp4 (Call 2)");
  });
  it("writes no markers when none are given", () => {
    expect(toFcpXml(plan, "seq")).not.toContain("<marker>");
  });
});

describe("renderReport", () => {
  const md = renderReport(edit, prep, plan, new Map([[1, 0], [2, 45]]), "new-rough-cut");
  it("leads with what's missing and lists unrecorded sections on one line", () => {
    expect(md.indexOf("## Missing")).toBeLessThan(md.indexOf("## 🔒 check"));
    expect(md).toContain("Not a week later. Just 3 days.");
    expect(md).toMatch(/Not recorded: sections 2, 3/);
  });
  it("lists every judgment call with its time in the cut and points to the reel", () => {
    expect(md).toMatch(/Call 1.*0:00/);
    expect(md).toMatch(/Call 2.*0:01\.5/);
    expect(md).toContain("new-rough-cut/rough-cut.review.mp4");
  });
  it("shows removed attempts next to what was kept", () => {
    expect(md).toContain("are very critical");
    expect(md).toContain("those first three days");
  });
});
