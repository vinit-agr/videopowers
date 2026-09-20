import { describe, expect, it } from "vitest";
import { parseTag } from "../tags.js";

describe("parseTag", () => {
  it("parses the five layouts with defaults", () => {
    expect(parseTag("[FULLFACE]")).toMatchObject({ kind: "FULLFACE", content: "none" });
    expect(parseTag("[OVERLAY]")).toMatchObject({ kind: "OVERLAY", content: "graphics", cells: [4, 6] });
    expect(parseTag("[SPLIT graphics]")).toMatchObject({ kind: "SPLIT", side: "left", facePct: 35 });
    expect(parseTag("[BUBBLE]")).toMatchObject({ kind: "BUBBLE", cells: [9], shape: "circle" });
    expect(parseTag("[FULLGRAPHICS]")).toMatchObject({ kind: "FULLGRAPHICS", content: "graphics" });
  });

  it("media split defaults to right/18% (media legibility rule)", () => {
    expect(parseTag("[SPLIT media]")).toMatchObject({ side: "right", facePct: 18, content: "media" });
  });

  it("honors overrides", () => {
    expect(parseTag("[OVERLAY 6]")).toMatchObject({ cells: [6] });
    expect(parseTag("[OVERLAY 1,3]")).toMatchObject({ cells: [1, 3] });
    expect(parseTag("[SPLIT graphics right 30%]")).toMatchObject({ side: "right", facePct: 30 });
    expect(parseTag("[BUBBLE 7 rect]")).toMatchObject({ cells: [7], shape: "rect" });
    expect(parseTag("[FULLGRAPHICS media]")).toMatchObject({ content: "media" });
  });

  it("rejects junk", () => {
    expect(() => parseTag("[SIDEBAR]")).toThrow(/unknown layout/);
    expect(() => parseTag("[FULLFACE 6]")).toThrow(/unrecognized/);
    expect(() => parseTag("[OVERLAY 12]")).toThrow();
  });
});
