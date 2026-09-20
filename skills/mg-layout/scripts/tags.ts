import type { LayoutSpec } from "./types.js";

/**
 * Parse a vocabulary tag like "[SPLIT media 18%]" into a LayoutSpec.
 *
 * Defaults (videopowers revision of the vocabulary):
 * - OVERLAY → graphics in cells 4 and 6
 * - SPLIT graphics → face left, 35%
 * - SPLIT media → face right, **18%** (media legibility rule: media never
 *   shares the screen with a 25–35% face; >20% media split is a lint error)
 * - BUBBLE → cell 9, circle
 * - FULLGRAPHICS → graphics unless "media"
 */
export function parseTag(raw: string): LayoutSpec {
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  const tokens = inner.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error(`empty layout tag: "${raw}"`);
  const kind = tokens[0]!.toUpperCase();
  const rest = tokens.slice(1).map((t) => t.toLowerCase());

  const spec: LayoutSpec = {
    kind: "FULLFACE",
    content: "none",
    cells: [],
    side: null,
    facePct: null,
    shape: null,
  };

  const take = (pred: (t: string) => boolean): string | undefined => {
    const i = rest.findIndex(pred);
    if (i === -1) return undefined;
    return rest.splice(i, 1)[0];
  };
  const contentTok = () => take((t) => t === "graphics" || t === "media");
  const pctTok = () => take((t) => /^\d+(\.\d+)?%$/.test(t));
  const cellsTok = () => take((t) => /^\d(,\d)*$/.test(t));
  const bad = (what: string) => new Error(`unrecognized ${what} in tag "${raw}"`);

  switch (kind) {
    case "FULLFACE": {
      if (rest.length > 0) throw bad(`modifier "${rest[0]}"`);
      return spec;
    }
    case "OVERLAY": {
      spec.kind = "OVERLAY";
      spec.content = (contentTok() as "graphics" | "media" | undefined) ?? "graphics";
      const cells = cellsTok();
      spec.cells = cells ? cells.split(",").map(Number) : [4, 6];
      if (spec.cells.some((c) => c < 1 || c > 9)) throw bad("cell number");
      if (rest.length > 0) throw bad(`modifier "${rest[0]}"`);
      return spec;
    }
    case "SPLIT": {
      spec.kind = "SPLIT";
      spec.content = (contentTok() as "graphics" | "media" | undefined) ?? "graphics";
      const side = take((t) => t === "left" || t === "right") as "left" | "right" | undefined;
      const pct = pctTok();
      spec.side = side ?? (spec.content === "media" ? "right" : "left");
      spec.facePct = pct ? Number(pct.replace("%", "")) : spec.content === "media" ? 18 : 35;
      if (rest.length > 0) throw bad(`modifier "${rest[0]}"`);
      return spec;
    }
    case "BUBBLE": {
      spec.kind = "BUBBLE";
      spec.content = (contentTok() as "graphics" | "media" | undefined) ?? "graphics";
      const cells = cellsTok();
      spec.cells = cells ? cells.split(",").map(Number) : [9];
      if (spec.cells.length !== 1 || spec.cells[0]! < 1 || spec.cells[0]! > 9) throw bad("bubble cell");
      spec.shape = (take((t) => t === "circle" || t === "rect") as "circle" | "rect" | undefined) ?? "circle";
      if (rest.length > 0) throw bad(`modifier "${rest[0]}"`);
      return spec;
    }
    case "FULLGRAPHICS": {
      spec.kind = "FULLGRAPHICS";
      spec.content = (contentTok() as "graphics" | "media" | undefined) ?? "graphics";
      if (rest.length > 0) throw bad(`modifier "${rest[0]}"`);
      return spec;
    }
    default:
      throw new Error(`unknown layout "${kind}" in tag "${raw}" (FULLFACE|OVERLAY|SPLIT|BUBBLE|FULLGRAPHICS)`);
  }
}
