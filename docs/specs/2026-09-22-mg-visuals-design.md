# mg-visuals — design

Date: 2026-09-22 · Status: approved (brainstormed with Vinit, two-phase
architecture chosen) · Skill type: instruction-driven + shipped runtime
templates (like mg-design; no CLI)

## Purpose

Pass 2 of the motion-graphics work: turn every mg-layout placeholder into a
real graphic in the video's locked style (`design/active/`). Fully
automated — no human approval gates inside the run. The human reviews the
result in Remotion Studio afterward and feeds notes back through the
skill's notes mode.

The skill's core is a **judgment framework** (what should this graphic
say?) plus a **four-phase pipeline** (global ideation, then parallel
per-chapter builds).

## Inputs / outputs

**In:**
- `layout/layout.yaml` — shots, types, purposes, subjects, word anchors
  (source of truth for WHERE/WEIGHT; amendable, see below)
- `script.md` — what is actually said (source of truth for CONTENT — read
  it directly; never reconstruct meaning from words.json alone)
- `src/data/words.json` — timestamps for anchoring
- `design/active/<style>/` — design-system.md + tokens (source of truth
  for LOOK; read-only to this skill)
- `layout/media-shots.md` — capture dependencies

**Out:**
- `visuals/motifs.md` — recurring-concept registry
- `visuals/briefs/chNN.md` — one brief per chapter
- `src/graphics/` — shared kit + one component tree per chapter
- Placeholders replaced in the running comp; media shots get framed
  `MediaSlot`s that show a placeholder until the capture file exists

## Judgment framework (goes verbatim into SKILL.md)

**J1 — Ear-load.** The screen carries what the ear drops: structure,
lists, sequences, numbers, names, relations between >2 things. When the
ear is fine (one point, elaborated), the screen adds presence and
emphasis, not information. Kills bullet karaoke: spoken sentences are
never typeset as sentences unless the words themselves are the point.

**J2 — Role→form.** The rhetorical role picks the visual form: process →
flow that fills in; comparison → side-by-side; definition → term stamped
then annotated; claim → key phrase isolated; example/proof → the actual
thing (media); punchline → clean face, nothing added. Content is
**anchored-literal**: drawn from the words actually said; writing the
spoken phrase verbatim is a legitimate graphic; metaphor only when the
script itself uses one.

**J3 — Scene-with-state.** A chapter is ONE visual arc, not a slideshow:
a set the viewer learns, elements that build, then park (shrink to an
edge), then get pointed back to. Every element still enters on its
spoken word and exits when the conversation leaves it (Pass 1's timing
law). Parking is how continuity and the media-legibility rule coexist:
parked elements are glanceable furniture, not competing content.

## Pipeline

### Phase A — Global ideation (one agent, full-video context)

1. Read script.md, layout.yaml, design-system.md, media-shots.md end to
   end.
2. Write `visuals/motifs.md`: every concept that appears in ≥2 chapters
   (pipeline diagram, mezzanine, script.md-the-file, tracker chip, …) →
   one canonical visual form + the shared component that renders it +
   where it appears. This registry is the ONLY cross-chapter context the
   build agents get.
3. Write `visuals/briefs/chNN.md` for every chapter:
   - **Scene** — the set, the arc, what accumulates/parks where (3–6
     sentences).
   - **Beats** — one line per layout shot: `shot-id — what appears/moves/
     parks, entering on "<verbatim words>"`. FULLFACE shots are listed as
     `(clean face)` so the agent knows silence is deliberate.
   - **Amendments** — layout.yaml changes made, with reasons (or "none").
   - **Media** — capture-dependent shots: expected file
     `public/media/<shot-id>.mp4` + how it will be framed (gives the
     recording a target).
4. **Self-review pass** (one, in the same context): motif compliance;
   novelty distribution (no signature trick repeated across chapters);
   J1 test per beat (any text-heavy beat must justify its ear-load);
   every entering-word exists verbatim in words.json for that shot's
   span. Fix inline. If layout.yaml was amended: run mg-layout's
   `pnpm layout <dir> lint` and `apply` — amendments must land lint-clean
   before Phase B0.

### Phase B0 — Shared kit + scaffold (one agent, then fan out)

