import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import faceJson from "../data/face.json";
import { SHOTS, type Shot } from "../layout/shots";
import { contentBoxes, footageRect, FULLSCREEN, lerpRect, usesStage, type Rect } from "./geometry";

/**
 * Face center (normalized 0–1), measured by mg-layout's face_center.py.
 * Cropped layouts (Split card, Bubble) pan the footage so this point sits at
 * the container's center; 0.5/0.5 (the template default) is a plain center
 * crop. Clamped so uncropped layouts (FullFace/Overlay) never shift.
 */
const FACE = {
  x: typeof (faceJson as { x?: unknown }).x === "number" ? (faceJson as { x: number }).x : 0.5,
  y: typeof (faceJson as { y?: unknown }).y === "number" ? (faceJson as { y: number }).y : 0.5,
};

/** Cover-fit the 16:9 footage in `rect`, panned to center FACE. */
function coverOnFace(rect: Rect): { left: number; top: number; w: number; h: number } {
  const scale = Math.max(rect.w / 1920, rect.h / 1080);
  const w = 1920 * scale;
  const h = 1080 * scale;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return {
    left: clamp(rect.w / 2 - FACE.x * w, rect.w - w, 0),
    top: clamp(rect.h / 2 - FACE.y * h, rect.h - h, 0),
    w,
    h,
  };
}

/** Frames a layout transition takes (dock/undock, shrink/grow, fades). */
const TRANSITION_FRAMES = 15;

const FULLSCREEN_SHOT: Shot = {
  id: "default", chapterId: "", origin: "auto-lead", tag: "[FULLFACE]",
  kind: "FULLFACE", content: "none", cells: [], side: null, facePct: null,
  shape: null, startFrame: 0, durationInFrames: 1, purpose: null, subjects: [],
  builds: [], cardTitle: null,
};

function activeIndex(frame: number): number {
  let idx = -1;
  for (let i = 0; i < SHOTS.length; i++) {
    if (SHOTS[i]!.startFrame <= frame) idx = i;
    else break;
  }
  return idx;
}

/**
 * The one component that owns the footage: applies each shot's geometry
 * (real dock/shrink/hide moves, eased over ~0.5s starting ON the anchor
 * word's frame) and renders placeholder panels in the content areas. With
 * an empty SHOTS array it renders plain fullscreen footage — identical to
 * a fresh mg-setup scaffold.
 */
export const FootageStage: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = activeIndex(frame);
  const shot = idx >= 0 ? SHOTS[idx]! : FULLSCREEN_SHOT;
  const prev = idx > 0 ? SHOTS[idx - 1]! : FULLSCREEN_SHOT;

  const t = SHOTS.length === 0 ? 1 : interpolate(
    frame - shot.startFrame,
    [0, TRANSITION_FRAMES],
    [0, 1],
    { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) },
  );
  const rect = lerpRect(idx >= 0 ? footageRect(prev) : FULLSCREEN, footageRect(shot), t);
  const stage = usesStage(shot);
  const fit = coverOnFace(rect);

  return (
    <AbsoluteFill style={{ backgroundColor: stage ? "#17181c" : "#000" }}>
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: rect.radius,
          opacity: rect.opacity,
          overflow: "hidden",
          boxShadow: rect.w < 1900 && rect.opacity > 0.01 ? "0 12px 40px rgba(0,0,0,0.45)" : undefined,
        }}
      >
        <OffthreadVideo
          src={staticFile("footage.mp4")}
          style={{ position: "absolute", left: fit.left, top: fit.top, width: fit.w, height: fit.h }}
        />
      </div>
      {shot.kind !== "FULLFACE"
        ? contentBoxes(shot).map((box, i) => (
            <PlaceholderPanel key={`${shot.id}-${i}`} shot={shot} box={box} opacity={t} frame={frame} />
          ))
        : null}
    </AbsoluteFill>
  );
};

/**
 * Pass-1 placeholder: states the shot's PURPOSE (what the viewer should
 * understand), never its design. mg-visuals replaces panel contents in
 * place — the geometry above never rebuilds.
 */
const PlaceholderPanel: React.FC<{ shot: Shot; box: Rect; opacity: number; frame: number }> = ({
  shot, box, opacity, frame,
}) => {
  if (shot.kind === "CHAPTER") {
    return (
      <div style={{ ...panelStyle(box, opacity), border: "none", background: "transparent", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: 30, opacity: 0.55, marginBottom: 16 }}>chapter card</div>
        <div style={{ fontSize: 56, fontWeight: 700 }}>{shot.cardTitle}</div>
      </div>
    );
  }
  const landed = shot.builds.filter((b) => b.frame <= frame);
  return (
    <div style={panelStyle(box, opacity)}>
      <div style={{ fontSize: 24, opacity: 0.6 }}>
        {shot.id} · {shot.tag}
        {shot.content === "media" ? <span style={{ color: "#e8b339" }}> · MEDIA TO CAPTURE</span> : null}
      </div>
      <div style={{ fontSize: box.w > 800 ? 40 : 28, lineHeight: 1.35, marginTop: 18 }}>
        <span style={{ opacity: 0.6 }}>PURPOSE: </span>
        {shot.purpose ?? "—"}
      </div>
      {shot.subjects.length > 0 ? (
        <div style={{ fontSize: 24, opacity: 0.75, marginTop: 18 }}>subjects: {shot.subjects.join(" · ")}</div>
      ) : null}
      {shot.builds.length > 0 ? (
        <div style={{ fontSize: 24, marginTop: 18 }}>
          {shot.builds.map((b) => (
            <div key={b.word} style={{ opacity: b.frame <= frame ? 1 : 0.3 }}>
              {b.frame <= frame ? "✓" : "○"} build on “{b.word}”
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ position: "absolute", right: 20, bottom: 14, fontSize: 20, opacity: 0.45 }}>
        {landed.length}/{shot.builds.length > 0 ? shot.builds.length : "·"}
      </div>
    </div>
  );
};

function panelStyle(box: Rect, opacity: number): React.CSSProperties {
  return {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    borderRadius: box.radius,
    opacity,
    background: "rgba(255,255,255,0.06)",
    border: "2px dashed rgba(255,255,255,0.35)",
    color: "#e8e8e8",
    fontFamily: "monospace",
    padding: 28,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  };
}
