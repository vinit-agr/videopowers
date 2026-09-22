import React from "react";
import { AbsoluteFill } from "remotion";
import { Probe } from "./Probe";
import type { BaseTokens } from "./tokens-base";

/**
 * Up to four candidates, same probe reel, same timeline, one screen.
 * Register when auditioning more than one package.
 */
export const Gallery: React.FC<{ candidates: BaseTokens[] }> = ({ candidates }) => {
  const cells = candidates.slice(0, 4);
  const cols = cells.length <= 1 ? 1 : 2;
  const rows = cells.length <= 2 ? (cells.length <= 1 ? 1 : 1) : 2;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {cells.map((t, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <div
            key={t.name}
            style={{
              position: "absolute",
              left: (1920 / cols) * col,
              top: (1080 / Math.max(rows, cells.length > 2 ? 2 : 1)) * row,
              width: 1920,
              height: 1080,
              transform: `scale(${1 / cols}, ${1 / (cells.length > 2 ? 2 : rows)})`,
              transformOrigin: "top left",
              outline: "1px solid #333",
            }}
          >
            <Probe tokens={t} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
