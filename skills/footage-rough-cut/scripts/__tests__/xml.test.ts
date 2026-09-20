import { describe, expect, it } from "vitest";
import { placeSegments, toFcpXml } from "../xml.js";
import type { CutPlan, MediaInfo } from "../types.js";

function info(duration = 100): MediaInfo {
  return { width: 1920, height: 1080, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration };
}

const PLAN: CutPlan = {
  parts: [
    { index: 0, path: "/media/part1.mp4", info: info() },
    { index: 1, path: "/media/part2.mp4", info: info() },
  ],
  segments: [
    { kind: "clip", part: 0, start: 1.0, end: 3.0, words: [], note: "hello there", beatIndex: 0 },
    { kind: "black", duration: 2.0, beatIndex: 1 },
    { kind: "clip", part: 1, start: 0.5, end: 2.5, words: [], note: "second beat", beatIndex: 1 },
  ],
  fps: 30,
  width: 1920,
  height: 1080,
  totalDuration: 6.0,
};

describe("placeSegments", () => {
  it("lays clips on the frame grid with black gaps as empty space", () => {
    const { clips, totalFrames } = placeSegments(PLAN);
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ recStart: 0, recEnd: 60, srcIn: 30, srcOut: 90 });
    // 60 frames of clip + 60 frames of black gap → second clip at 120.
    expect(clips[1]).toMatchObject({ recStart: 120, recEnd: 180, srcIn: 15, srcOut: 75 });
    expect(totalFrames).toBe(180);
  });
});

describe("toFcpXml", () => {
  const xml = toFcpXml(PLAN, "demo rough cut");

  it("emits a well-formed xmeml skeleton", () => {
    expect(xml).toContain("<!DOCTYPE xmeml>");
    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain("<name>demo rough cut</name>");
    expect(xml).toContain("<duration>180</duration>");
  });

  it("defines each source file once and references it afterwards", () => {
    expect(xml.match(/<pathurl>file:\/\/\/media\/part1\.mp4<\/pathurl>/g)).toHaveLength(1);
    expect(xml.match(/<file id="file-1"\/>/g)).toHaveLength(1); // audio item reference
  });

  it("writes source in/out and timeline start/end in frames", () => {
    expect(xml).toContain("<in>30</in><out>90</out>");
    expect(xml).toContain("<start>0</start><end>60</end>");
    expect(xml).toContain("<start>120</start><end>180</end>");
  });

  it("links video and audio clip items", () => {
    expect(xml).toContain("<linkclipref>clipitem-v0</linkclipref>");
    expect(xml).toContain("<linkclipref>clipitem-a0</linkclipref>");
  });

  it("balances every opened tag (cheap well-formedness proxy)", () => {
    for (const tag of ["sequence", "media", "video", "audio", "track", "clipitem", "file"]) {
      const open = (xml.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
      const close = (xml.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      const selfClosed = (xml.match(new RegExp(`<${tag}[^>]*/>`, "g")) ?? []).length;
      expect(open, tag).toBe(close + selfClosed);
    }
  });
});
