import React from "react";
import { Composition } from "remotion";
import { Main } from "./Main";
import { VIDEO } from "./video.config";

/**
 * One composition per deliverable. `main` is the long-form video; shorts and
 * thumbnails register here later as their own compositions (`short-1`,
 * `thumb-a`, …).
 */
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="main"
        component={Main}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        durationInFrames={VIDEO.durationInFrames}
        defaultProps={{ debug: true }}
      />
    </>
  );
};
