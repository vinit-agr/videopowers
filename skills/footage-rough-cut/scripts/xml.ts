// xml.ts — write the cut plan as an FCP7 XML (xmeml v4) timeline file.
//
// This is the offline Resolve path: DaVinci Resolve opens it via
// File → Import Timeline → "rough-cut.xml", producing a new timeline where
// every kept segment is an individual clip with full trim handles into the
// original part files. No scripting bridge, no running Resolve needed.
// Black beat gaps become empty track space (which renders black).

import { writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ClipSegment, CutPlan } from "./types.js";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rate(fps: number): string {
  return `<rate><timebase>${Math.round(fps)}</timebase><ntsc>FALSE</ntsc></rate>`;
}

interface PlacedClip {
  seg: ClipSegment;
  /** Timeline frames. */
  recStart: number;
  recEnd: number;
  /** Source frames (endFrame exclusive). */
  srcIn: number;
  srcOut: number;
  id: number;
}

/** Lay segments onto the timeline frame grid; black segments become gaps. */
export function placeSegments(plan: CutPlan): { clips: PlacedClip[]; totalFrames: number } {
  const fps = plan.fps;
  const clips: PlacedClip[] = [];
  let cursor = 0;
  let id = 0;
  for (const seg of plan.segments) {
    if (seg.kind === "black") {
      cursor += Math.round(seg.duration * fps);
      continue;
    }
    const srcIn = Math.round(seg.start * fps);
    let srcOut = Math.round(seg.end * fps);
    if (srcOut <= srcIn) srcOut = srcIn + 1;
    const len = srcOut - srcIn;
    clips.push({ seg, recStart: cursor, recEnd: cursor + len, srcIn, srcOut, id: id++ });
    cursor += len;
  }
  return { clips, totalFrames: cursor };
}

/** Build the xmeml document text. */
export function toFcpXml(plan: CutPlan, sequenceName: string): string {
  const fps = Math.round(plan.fps);
  const { clips, totalFrames } = placeSegments(plan);
  const fileDefined = new Set<number>();

  const fileTag = (part: number): string => {
    const p = plan.parts[part]!;
    const fid = `file-${part + 1}`;
    if (fileDefined.has(part)) return `<file id="${fid}"/>`;
    fileDefined.add(part);
    const frames = Math.round(p.info.duration * fps);
    return (
      `<file id="${fid}"><name>${esc(basename(p.path))}</name>` +
      `<pathurl>${esc(pathToFileURL(resolve(p.path)).href)}</pathurl>` +
      rate(fps) +
      `<duration>${frames}</duration>` +
      `<media><video><samplecharacteristics>${rate(fps)}` +
      `<width>${p.info.width}</width><height>${p.info.height}</height>` +
      `</samplecharacteristics></video>` +
      `<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics>` +
      `<channelcount>2</channelcount></audio></media></file>`
    );
  };

  const clipItem = (c: PlacedClip, kind: "video" | "audio"): string => {
    const idAttr = kind === "video" ? `clipitem-v${c.id}` : `clipitem-a${c.id}`;
    const name = `${basename(plan.parts[c.seg.part]!.path)} · ${c.seg.note.slice(0, 40)}`;
    const source =
      kind === "audio"
        ? `<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>`
        : `<sourcetrack><mediatype>video</mediatype><trackindex>1</trackindex></sourcetrack>`;
    return (
      `<clipitem id="${idAttr}"><name>${esc(name)}</name><enabled>TRUE</enabled>` +
      `<duration>${c.srcOut - c.srcIn}</duration>` +
      rate(fps) +
      `<start>${c.recStart}</start><end>${c.recEnd}</end>` +
      `<in>${c.srcIn}</in><out>${c.srcOut}</out>` +
      fileTag(c.seg.part) +
      source +
      `<link><linkclipref>clipitem-v${c.id}</linkclipref><mediatype>video</mediatype><trackindex>1</trackindex><clipindex>${c.id + 1}</clipindex></link>` +
      `<link><linkclipref>clipitem-a${c.id}</linkclipref><mediatype>audio</mediatype><trackindex>1</trackindex><clipindex>${c.id + 1}</clipindex></link>` +
      `</clipitem>`
    );
  };

  const videoItems = clips.map((c) => clipItem(c, "video")).join("\n        ");
  const audioItems = clips.map((c) => clipItem(c, "audio")).join("\n        ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${esc(sequenceName)}</name>
    <duration>${totalFrames}</duration>
    ${rate(fps)}
    <media>
      <video>
        <format><samplecharacteristics>${rate(fps)}<width>${plan.width}</width><height>${plan.height}</height></samplecharacteristics></format>
        <track>
        ${videoItems}
        <enabled>TRUE</enabled><locked>FALSE</locked>
        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <track>
        ${audioItems}
        <enabled>TRUE</enabled><locked>FALSE</locked>
        </track>
      </audio>
    </media>
    <timecode><rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>
  </sequence>
</xmeml>
`;
}

export function writeFcpXml(plan: CutPlan, outPath: string, sequenceName: string): void {
  writeFileSync(outPath, toFcpXml(plan, sequenceName));
}
