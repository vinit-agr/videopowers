/**
 * The base tokens contract — the minimum every style package must export
 * (as `TOKENS`) for the probe to render it. Packages may export anything
 * else on top (modes, laws, per-element rules); mg-visuals reads those via
 * the package's design-system.md.
 */
export interface BaseTokens {
  /** Package name, e.g. "editorial-ink". */
  name: string;
  /** Stage background behind graphics (Split content side, FullGraphics). */
  stage: string;
  /** Card/panel background. */
  panel: string;
  /** Card/panel border color ("transparent" for none). */
  panelBorder: string;
  /** Primary text/stroke color. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** The emphasis voice (underlines, ticks, hand notes). */
  accent: string;
  /** The highlighter (swipes, stickers, key numbers). */
  highlight: string;
  /** Corner radius for cards. */
  radius: number;
  /** Figure stroke width. */
  strokeWidth: number;
  /** Drop shadow color (used behind cards and the docked face). */
  shadow: string;
  fonts: {
    /** Claims, titles, big numbers — CSS font-family stack. */
    display: string;
    displayWeight: number;
    /** Labels, data, captions. */
    body: string;
    /** Hand/annotation voice (optional — falls back to body). */
    hand?: string;
  };
  motion: {
    /** Standard element entrance (cards sliding/fading in), seconds. */
    enterSec: number;
    /** Figure stroke draw-on, seconds. */
    drawSec: number;
    /** How long an annotation waits after its target, seconds. */
    annotationDelaySec: number;
  };
}

/** Neutral placeholder look — what the package skeleton starts from. */
export const NEUTRAL_TOKENS: BaseTokens = {
  name: "neutral",
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
