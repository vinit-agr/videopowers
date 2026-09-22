---
name: mg-design
description: Use to decide a video's motion-graphics look and feel — brainstorm style candidates, preview each as a probe reel on the video's own footage inside Remotion Studio, and lock the winner as a style package (design-system.md + tokens.ts) that mg-visuals consumes. Runs any time before mg-visuals; also handles reusing or tweaking a look from a previous video.
---

# mg-design

Turns "how should the graphics look" into a decided, written, machine-
readable **style package**. Instruction-driven: you (Claude) do the file
operations and write the candidates; the plugin ships the probe machinery
as templates. Design spec: `docs/specs/2026-09-22-mg-design-design.md`.

**Remotion Studio is the visual companion.** Candidates render on the
video's real footage in the real layouts. Never mock styles in HTML — the
probe IS the implementation, so the preview cannot lie.

## The style package (the unit of look-and-feel)

```
<name>/
  design-system.md   the written rules — concept, laws, element inventory,
                     motion language. The contract Claude reads in mg-visuals.
  tokens.ts          exports TOKENS: BaseTokens (+ any extra exports the
                     system needs). The contract components read.
  fonts.ts           optional: exports loadFonts() when web fonts are needed
  assets/            optional: textures, stamps
```

`BaseTokens` lives in `templates/design/probe/tokens-base.ts` and is copied
into each project. Packages may export more than the base (modes, laws) —
document every extra in design-system.md, with the bans as explicit as the
rules (bans are what stop AI drift toward generic).

## Project layout

```
remotion/design/active/<name>/      THE look — all mg-visuals ever reads
remotion/design/candidates/<name>/  being auditioned
remotion/design/archive/<name>/     auditioned, not chosen — never deleted
remotion/src/design/                probe machinery + per-candidate comps
```

## Workflow

**0. Init (first run in a project):** create the three `design/` dirs; copy
`templates/design/probe/{Probe,Gallery,tokens-base}.{tsx,ts}` into
`src/design/`; create `src/design/index.tsx` exporting `DesignComps` (a
`<Folder name="design">` of compositions); mount it in Root.tsx (2-line
edit: import + `<DesignComps />`).

**1. Get candidates** — three tracks, same machinery:
- *Fresh:* brainstorm references with the user ("styles you admire?"),
  then write 2–4 candidate packages into `candidates/` (skeleton:
  `templates/design/package-skeleton/`). Make candidates genuinely
  different — different worlds, not palette swaps.
- *Use as-is:* copy the package from the other video's
  `remotion/design/active/<name>/` into `candidates/` unchanged.
- *Import + tweak:* copy in as `<name>-v2`, apply the user's changes to
  tokens/rules, audition v2 against the original.

**2. Register probes:** for each candidate, a 3-line comp file
`src/design/probe-<name>.tsx` (import its TOKENS, render `<Probe
tokens={TOKENS}/>`), registered in `index.tsx` as `design/probe-<name>`
(duration `PROBE_DURATION`, 1920×1080@30). With >1 candidate also register
`design/gallery` (`<Gallery candidates={[...]}/>`). If a package has
`fonts.ts`, call its `loadFonts()` at the top of the probe comp file and
`pnpm add @remotion/google-fonts@<pinned remotion version>` in the project.

**3. User reviews in Studio** — scrub the probe (8 scenes × 4s: chapter
card, claim+emphasis, list build, number stamp, versus, drawn figure,
quote+hand note, tracker chip). Notes → edit the candidate's tokens/rules →
hot reload. Iterate until one wins.

**4. Promote:** move winner → `active/`, others → `archive/`; unregister
losers' probe comps (keep the winner's — it's the living spec of the kit);
set the winner's design-system.md status to ADOPTED. mg-visuals reads
`design/active/` from here on.

## The probe is the contract test

A package is valid when its probe comp typechecks and renders. If a token
the probe needs is missing, the project won't build — that's the test
suite. When adding a new element type to a system later (in mg-visuals),
consider adding a scene for it to the probe: the probe should stay the
one place every element of the kit is visible at once.

## Rules of taste (learned the hard way)

- Default AI styling drifts to the same generic look — a design system is
  mostly its **prohibitions**. Write them down.
- A style is a *world* (what desk/place do these graphics come from?), not
  a palette. Candidates that differ only in colors teach the user nothing.
- Annotations arrive AFTER their target. Punch effects (bounce/glow/3D)
  are banned by default; a package must opt in explicitly.
- The design must read on the real footage — that's why the probe stages
  elements over it, portrait Split crop included.

## Future (noted, not built)

Cross-video style library with an env-var location; plugin-shipped example
packages; texture/asset pipeline; sound pairing.
