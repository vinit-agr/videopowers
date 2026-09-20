import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from "remotion";
import { z } from "zod";
import { CHAPTERS } from "./chapters";
import { SyncOverlay } from "./debug/SyncOverlay";

/** Props schema — required for Studio's interactive Props editor (the right
 *  panel stays read-only without one). */
export const mainSchema = z.object({
  debug: z.boolean(),
});

/**
 * The long-form video: full-length mezzanine footage underneath, one named
 * Sequence per chapter on top. Chapter Sequences are the mount points where
 * mg-layout adds this chapter's layout/graphics layers — keep them empty
 * until that pass.
 *
 * `debug` toggles the sync-check overlay (chapter + currently-spoken word);
 * it defaults on so scrubbing verifies beat-sheet and word-timestamp sync.
 */
export const Main: React.FC<z.infer<typeof mainSchema>> = ({ debug }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile("footage.mp4")} />
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
