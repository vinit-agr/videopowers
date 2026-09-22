---
name: mg-visuals
description: Use for Pass 2 of the motion-graphics work — replace mg-layout's placeholders with real graphics in the video's locked design system. Fully automated two-phase run — global ideation writes chapter briefs + a motif registry, then parallel subagents build each chapter with a render-stills-and-look quality loop. Also handles the user's Studio review notes afterward (notes mode) and re-runs media slots when captures land.
---

# mg-visuals

Pass 2: every placeholder becomes a real graphic. Instruction-driven — you
(Claude) run the phases; the plugin ships the runtime as templates. No
human gates inside the run: the user reviews the finished chapters in
Remotion Studio and sends notes. Design spec:
`docs/specs/2026-09-22-mg-visuals-design.md`.

Prerequisites: mg-layout applied (`layout/layout.yaml` + generated
`src/layout/shots.ts`) and a locked style in `design/active/<style>/`.
Refuse to run without both.

## Judgment framework (what a graphic should SAY)

Apply these in order for every beat; they go into every brief and every
build agent's head:

**J1 — Ear-load.** The screen carries what the ear drops: structure,
lists, sequences, numbers, names, relations between >2 things. When the
ear is fine (one point, elaborated), the screen adds presence and
emphasis, not information. Bullet karaoke is banned: never typeset a
spoken sentence as a sentence unless the words themselves are the point.

**J2 — Role→form.** The moment's rhetorical role picks the form:
process → flow that fills in · comparison → side-by-side · definition →
term stamped, then annotated · claim → key phrase isolated · example/
proof → the actual thing (media) · punchline → clean face, add nothing.
Content is **anchored-literal**: drawn from the words actually said
(script.md); writing the spoken phrase verbatim is a legitimate graphic;
metaphor only when the script itself uses one.

**J3 — Scene-with-state.** A chapter is ONE visual arc, not a slideshow:
a set the viewer learns, elements that build, then PARK (shrink to an
edge as glanceable furniture), then get pointed back to. Every element
still enters on its spoken word and exits when the conversation leaves
it. Parked items must never compete with new content or media.

## Phase A — Global ideation (you, full-video context)

Read END TO END: `script.md` (content truth — never reconstruct meaning
from words.json), `layout/layout.yaml`, `design/active/<style>/
design-system.md`, `layout/media-shots.md`.

Write `visuals/motifs.md`: every concept appearing in ≥2 chapters gets
ONE canonical visual form + a shared component name + where it appears.
This registry is the only cross-chapter context build agents receive.

Write `visuals/briefs/chNN.md` per chapter:

```markdown
# chNN — <chapter display name>
## Scene
<3–6 sentences: the set, the arc, what accumulates/parks where>
## Beats
- chNN-s01 — <what appears/moves/parks>, entering on "<verbatim words>"
- chNN-s02 — (clean face)                        ← FULLFACE is deliberate
## Amendments
<layout.yaml changes made + reasons, or "none">
## Media
- chNN-s0X — expects public/media/chNN-s0X.mp4; framed as <plan>
```

**Layout amendments:** you MAY edit layout.yaml where the scene idea
justifies it (boundaries, types, builds). Every change gets a reason in
the brief; then run mg-layout's `pnpm layout <remotion-dir> lint` and
`apply` — amendments land lint-clean and shots.ts regenerated BEFORE
Phase B0. Build agents may never touch layout.yaml.

**Self-review (one pass, same context), fix inline:** motif compliance;
novelty distribution (no signature trick repeated across chapters); J1
on every text-carrying beat; every entering-phrase exists verbatim in
words.json within its shot's span (spot-check with the lib's rules —
case/punctuation-insensitive).

## Phase B0 — Shared kit + scaffold (you, before any fan-out)

1. Copy `templates/visuals/{registry.ts,lib.ts,MediaSlot.tsx}` (from this
   plugin) into `src/graphics/` if absent.
