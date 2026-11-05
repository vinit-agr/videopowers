import { describe, expect, it } from "vitest";
import { spanText, validateEdit, type EditFile } from "../edit.js";
import type { Prepared } from "../prepared.js";

const info = { width: 1920, height: 1080, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration: 60 };
const words = "so those first three days are very critical okay".split(" ").map((text, i) => ({ i, text, start: i, end: i + 0.5 }));
const prep: Prepared = {
  project: "/p",
  parts: [{ part: 1, file: "part1.mp4", path: "/p/part1.mp4", info, words }],
  sections: [
    { number: 1, title: "Hook", point: "", cards: [{ id: "1a", title: "", bullets: [], locks: ["those first 3 days"] }] },
    { number: 2, title: "Next", point: "", cards: [{ id: "2a", title: "", bullets: [], locks: ["unrecorded line"] }] },
  ],
};

function edit(over: Partial<EditFile> = {}): EditFile {
  return {
    version: 1,
    sections: [{ section: 1, spans: [{ part: 1, from: 0, to: 7, card: "1a" }] }],
    calls: [],
    locks: [{ section: 1, card: "1a", line: "those first 3 days", said: "those first three days", status: "exact" }],
    removed: [],
    missing: [],
    ...over,
  };
}

describe("validateEdit", () => {
  it("accepts a clean edit", () => {
    expect(validateEdit(edit(), prep)).toEqual({ errors: [], warnings: [] });
  });

  it("rejects kept spans that overlap in the same part, quoting both", () => {
    const e = edit({ sections: [{ section: 1, spans: [{ part: 1, from: 0, to: 4, card: "1a" }, { part: 1, from: 3, to: 7, card: "1a" }] }] });
    const { errors } = validateEdit(e, prep);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/overlap/);
    expect(errors[0]).toContain("three days");
  });

  it("rejects an unknown part, an out-of-range index and a reversed span", () => {
    const e = edit({
      sections: [{ section: 1, spans: [{ part: 9, from: 0, to: 1, card: "1a" }, { part: 1, from: 5, to: 99, card: "1a" }, { part: 1, from: 4, to: 2, card: "1a" }] }],
    });
    const { errors } = validateEdit(e, prep);
    expect(errors.some((x) => /part 9/.test(x))).toBe(true);
    expect(errors.some((x) => /out of range/.test(x))).toBe(true);
    expect(errors.some((x) => /reversed/.test(x))).toBe(true);
  });

  it("warns when a judgment call's kept span is not in the cut", () => {
    const e = edit({ calls: [{ id: 1, kind: "repeat", reason: "r", kept: { part: 1, from: 8, to: 8 }, alternatives: [] }] });
    const { errors, warnings } = validateEdit(e, prep);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => /call 1/.test(w))).toBe(true);
  });

  it("warns about an unchecked fixed line only in recorded sections", () => {
    const { warnings } = validateEdit(edit({ locks: [] }), prep);
    expect(warnings.some((w) => /those first 3 days/.test(w))).toBe(true);
    expect(warnings.some((w) => /unrecorded line/.test(w))).toBe(false);
  });
});

describe("spanText", () => {
  it("returns the words of a span", () => {
    expect(spanText({ part: 1, from: 1, to: 4 }, prep)).toBe("those first three days");
  });
});

describe("validateEdit: malformed spans (review I1/I2)", () => {
  it("rejects a span with a missing or non-integer index", () => {
    const bad = edit({ sections: [{ section: 1, spans: [{ part: 1, from: 0, card: "1a" } as never, { part: 1, from: 1.5, to: 3, card: "1a" }] }] });
    const { errors } = validateEdit(bad, prep);
    expect(errors.filter((e) => /whole numbers/.test(e))).toHaveLength(2);
  });
  it("rejects judgment-call and removed spans that point outside the footage", () => {
    const bad = edit({
      calls: [{ id: 1, kind: "repeat", reason: "r", kept: { part: 1, from: 0, to: 7 }, alternatives: [{ part: 5, from: 0, to: 1 }] }],
      removed: [{ part: 1, from: 0, to: 2, why: "w", keptInstead: { part: 1, from: 3, to: 9999 } }],
    });
    const { errors } = validateEdit(bad, prep);
    expect(errors.some((e) => /call 1 alternative 1/.test(e) && /part 5/.test(e))).toBe(true);
    expect(errors.some((e) => /removed 1 keptInstead/.test(e) && /out of range/.test(e))).toBe(true);
  });
});
