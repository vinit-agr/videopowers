import type { Problem, ResolvedShot } from "./types.js";

/**
 * The retention rules as mechanical checks over the resolved timeline.
 * Errors block apply; warnings inform the Level-5 repair pass.
 */
export function lintShots(shots: ResolvedShot[]): Problem[] {
  const problems: Problem[] = [];
  const err = (where: string, message: string) => problems.push({ level: "error", where, message });
  const warn = (where: string, message: string) => problems.push({ level: "warning", where, message });

  for (const s of shots) {
    const dur = s.endSec - s.startSec;

    // Purpose is the contract with mg-visuals — required wherever content exists.
    if (s.origin === "yaml" && s.spec.kind !== "FULLFACE" && !s.purpose) {
      err(s.id, "purpose is required for every non-FULLFACE shot (it is the placeholder's text and mg-visuals' brief)");
    }

    // Media legibility rule: media never shares the screen with a big face.
    if (s.spec.kind === "SPLIT" && s.spec.content === "media" && (s.spec.facePct ?? 0) > 20) {
      err(s.id, `[SPLIT media] face is ${s.spec.facePct}% — media splits must be ≤20% (prefer 18%, Bubble, or FullGraphics)`);
    }

    // Dwell rules.
    if ((s.spec.kind === "FULLFACE") && dur > 20 && s.builds.length === 0 && s.origin === "yaml") {
      warn(s.id, `FULLFACE runs ${dur.toFixed(1)}s with no builds — cap ~20s unless the moment earns it (add an overlay accent or split the span)`);
    }
    if (s.origin === "auto-lead" && dur > 20) {
      warn(s.id, `implicit FULLFACE lead runs ${dur.toFixed(1)}s — consider an explicit shot earlier in the chapter`);
    }
    if (s.spec.kind !== "FULLFACE" && s.origin === "yaml" && dur > 30 && s.builds.length === 0) {
      warn(s.id, `${s.spec.kind} holds ${dur.toFixed(1)}s with no builds — nothing changes on screen for too long`);
    }
    if (s.spec.kind === "FULLGRAPHICS" && s.spec.content === "graphics" && dur > 40) {
      warn(s.id, `FULLGRAPHICS runs ${dur.toFixed(1)}s — cap ~40s; prefer Bubble or Split beyond that (faces anchor viewers)`);
    }
  }

  // Adjacent identical geometry (chapter cards break adjacency).
  for (let i = 1; i < shots.length; i++) {
    const a = shots[i - 1]!;
    const b = shots[i]!;
    if (a.origin === "chapter-card" || b.origin === "chapter-card") continue;
    if (a.spec.kind !== "FULLFACE" && sameGeometry(a, b)) {
      warn(b.id, `same layout + geometry as the previous shot (${a.id}) — flip the dock side or cells so repetition reads as intent`);
    }
  }

  // Visual-change cadence: events are shot starts, builds, and cards.
  const events: number[] = [];
  for (const s of shots) {
    if (s.origin !== "auto-lead") events.push(s.startSec);
    for (const b of s.builds) events.push(b.sec);
  }
  events.sort((x, y) => x - y);
  for (let i = 1; i < events.length; i++) {
    const gap = events[i]! - events[i - 1]!;
    const limit = events[i - 1]! < 120 ? 15 : 25;
    if (gap > limit) {
      warn(
        `${fmt(events[i - 1]!)}→${fmt(events[i]!)}`,
        `no visual change for ${gap.toFixed(1)}s (limit ${limit}s here) — add a build, an overlay accent, or a switch`,
      );
    }
  }

  return problems;
}

function sameGeometry(a: ResolvedShot, b: ResolvedShot): boolean {
  return (
    a.spec.kind === b.spec.kind &&
    a.spec.content === b.spec.content &&
    a.spec.side === b.spec.side &&
    a.spec.facePct === b.spec.facePct &&
    a.spec.cells.join(",") === b.spec.cells.join(",")
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(0).padStart(2, "0")}`;
}
