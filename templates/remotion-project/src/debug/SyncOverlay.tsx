import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CHAPTERS } from "../chapters";
import wordsJson from "../data/words.json";

interface Word {
  text: string;
  start: number;
  end: number;
  type?: string;
}

/**
 * Development-only overlay: shows the current chapter and the word being
 * spoken at the playhead, straight from beat-sheet + words.json. If what you
 * hear doesn't match what you read while scrubbing, the data downstream
 * passes depend on is wrong — fix that before mg-layout.
 */
export const SyncOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const words = useMemo(
    () => (wordsJson as Word[]).filter((w) => (w.type ?? "word") === "word"),
    [],
  );

  const chapter = CHAPTERS.find((c) => t >= c.startSec && t < c.endSec) ?? null;
  const word = words.find((w) => t >= w.start && t < w.end) ?? null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", pointerEvents: "none" }}>
      <div
        style={{
          margin: 32,
          padding: "12px 18px",
          background: "rgba(0, 0, 0, 0.72)",
          color: "#fff",
          fontFamily: "monospace",
          borderRadius: 10,
          maxWidth: "60%",
        }}
      >
        <div style={{ fontSize: 20, opacity: 0.75, marginBottom: 4 }}>
          {chapter ? chapter.displayName : "— chapter gap —"}
        </div>
        <div style={{ fontSize: 34 }}>{word ? word.text : "·"}</div>
      </div>
    </AbsoluteFill>
  );
};
