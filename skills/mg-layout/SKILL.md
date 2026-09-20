---
name: mg-layout
description: Use to decide the layout timeline of a talking-head video and place reviewable placeholder graphics in its Remotion composition — Pass 1 of the motion-graphics pipeline, after mg-setup, before mg-visuals. Reads script.md + the beat sheet + word timestamps, writes layout/layout.yaml (source of truth), and applies it as real layout geometry with purpose-stating placeholder panels.
---

# mg-layout

The judgment stage: what the screen does, when, and why. The output is a
`layout.yaml` the human never has to read to review — `layout apply` turns
it into real layout geometry in the composition, and review is scrubbing
the video. Design spec: `docs/specs/2026-09-20-mg-layout-design.md`.

## The vocabulary (five layouts + chapter cards)

| Layout | Definition | Face area |
|---|---|---|
| `[FULLFACE]` | face full screen, nothing else | 100% |
| `[OVERLAY]` | face full screen; cards land in grid cells (default 4 and 6) | full (shared) |
| `[SPLIT]` | face docked in a rounded **9:16 portrait card** on one side (full-height center-crop of the footage — the face fills the card, never a shrunken 16:9 frame); content fills the rest | graphics: 35% (caps ~29% at full height) · media: **18%** |
| `[BUBBLE]` | face in a small circle (default cell 9) over near-full content | ~10% |
| `[FULLGRAPHICS]` | content owns the screen; face hidden | 0% |

3×3 grid cells 1–9, top-left across then down; the face's center column
(5, 8) stays clear. Modifiers: `[OVERLAY 6]`, `[SPLIT graphics right 30%]`,
`[SPLIT media 18%]`, `[BUBBLE 7 rect]`, `[FULLGRAPHICS media]`.

**Media legibility rule (hard):** media never shares the screen with a
25–35% face. Media goes FullGraphics (viewer reads/experiences it) or
Bubble (you stay present in a corner); `[SPLIT media]` only at ≤18–20%, and
only for *glanceable* media — something watched, not read. The linter
errors above 20%.

Chapter cards are not written in the yaml — every black gap automatically
becomes a card introducing the next chapter.

## The judgment procedure (five levels)

Run this over the script chapter by chapter, with words.json open — judge
what was actually said, not what the script hoped. `**Show:**` notes are
hints from scripting time: take them seriously, override them freely with a
stated reason.

### Level 0 — atoms are spans, not paragraphs

Start from paragraphs (concept units), but a shot boundary belongs wherever
the words' *job* changes — mid-paragraph, mid-sentence. A story that turns
into a mechanism halfway through is two shots.

### Level 1 — two tests, on every span

- **Radio test:** if this were audio-only, what would the listener lose?
  Numbers, lists, comparisons, mechanisms, anything spatial or on a screen
  → the screen owes support.
- **Face test:** is the *point* of this moment the human — story,
  confession, promise, punchline, hedge? → the face is the content.

Both firing is not a conflict — it's an **Overlay**: the face keeps the
room, a card lands on the key word. ("I have to be honest… roughly 70% of
the time" = FullFace + a "~70%" stamp, never a graphic that steals the
confession.)

### Level 2 — made vs brought

One question: **can you point a camera or screen-recorder at it?** Yes →
media (exists: UIs, timelines, repos, tweets). No → graphics (must be
drawn: pipelines, rules, metaphors). Why it matters: layout (media rule
above), production (every media shot lands on the generated
`media-shots.md` capture list — media does not exist until someone records
it), and register (media is *evidence* — use for proving; graphics are
*explanation* — use for teaching). Hybrid allowed: an artifact that exists
but is re-made as a designed graphic ("printed screenshot") — counts as
graphics for production, keep the evidence-feel.

### Level 3 — weight = structure × duration

How big is the thing the viewer must hold, and for how long?

| The viewer must hold… | Signal | Layout |
|---|---|---|
| one number / statistic | "seventy percent" | Overlay stamp on the number's word |
| a new term being coined | "this is called…" | Overlay title card on the term |
| someone else's words | "people keep asking…" | Overlay quote card |
| a list that accumulates | "first… second… third…" | Split graphics, items build per naming word |
| a comparison / versus | "X… but Y…" | Split two-column; FullGraphics if both sides complex |
| a process / pipeline | "then… then…" | Split if narrated; FullGraphics if the motion is the point |
| a mechanism / metaphor | "think of a…" | FullGraphics, cap ~40s |
| a before/after contrast | "raw… versus…" | FullGraphics (contrast needs the frame) |
| real software working | "it lays every clip…" | media rule: FullGraphics / Bubble / Split ≤18% |
| proof / receipts | "here's the actual…" | media — flash: Overlay clipping; sustained: FullGraphics |
| where-we-are in a journey | "step one…" | Overlay tracker, **same cell every time** (ritual) |
| nothing — the point is you | stories, hedges, CTAs | FullFace |

