import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { z } from "zod";
import { CHAPTERS } from "./chapters";
import { SyncOverlay } from "./debug/SyncOverlay";
import { FootageStage } from "./layouts/FootageStage";

/** Props schema — required for Studio's interactive Props editor (the right
 *  panel stays read-only without one). */
export const mainSchema = z.object({
  debug: z.boolean(),
});

/**
 * The long-form video. FootageStage owns the footage and applies the
 * mg-layout shot geometry (with an empty shots.ts it's plain fullscreen
 * footage). The named chapter Sequences carry no content — they exist so
 * the Studio timeline shows where every chapter sits.
 *
 * `debug` toggles the sync-check overlay (chapter + currently-spoken word);
 * it defaults on so scrubbing verifies beat-sheet and word-timestamp sync.
 */
export const Main: React.FC<z.infer<typeof mainSchema>> = ({ debug }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <FootageStage />
      {CHAPTERS.map((ch) => (
        <Sequence
          key={ch.id}
          name={ch.displayName}
          from={ch.startFrame}
          durationInFrames={ch.durationInFrames}
        >
          <React.Fragment />
        </Sequence>
      ))}
      {debug ? <SyncOverlay /> : null}
    </AbsoluteFill>
  );
};
