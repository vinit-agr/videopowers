// videopowers:mg-visuals — a framed media area whose capture may not exist
// yet. The chapter component owns the styled frame AROUND this slot; the
// slot only fills the box with the capture, or a "pending" card until the
// file lands in public/media/. Flipping `ready` (and re-running the media
// pass) is the only change needed when a capture arrives.
import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import type { Shot } from "../layout/shots";
import type { Rect } from "../layouts/geometry";

export const mediaSrc = (shot: Shot): string => `media/${shot.id}.mp4`;

export const MediaSlot: React.FC<{
  shot: Shot;
  box: Rect;
  /** true once public/media/<shot-id>.mp4 exists (build-time fact, set by the skill). */
  ready: boolean;
  /** Frames of the CAPTURE to skip before playing (default 0). */
  startFrom?: number;
  opacity?: number;
}> = ({ shot, box, ready, startFrom = 0, opacity = 1 }) => {
  const style: React.CSSProperties = {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    borderRadius: box.radius,
    overflow: "hidden",
    opacity,
  };
  if (ready) {
    return (
      <div style={style}>
        <OffthreadVideo
          src={staticFile(mediaSrc(shot))}
          startFrom={startFrom}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        ...style,
        background: "rgba(255,255,255,0.05)",
        border: "2px dashed rgba(255,255,255,0.3)",
        color: "#ddd",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        boxSizing: "border-box",
        padding: 32,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 26, opacity: 0.7 }}>capture pending · {mediaSrc(shot)}</div>
      <div style={{ fontSize: 34, lineHeight: 1.35, maxWidth: "80%" }}>{shot.purpose}</div>
    </div>
  );
};