Duration modifier, both directions: a **passing mention of a complex thing
stays light** (an Overlay nod, not a world); a simple list referred back to
for 40s earns a persistent Split, not re-flashing Overlays.

### Level 4 — entrance and exit are word-level

Every graphic answers a question that just formed in the viewer's head.

- **Enter on the naming word** — the noun/number that creates the question,
  usually the word that was vocally emphasized. The transition *starts* on
  that word's frame (the word visibly causes the motion).
- **Quiz-before-reveal:** in a setup→payoff sentence, enter on the payoff
  word. The screen must never answer faster than the speaker.
- **Builds recurse:** each list item appears on its own naming word — and
  every landing is a free rhythm beat.
- **Exit when the conversation leaves** — pronouns return to me/you, a new
  topic-noun arrives, or a punchline is coming. **Punchlines land on a
  clean face** (exit the graphic before the landing line).
- **Enter exactly, exit gently:** entrances snap to the word; exits get
  ~0.5s grace past the last reference.

### Level 5 — neighborhood repair (locally right can be globally wrong)

Three correct FullFace decisions in a row = 45s of talking head = viewers
leave. After drafting, walk the timeline checking only neighbors and
stretches: something visual changes every ≤15s in the first two minutes and
≤25s after; FullFace caps ~20s; no adjacent shots with identical geometry;
the first 60–90s runs at double density. Fix violations **cheapest first**
— rhythm fixes must never overwrite meaning:

1. **In-shot build** — something inside the current shot lands on a word
   (list item, underline, stamp). Screen changed, layout didn't.
2. **Overlay accent** — a small card on the face mid-stretch.
3. **Real split** — find a secondary naming word, genuinely switch.
4. **Geometry flip** — alternate dock side/cells so repetition reads as
   intent.

## layout.yaml

```yaml
ch03-beat-2-rough-cut:            # chapter id from beat-sheet.json
  - shot: s01                     # id becomes ch03-s01
    layout: "[SPLIT graphics]"
    anchor: "a rough cut is"      # exact spoken words (verbatim from words.json)
    purpose: viewer sees the junk types struck out as they're named
    subjects: [mistakes, silences, fumbles, retakes]
    builds: ["silences", "retakes"]   # optional; each lands on its word
    note: Show wanted a terminal here; definition reads better as graphics
```

- Shots are sequential; each runs to the next shot's anchor (or chapter
  end). `anchor: start` pins a chapter's first shot to the chapter start; a
  late first anchor auto-generates a leading FULLFACE.
- `purpose` is required on every non-FULLFACE shot — it is the placeholder's
  on-screen text and mg-visuals' brief. State what the viewer should
  understand, never the visual design.
- Anchors must be verbatim spoken words. On "anchor not found," the error
  prints the transcript at the cursor — fix the anchor, don't fight it.

## Run

```bash
cd <plugin>/skills/mg-layout            # once: pnpm install --ignore-workspace
pnpm layout <project>/remotion lint     # resolve + rhythm report, no writes
pnpm layout <project>/remotion apply    # → src/layout/shots.ts, layout/layout.md,
                                        #   layout/media-shots.md
```

Apply only writes generated files. The composition renders the result live
(FootageStage in the project template) — real dock/shrink/hide moves with
placeholder panels stating each shot's purpose.

## Workflow

1. Draft `layout.yaml` for the whole video, chapter by chapter (procedure
   above), self-audit Level 5, then `lint` and fix until clean.
2. `apply`, have the user scrub the comp in Studio. Their notes are edits
   to the yaml — never to generated files — then re-apply.
3. Hand the user `layout/media-shots.md`: everything to capture before
   mg-visuals starts.

## Warnings are advice, not law

The linter's warnings encode the retention rules; a warning the human has
seen and accepted (a long FullFace that earns it emotionally) is a
decision, not a defect. Errors are law.
