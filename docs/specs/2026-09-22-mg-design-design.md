# mg-design — design

Approved 2026-09-22. The look-and-feel stage: turn "how should the graphics
look" into a decided, written, machine-readable design system — previewed in
Remotion Studio on the video's own footage. Runs any time before mg-visuals
(only mg-visuals depends on it); slots naturally after mg-layout.

## Decisions locked

1. **Studio is the visual companion.** No standalone browser page, no
   external plugin. Candidates render as compositions in the video's own
   Remotion project, on the real footage, in the real layouts. The preview
   cannot lie: the tokens that styled the winning candidate are the tokens
   mg-visuals consumes.
2. **A look is a folder — the "style package":**
   `design-system.md` (written rules; the contract Claude reads in
   mg-visuals) + `tokens.ts` (the machine half; the contract components
   read) + `assets/` (textures, stamps) + optional `preview.png`.
3. **Per-video only, no cross-video library (v1).** "Import" = copy a
   package from another video project's `remotion/design/` (or any path).
   A personal style library is a noted future idea, not built.
4. **Instruction-driven + templates.** No CLI: the file ops are trivial
   (copy, register, promote) and the core is judgment. Probe/gallery
   components and the package skeleton ship as plugin templates
   (`templates/design/`).
5. **Non-chosen candidates are archived, never deleted.**

## In-project layout

```
remotion/
  design/
    active/<name>/        ← THE look; the only thing mg-visuals reads
    candidates/<name>/    ← packages being auditioned
    archive/<name>/       ← auditioned, not chosen, kept
  src/design/             ← probe machinery + per-candidate comp files
```

Studio sidebar (via `<Folder name="design">` registered from
`src/design/index.tsx`, mounted with a 2-line edit in Root.tsx):

```
main
design/
  probe-<candidate>       one per candidate, full-screen probe reel
  gallery                 up to 4 candidates in quadrants (when >1)
```

## The probe reel (the templatized-content answer)

Elements are **templatized archetypes** with fixed dummy content; the stage
is the **real footage in the real layouts** (portrait Split crop included).
That breaks the chicken-and-egg (no visuals decisions needed before the
look) while keeping judgment in context. Eight scenes, ~4s each:

1. chapter title card · 2. claim card + emphasis (Overlay) · 3. list build
(Split) · 4. big number stamp (Overlay) · 5. two-column versus (Split
right) · 6. drawn figure, strokes draw on (FullGraphics) · 7. quote card +
hand annotation · 8. tracker chip / lower third.

The probe doubles as the living spec of the tokens contract: every question
a design system must answer is asked once, on screen.

## The tokens contract

`tokens.ts` must export `TOKENS: BaseTokens` (interface in
`templates/design/probe/tokens-base.ts`): stage/panel/ink/muted/accent/
highlight colors, radius, strokeWidth, shadow, font stacks
(display/body/hand), motion (enterSec/drawSec/annotationDelaySec). The probe
renders from BaseTokens alone. Packages may export **anything else** on top
(modes, laws, element rules) — mg-visuals reads those through
design-system.md. Optional `fonts.ts` exporting `loadFonts()` when the
package needs web fonts (project adds `@remotion/google-fonts`).

## Workflow (three tracks, one machinery)

- **Fresh:** brainstorm references → Claude writes 2–4 candidate packages →
  probe comps (+ gallery when >1) → user picks in Studio → promote winner
  to `active/`, rest to `archive/`, unregister their comps.
- **Use as-is:** copy the package from the other project into
  `candidates/`, one probe render as a sanity check on THIS footage,
  promote.
- **Import + tweak:** copy in as `<name>-v2`, edit tokens, compare v2 vs
  original in the gallery, promote the winner.

## Future ideas (noted, not built)

Cross-video style library (env-var location, "reuse / tweak / fresh" prompt
at start); paper-texture and torn-clipping assets; sound-design pairing;
promoting a video-proven package back upstream as a plugin example package.

## Testing

No CLI → no unit tests. The gate is the probe itself: a package is valid
when its probe comp typechecks and renders. Live test: porting the harness
"editorial-ink" system for the Remotion-with-CC video.
