import { describe, expect, it } from "vitest";
import { assemble, DEFAULT_PAUSES, trimFillers } from "../assemble.js";
import type { EditFile, KeptSpan } from "../edit.js";
import type { Prepared, PreparedWord } from "../prepared.js";
import type { ClipSegment, PartSource } from "../types.js";

const info = { width: 1920, height: 1080, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration: 100 };

/** [text, start]; each word lasts 0.3 s. */
function W(spec: Array<[string, number]>): PreparedWord[] {
  return spec.map(([text, start], i) => ({ i, text, start, end: start + 0.3 }));
}

function setup(words: PreparedWord[], sections: Array<{ section: number; spans: KeptSpan[] }>, calls: EditFile["calls"] = []) {
  const prep: Prepared = {
    project: "/p",
    parts: [{ part: 1, file: "part1.mp4", path: "/p/part1.mp4", info, words }],
    sections: [1, 2, 3].map((n) => ({ number: n, title: `S${n}`, point: "", cards: [] })),
  };
  const parts: PartSource[] = [{ index: 0, path: "/p/part1.mp4", info }];
  const edit: EditFile = { version: 1, sections, calls, locks: [], removed: [], missing: [] };
  return assemble(edit, prep, parts);
}

const clips = (segs: ReturnType<typeof setup>["plan"]["segments"]) => segs.filter((s): s is ClipSegment => s.kind === "clip");

describe("assemble: pauses", () => {
  it("keeps a sentence pause of 0.8 s as recorded (one clip)", () => {
    const { plan } = setup(W([["Hello", 10], ["there.", 10.4], ["Next", 11.5], ["one.", 11.9]]), [
      { section: 1, spans: [{ part: 1, from: 0, to: 3, card: "1" }] },
    ]);
    expect(clips(plan.segments)).toHaveLength(1);
  });

  it("shortens a 2.5 s sentence pause to about 0.7 s", () => {
    const { plan } = setup(W([["Hello", 10], ["there.", 10.4], ["Next", 13.2], ["one.", 13.6]]), [
      { section: 1, spans: [{ part: 1, from: 0, to: 3, card: "1" }] },
    ]);
    const [a, b] = clips(plan.segments);
    expect(b).toBeDefined();
    const air = (a!.end - 10.7) + (13.2 - b!.start);
    expect(air).toBeCloseTo(DEFAULT_PAUSES.longTo, 2);
  });

  it("shortens a 1.2 s mid-sentence pause to about 0.3 s", () => {
    const { plan } = setup(W([["I", 10], ["think", 10.4], ["this", 11.9], ["works.", 12.3]]), [
      { section: 1, spans: [{ part: 1, from: 0, to: 3, card: "1" }] },
    ]);
    const [a, b] = clips(plan.segments);
    const air = (a!.end - 10.7) + (11.9 - b!.start);
    expect(air).toBeCloseTo(DEFAULT_PAUSES.midTo, 2);
  });

  it("never pulls a neighbouring word into a join that wants more air than exists", () => {
    // kept: "Hello there." (0–1) then "Kept again." (4–5); dropped words sit 0.1 s either side.
    const words = W([["Hello", 10], ["there.", 10.4], ["dropped", 10.8], ["x", 20], ["junk", 30.2], ["Kept", 30.6], ["again.", 31.0]]);
    const { plan } = setup(words, [{ section: 1, spans: [{ part: 1, from: 0, to: 1, card: "1" }, { part: 1, from: 5, to: 6, card: "1" }] }]);
    const [a, b] = clips(plan.segments);
    expect(a!.end).toBeLessThan(10.8);
    expect(b!.start).toBeGreaterThan(30.5);
  });
});

describe("assemble: sections", () => {
  it("puts one black gap between recorded sections and none for an unrecorded one", () => {
    const { plan } = setup(W([["One.", 10], ["Two.", 20]]), [
      { section: 1, spans: [{ part: 1, from: 0, to: 0, card: "1" }] },
      { section: 2, spans: [] },
      { section: 3, spans: [{ part: 1, from: 1, to: 1, card: "3" }] },
    ]);
    const blacks = plan.segments.filter((s) => s.kind === "black");
    expect(blacks).toHaveLength(1);
    expect(blacks[0]!.kind === "black" && blacks[0]!.duration).toBe(DEFAULT_PAUSES.sectionGap);
    expect(plan.segments[0]!.kind).toBe("clip");
    expect(plan.segments[plan.segments.length - 1]!.kind).toBe("clip");
  });

  it("reports the timeline frame where each judgment call's kept span starts", () => {
    const { plan, callFrames } = setup(W([["One.", 10], ["Two.", 20]]), [
      { section: 1, spans: [{ part: 1, from: 0, to: 0, card: "1" }] },
      { section: 3, spans: [{ part: 1, from: 1, to: 1, card: "3" }] },
    ], [{ id: 1, kind: "repeat", reason: "r", kept: { part: 1, from: 1, to: 1 }, alternatives: [] }]);
    const first = clips(plan.segments)[0]!;
    const firstFrames = Math.round(first.end * 30) - Math.round(first.start * 30);
    const second = clips(plan.segments)[1]!;
    const leadFrames = Math.round((20 - second.start) * 30);
    expect(callFrames.get(1)).toBe(firstFrames + Math.round(DEFAULT_PAUSES.sectionGap * 30) + leadFrames);
  });
});

describe("trimFillers", () => {
  const all = W([["um", 10], ["so", 10.4], ["um", 10.75], ["this", 11.1], ["uh,", 11.9], ["works.", 12.25]]);
  it("drops a filler at the span edge, keeps one tight inside a sentence, drops one beside a pause", () => {
    const runs = trimFillers(all, all);
    expect(runs.map((r) => r.map((w) => w.text))).toEqual([["so", "um", "this"], ["works."]]);
  });
});

describe("assemble: marker position (review I4)", () => {
  it("puts a call's marker on its first kept word, even mid-clip, and never two on one frame", () => {
    // one contiguous run → one clip; call 1 starts at word 2, call 2 at word 2 as well
    const words = W([["Hello", 10], ["there", 10.4], ["my", 10.8], ["friend.", 11.2]]);
    const { plan, callFrames } = setup(words, [
      { section: 1, spans: [{ part: 1, from: 0, to: 1, card: "1" }, { part: 1, from: 2, to: 3, card: "1" }] },
    ], [
      { id: 1, kind: "repeat", reason: "r", kept: { part: 1, from: 2, to: 3 }, alternatives: [] },
      { id: 2, kind: "repeat", reason: "r", kept: { part: 1, from: 2, to: 2 }, alternatives: [] },
    ]);
    const clip = clips(plan.segments)[0]!;
    expect(clips(plan.segments)).toHaveLength(1);
    const expected = Math.round((10.8 - clip.start) * 30);
    expect(callFrames.get(1)).toBe(expected);
    expect(callFrames.get(2)).toBe(expected + 1);
  });
});