1. Copy runtime templates (below) into `src/graphics/` if absent.
2. Build the shared components named in motifs.md; typecheck.
3. Pre-create every `src/graphics/chNN/index.tsx` (exporting a stub
   `ChNN` component and an empty `BUILT: string[]`), then write the real
   `src/graphics/registry.ts` importing every stub — `BUILT_SHOT_IDS`
   derives from the chapters' own `BUILT` exports. After this step NO
   shared file is ever touched again — that is the no-merge-conflict
   guarantee for chapter agents (and Phase C).

### Phase B — Parallel chapter builds (one subagent per chapter)

Context given to each agent (and nothing else): its brief, motifs.md,
design-system.md + tokens path, its chapter's slice of shots.ts and
words.json, the graphics lib API, and the quality-loop instructions.

Loop (max 2 critique rounds): implement the chapter component →
`tsc --noEmit` → render stills at each shot's anchor frames
(`npx remotion still main --frame=N out.png`) → READ the images →
critique against its own brief (enters on word? legible at glance?
tokens only — no raw colors? scene state correct? parked items where the
brief parked them?) → fix. Then write a short build report (what was
built, deviations from brief + why, flags).

Media shots: render the `MediaSlot` frame; the slot shows the capture
placeholder until `public/media/<shot-id>.mp4` exists (re-run pass when
captures land — no code change needed if the file matches the brief).

### Phase C — Assembly + report (main agent)

Full-project typecheck; one still per chapter; verify every chapter
registered and every non-media placeholder replaced. Report to the user:
per-chapter summary, amendments made, media slots waiting, flags. User
reviews in Studio.

### Notes mode

User gives notes in chat ("ch03 flow too crowded", "12:40 the stamp is
late"). Skill maps each note to its chapter/shot, patches the brief if
the intent changed, and dispatches targeted fixes (parallel when notes
span chapters). Same quality loop, scoped.

## Runtime contract (shipped as templates/visuals/)

- `src/graphics/registry.ts` — `CHAPTER_GRAPHICS: Record<chapterId,
  ComponentType>` + `BUILT_SHOT_IDS: Set<string>` (derived from each
  chapter folder's `BUILT` export, so agents never edit shared files).
- Main.tsx: each chapter `<Sequence>` mounts its registry component
  (replacing the empty Fragment). Chapter components render frame-synced
  graphics ABOVE FootageStage, inside the same content boxes.
- FootageStage: one-line change — skip `PlaceholderPanel` when
  `BUILT_SHOT_IDS.has(shot.id)`. Geometry/footage motion untouched.
- `src/graphics/lib.ts` — the helpers every agent uses instead of
  reinventing: `shotById(id)`, `shotBox(shot)` (content box via
  layouts/geometry), `useShotFrame(shot)` (local frame), `buildFrames
  (shot)` (word-anchor frames), `enterProgress(frame, anchorFrame)`
  (eased 15-frame enter, matching FootageStage's transition feel).
- `src/graphics/MediaSlot.tsx` — framed media area; renders
  `public/media/<shot-id>.mp4` when told it exists, else a styled
  "capture pending" card.

Chapter code layout: `src/graphics/chNN/index.tsx` (the chapter
component; may split into files inside its own folder freely). Styling:
tokens from `design/active/` only; design-system.md's bans are law.

## Layout amendments

Phase A may edit layout.yaml (shot boundaries, types, builds) where the
scene idea justifies it. Rules: every change listed in the brief with a
reason; `layout lint` must pass; `layout apply` regenerates shots.ts;
layout.yaml remains the single source of truth. Phase B agents may NOT
touch layout.yaml — a build-time conflict is a flag in the report, not a
self-serve edit.

## Packaging

- `skills/mg-visuals/SKILL.md` — judgment framework, pipeline, brief/
  motif formats, subagent prompt template, notes mode.
- `templates/visuals/` — registry.ts, lib.ts, MediaSlot.tsx.
- No CLI, no new deps. Components are per-video (same call as mg-design);
  a cross-video component library is parked until 2–3 videos exist.

## First run (this video)

Phase A on all 8 chapters (the registry needs the whole video anyway) →
Phase B0 → Phase B pilot on **ch01 only** to validate the loop → fan out
ch02–ch08 in parallel → Phase C. ch01-s01 is a media shot (4-video
montage): pilot validates the MediaSlot path too.

## Parked / future

Cross-video component library; probe scene added per new element type
(mg-design suggests it); audio-aware polish belongs to mg-polish;
automatic Studio screenshots of moving sequences (stills only for now).
