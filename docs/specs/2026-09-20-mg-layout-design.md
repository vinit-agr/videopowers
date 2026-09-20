# mg-layout — design

Approved 2026-09-20 after a three-round brainstorm. Pass 1 of the
motion-graphics pipeline: decide what the screen does when, as a reviewable
placeholder composition. The judgment procedure lives in SKILL.md (it IS the
skill); this spec fixes the artifacts and machinery.

## Decisions locked

1. **Doc is the source of truth.** `remotion/layout/layout.yaml` — Claude
   writes and edits it; the comp is generated from it; review happens in the
   comp; `layout.md` is a generated read-only table view.
2. **Real geometry placeholders.** Footage genuinely docks/shrinks/hides per
   layout; content areas show flat panels (shot id + PURPOSE + subjects).
   You review by feeling the rhythm, and mg-visuals later fills the same
   slots without restructuring.
3. **Placeholders state purpose, never design.**
4. **Media legibility rule (Vinit):** media never shares the screen with a
   25–35% face. Media = FullGraphics or Bubble; `[SPLIT media]` defaults to
   **18%** and >20% face with media is a lint **error**. Split-media only
   for glanceable content (watched, not read).
5. **Show: notes are hints, not rules** — written at scripting time; the
   procedure may override with a stated reason.
6. **Vocabulary** seeded from the private video-layout skill (unchanged
   upstream), with the media defaults updated per (4).

## The judgment procedure (summary — full text in SKILL.md)

- **L0 atoms are spans, not paragraphs** — a shot boundary is wherever the
  words' job changes, mid-sentence included.
- **L1 two tests per span:** radio test (what would a listener lose?) vs
  face test (is the point the human?). Both firing = Overlay on the face.
- **L2 made vs brought:** graphics = must be drawn; media = exists, can be
  captured. Consequences: layout (media rule), production (media shots emit
  a capture to-do list), register (media = evidence, graphics = explanation).
- **L3 weight = structure × duration** — 12-scenario catalogue in SKILL.md
  (number→Overlay stamp … mechanism→FullGraphics ≤40s … software→media
  rule … nothing→FullFace). Passing mention of a complex thing stays light.
- **L4 entrance on the naming word** (quiz-before-reveal: never answer
  before the speaker), builds land on their own naming words, **exit when
  the conversation leaves** — punchlines land on a clean face; enter
  exactly, exit gently (~0.5s grace).
- **L5 neighborhood repair**, cheapest fix first: in-shot build → overlay
  accent → real split → geometry flip. Rhythm fixes must never overwrite
  meaning.

## Artifacts

```
remotion/layout/layout.yaml     source of truth (hand/Claude-edited)
remotion/layout/layout.md       generated table view
remotion/layout/media-shots.md  generated capture to-do list (all media shots)
remotion/src/layout/shots.ts    generated, frame-resolved (apply)
```

### layout.yaml schema

```yaml
ch03-beat-2-rough-cut:
  - shot: s02                     # id becomes ch03-s02
    layout: "[SPLIT graphics]"    # vocabulary tag
    anchor: "a rough cut is"      # spoken words; resolved in words.json
    purpose: viewer sees the junk types struck out as named
    subjects: [mistakes, silences, fumbles, retakes]
    builds: ["silences", "retakes"]   # optional in-shot changes, each on its word
    note: free text                    # optional
```

- Shots are sequential per chapter; each runs to the next anchor (or
  chapter end). A chapter whose first shot starts late gets an implicit
  leading FULLFACE.
- Chapter-card shots are generated automatically inside each black gap —
  never written in the yaml.
- `purpose` required for every non-FULLFACE shot.

## CLI (`skills/mg-layout/scripts`)

- **`lint`** — errors: yaml/tag parse failures, unknown chapter, anchor not
  found in its chapter after the previous shot (forward-cursor word match
  against words.json), duplicate ids, missing purpose, media in Split >20%.
  Warnings: FullFace >20s and any shot >30s without builds, visual-event
  cadence gap >15s in the first 2 min / >25s later (events = shot starts +
  builds + chapter cards), adjacent same layout+geometry, FullGraphics
  graphics >40s.
- **`apply`** — lint (errors block) → write `shots.ts` (frame-resolved) +
  regenerate `layout.md` + `media-shots.md`. Deterministic; only generated
  files are written.

## Layout runtime (template addition, theme-free)

`src/layouts/` in the Remotion template: `geometry.ts` (per-tag footage rect
+ content boxes on the 3×3 grid, 1920×1080) and `FootageStage.tsx` (single
component owning the footage element: finds the active shot per frame,
interpolates geometry between shots ~0.5s eased — dock/undock, shrink/grow,
fades — and renders placeholder panels / chapter cards in the content
boxes). `Main.tsx` renders `<FootageStage>` instead of a bare
`OffthreadVideo`; with an empty `shots.ts` the behavior is identical to
mg-setup's output (fullscreen footage), so the template change is
backward-compatible. Grays + one accent only — look & feel stays open.

Existing projects (scaffolded before this template revision): apply copies
the new `src/layouts/` files in if absent; `Main.tsx` is replaced only when
byte-identical to the previous template's version, otherwise the skill
prints the manual patch.

## Workflow (SKILL.md)

Draft the whole video chapter-by-chapter (script + Show hints + words.json)
→ self-audit L5 → `lint` → fix → `apply` → user scrubs in Studio → notes →
edit yaml only → re-apply. Media capture list goes to the user before
mg-visuals.

## Testing

Vitest: tag parser (defaults + overrides + media rule), anchor resolution
(forward cursor, chapter bounds, not-found), every lint rule both ways,
geometry sanity (rects inside frame, split percentages). Live test: the
Remotion-with-CC video, all 8 chapters.

## Out of scope

Real graphics (mg-visuals), theme/design system, SFX, media capturing
itself (the skill only emits the to-do list).
