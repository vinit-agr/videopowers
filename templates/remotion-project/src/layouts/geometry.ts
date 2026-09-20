import type { Shot } from "../layout/shots";

/**
 * Pure geometry for the five layouts on a 1920×1080 stage with a 3×3 grid.
 * Theme-free by design — mg-visuals restyles content, never restructures.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  opacity: number;
}

export const STAGE_W = 1920;
export const STAGE_H = 1080;
const MARGIN = 48;

export const FULLSCREEN: Rect = { x: 0, y: 0, w: STAGE_W, h: STAGE_H, radius: 0, opacity: 1 };

/** Center of a 1–9 grid cell (top-left across, then down). */
export function cellCenter(cell: number): { x: number; y: number } {
  const col = (cell - 1) % 3;
  const row = Math.floor((cell - 1) / 3);
  return { x: (col + 0.5) * (STAGE_W / 3), y: (row + 0.5) * (STAGE_H / 3) };
}

/** Where the footage sits for a shot. */
export function footageRect(shot: Shot): Rect {
  switch (shot.kind) {
    case "FULLFACE":
    case "OVERLAY":
      return FULLSCREEN;
    case "SPLIT": {
      const pct = (shot.facePct ?? 35) / 100;
      const w = Math.round(STAGE_W * pct);
      const h = Math.round((w * 9) / 16);
      const y = Math.round((STAGE_H - h) / 2);
      const x = shot.side === "right" ? STAGE_W - MARGIN - w : MARGIN;
      return { x, y, w, h, radius: 24, opacity: 1 };
    }
    case "BUBBLE": {
      const d = 280;
      const c = cellCenter(shot.cells[0] ?? 9);
      // Keep the bubble inside the frame with a margin.
      const x = Math.min(Math.max(c.x - d / 2, MARGIN), STAGE_W - MARGIN - d);
      const y = Math.min(Math.max(c.y - d / 2, MARGIN), STAGE_H - MARGIN - d);
      return { x, y, w: d, h: d, radius: shot.shape === "rect" ? 24 : d / 2, opacity: 1 };
    }
    case "FULLGRAPHICS":
    case "CHAPTER":
      return { ...FULLSCREEN, opacity: 0 };
  }
}

/** Where content panels sit for a shot (empty for FULLFACE). */
export function contentBoxes(shot: Shot): Rect[] {
  switch (shot.kind) {
    case "FULLFACE":
      return [];
    case "OVERLAY": {
      const w = 520;
      const h = 300;
      return shot.cells.map((cell) => {
        const c = cellCenter(cell);
        const x = Math.min(Math.max(c.x - w / 2, MARGIN), STAGE_W - MARGIN - w);
        const y = Math.min(Math.max(c.y - h / 2, MARGIN), STAGE_H - MARGIN - h);
        return { x, y, w, h, radius: 16, opacity: 1 };
      });
    }
    case "SPLIT": {
      const face = footageRect(shot);
      const x = shot.side === "right" ? MARGIN : face.x + face.w + MARGIN;
      const w = STAGE_W - 2 * MARGIN - face.w - MARGIN;
      return [{ x, y: MARGIN, w, h: STAGE_H - 2 * MARGIN, radius: 16, opacity: 1 }];
    }
    case "BUBBLE":
    case "FULLGRAPHICS":
      return [{ x: MARGIN, y: MARGIN, w: STAGE_W - 2 * MARGIN, h: STAGE_H - 2 * MARGIN, radius: 16, opacity: 1 }];
    case "CHAPTER": {
      const w = 1200;
      const h = 320;
      return [{ x: (STAGE_W - w) / 2, y: (STAGE_H - h) / 2, w, h, radius: 16, opacity: 1 }];
    }
  }
}

/** Layouts that sit on the dark stage background (vs clean black). */
export function usesStage(shot: Shot): boolean {
  if (shot.kind === "SPLIT" || shot.kind === "CHAPTER") return true;
  if ((shot.kind === "FULLGRAPHICS" || shot.kind === "BUBBLE") && shot.content !== "media") return true;
  return false;
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    x: l(a.x, b.x),
    y: l(a.y, b.y),
    w: l(a.w, b.w),
    h: l(a.h, b.h),
    radius: l(a.radius, b.radius),
    opacity: l(a.opacity, b.opacity),
  };
}