2. Wire the runtime (once per project):
   - Main.tsx: inside each chapter `<Sequence>`, replace the empty
     Fragment with the registry lookup:
     `const G = CHAPTER_GRAPHICS[ch.id]; … {G ? <G /> : null}` — and
     EXTEND the Sequence to `durationInFrames + round(gapAfterSec*fps)`:
     the chapter title-card shot lives in the black gap AFTER the
     chapter, outside the original span. Chapter components use
     `useAbsoluteFrame(chapterId)` (lib.ts) — anchors are absolute.
   - FootageStage: skip the placeholder when built —
     `contentBoxes(shot).map(…)` gains a
     `BUILT_SHOT_IDS.has(shot.id) ? null : <PlaceholderPanel …>` guard.
3. Build `src/graphics/shared/` components named in motifs.md; typecheck.
4. Pre-create every `src/graphics/chNN/index.tsx` stub, each exporting
   `ChNN` (returns null) AND `BUILT: string[]` (empty). Write the real
   registry.ts now, importing every stub: `CHAPTER_GRAPHICS` maps chapter
   ids to components; `BUILT_SHOT_IDS = new Set([...B01, ...B02, …])`
   derives from the chapters' own BUILT exports. After this step no
   shared file is ever edited again — that is the no-merge-conflict
   guarantee for parallel agents.

## Phase B — Parallel chapter builds (one subagent per chapter)

Dispatch all chapters in one message (background subagents). On a first
run in a new project, pilot ONE chapter to validate the loop, then fan
out the rest.

Each agent's prompt contains, and nothing more: its chapter's brief
(verbatim), motifs.md, the paths to design-system.md + tokens, its
chapter's shots (from shots.ts) and script.md section, the lib API
summary, and these standing orders:

- Edit ONLY inside `src/graphics/chNN/`. Keep your folder's `BUILT`
  export up to date — a shot id goes in the moment its graphic renders
  (that's what hides its placeholder).
- Style from `design/active/` tokens ONLY — no raw colors/fonts;
  design-system.md's bans are law. Motion verbs from the system.
- Place content with `shotBox()`; time with `buildFrame()`/`wordFrame()`
  (+ the shot's startFrame); enter with `enterProgress()` ON the word.
- Media shots: render the styled frame around `<MediaSlot ready={false}>`
  (or `ready` if the capture file already exists in `public/media/`).
- Quality loop, max 2 rounds: implement → `pnpm exec tsc --noEmit` →
  render stills at every shot's anchor frames into your scratch dir
  (`npx remotion still main --frame=<N> <scratch>/chNN-<shot>.png`) →
  READ the images → critique vs the brief: enters on word? legible at a
  glance? scene state correct (parked items parked)? tokens only? → fix.
- Report: shots built, deviations from brief + why, flags, still paths.

## Phase C — Assembly + report (you)

Collect reports (BUILT_SHOT_IDS already derives from the chapters'
BUILT exports); full `tsc --noEmit`; render one still per chapter and
look. Report to the
user: per-chapter summary, amendments made, media slots pending, flags.
Tell them to review in Studio and send notes.

## Notes mode

The user says things like "ch03 flow too crowded" or "12:40 stamp is
late". Map each note to chapter/shot (timestamps → frame = t×fps →
shots.ts). If the intent changed, patch the brief first, then dispatch
scoped fixes (parallel when notes span chapters), same quality loop.

## Media pass

When the user records a capture: place it at `public/media/<shot-id>.mp4`,
flip that slot's `ready` to true, verify the still. No other change if it
matches the brief's framing plan.

## Rules of taste (learned the hard way)

- The brief is thinking, not bureaucracy — if a beat's line is hard to
  write, the graphic idea isn't ready; fix the idea, not the wording.
- Novelty is a global budget: the second chapter that opens with the same
  trick makes both feel templated.
- Parked ≠ visible forever: park what will be POINTED BACK TO; everything
  else exits.
- When a beat fights its layout, amend layout.yaml in Phase A — building
  a graphic against the wrong geometry wastes the whole loop.
