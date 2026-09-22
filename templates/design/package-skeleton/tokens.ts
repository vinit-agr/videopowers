// Style package: <NAME> — created by videopowers:mg-design.
// TOKENS must satisfy the BaseTokens contract (src/design/tokens-base.ts in
// the video project). Add any extra exports your system needs (modes, laws,
// per-element rules) and document them in design-system.md.

import type { BaseTokens } from "../../../src/design/tokens-base";

export const TOKENS: BaseTokens = {
  name: "CHANGE-ME",
  stage: "#17181c",
  panel: "#232530",
  panelBorder: "#3a3d4d",
  ink: "#e8e8ee",
  muted: "#9a9daf",
  accent: "#e0573b",
  highlight: "#ffd94d",
  radius: 14,
  strokeWidth: 2.4,
  shadow: "rgba(0,0,0,0.45)",
  fonts: {
    display: "Georgia, 'Times New Roman', serif",
    displayWeight: 800,
    body: "-apple-system, 'Helvetica Neue', Arial, sans-serif",
    hand: "'Comic Sans MS', 'Marker Felt', cursive",
  },
  motion: { enterSec: 0.4, drawSec: 1.2, annotationDelaySec: 0.45 },
};
