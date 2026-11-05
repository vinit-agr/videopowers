# natural-footage-rough-cut — design

Brainstormed 2026-11-01 with Vinit in a Claude Code session (feynman repo,
project `BH-5-clone-of-everyday-they-wait-for-clinician-using-natural-script`).
Status: **draft, awaiting Vinit's approval.**

**Scope of a run:** one run over a **complete shoot**. Vinit records the whole
video in one session and only then runs the skill. No incremental re-runs as
new parts arrive, so `edit.json` is written fresh for the shoot and stable
IDs across added parts aren't needed. (A shoot that covers only some
sections, like the test footage, is still handled; see §5.7.)

A new skill, separate from `footage-rough-cut`, that turns a multi-part
talking-head shoot recorded the *natural* way (improvised from prompt cards,
not read from a script) into a finished rough cut: an MP4 to watch and a
DaVinci Resolve timeline to trim.

---

## 1. Why

Until BH-5, Vinit read `script.md` one sentence per take. The rough cut
sounded stiff and read-aloud (250 wpm, a cut every 2.7 s). The new method:

- He reads each section's full text aloud twice *off camera* as a primer.
- On camera he works from `natural_script.md`: short bullet prompts he says
  **in his own words**, plus a few **🔒 fixed lines** (numbers, sources,
  quotes, intro/close) he says nearly word for word.
- One take is one **card** (a whole thought, a few sentences to ~1 min).
  Target pace 150–180 wpm with real pauses.

`footage-rough-cut` decides everything by matching spoken words to
`script.md` sentences. On natural footage that fails: on the BH-5 clone test
shoot (4 parts, 13:44 raw) it matched **14 of 276** script sentences, kept 97
phrases as "ad-libs", and produced a 5:48 cut that still contains, e.g.:

- "So those first three days are…" **6 times** (3 at the end of part1, 3 at
  the start of part2);
- "I will also talk about four real case studies…" 3 times;
- both full runs of Card 1a (the first one, abandoned at "seven out of 10",
  and the restart);
- Section 2's opening twice (part3's attempt and part4's full redo);
- a 2 s black gap at every **part-file** boundary instead of every section;
- "We can set the appointment on Friday" without its lead-in ("Now, finally
  the center says…").

That output is kept for comparison at
`feynman/projects/BH-5-clone-…/old-rough-cut/`.

## 2. What the natural footage looks like (measured on the test shoot)

- **Sections and files don't line up.** part3 ends Card 1b then starts
  Section 2 after a 19 s gap; part4 re-records all of Section 2. Attempts at
  one thought can sit in different files.
- **He never says "again".** The retake signal is a pause (1–13 s) followed
  by a restart that **opens with the same words**, with the rest often
  reworded ("And if you're thinking…" started 6 times in a row).
- **Abandoned attempts are visible in the transcript.** Scribe ends them
  with `…`, `--`, or a cut-off word (`qu-`).
- **Sometimes the whole card restarts from the top** (Card 1a, at 1:20).
- **🔒 lines get skipped or drift.** "Not a week later. Just 3 days." was
  never said; "nearly half" became "pretty much half" in some attempts.
- **Pauses** (all 4 parts): between sentences median 0.52 s, p75 1.04 s,
  p90 2.8 s; mid-sentence median 0.06 s, p95 0.60 s. Gaps > 1 s are almost
  all card glances, restarts or dead air.

## 3. Goals, non-goals, anti-goals

**Goal:** a cut Vinit can **watch once and, if it's right, do nothing**
beyond importing it to Resolve for small trims. The skill acts like a
world-class editor who knows what the video is meant to say.

**Non-goals**
- Changing `footage-rough-cut`. It stays exactly as it is. (A later merge
  into one skill that detects the recording style is possible, not now.)
- Any new recording habit (saying "again", clapping). Explicitly rejected
  for now; it is the fallback only if restart detection proves unreliable on
  real recordings.
- A headless/API mode (see Approaches, B). Can be added later on the same
  decisions file.
- Single-file mode. Project mode only.

**Anti-goals** (failure even if it technically runs)
- **Losing content.** Dropping the only good attempt at a point is worse
  than leaving a stray retake in. When unsure, keep and flag.
- **Inventing or reordering meaning.** The cut only removes; it never builds
  a sentence the speaker didn't say in one fluent run, except for stitching
  one attempt that was said in pieces (§5.2).
- **Sounding stitched.** Choppy joins or stripped natural pauses defeat the
  point of the new method.

## 4. Approaches (decided: A)

The frame is the same in every option: code prepares the material
(transcribe, find pauses, flag cut-off words and same-opening restarts,
locate 🔒 lines), and code builds the outputs afterwards (validate, size
pauses, XML, MP4, markers, reel), reusing `footage-rough-cut`'s tools.
What differs is **who makes the keep/cut decisions**, which needs
understanding of meaning.

- **A. Claude Code is the editor (chosen).** `prepare` writes a readable
  transcript; the Claude session running the skill reads it alongside
  `natural_script.md` and writes its decisions to `edit.json`; `build`
  validates it and produces everything. No extra API key or cost; Vinit can
  ask "why did you cut that?" in the same chat and get a section redone; the
  saved `edit.json` makes rebuilds deterministic. Needs a Claude Code
  session (no unattended runs); two fresh runs may differ slightly.
- **B. The CLI calls the Claude API itself.** One command end to end, could
  run unattended, but needs an API key, is billed per run, hides the editing
  prompt inside code, and can't be discussed mid-run. Not now; B can later
  produce the same `edit.json`.
- **Dropped: rules only, no AI** (pause + same-opening + text similarity).
  Cheap and predictable, but misses reworded retakes and local repeats,
  which is the core requirement.

Chosen because it matches how Vinit runs every skill (inside Claude Code)
and keeps the editing judgment conversational.

## 5. Behaviour (decided in the brainstorm)

### 5.1 What is understood, and from where

- **Primary:** `natural_script.md`: sections (`## N. Title`), the section's
  `**The point:**` line, cards (`### Card Nx: title`), bullets (free lines),
  `> 🔒` lines (fixed; strip markdown links and bold; links are sources, not
  speech). **Ignore** the `<details>` Primer block (not what he says on
  camera; at most a loose guide to meaning) and italic `*(…)*` notes.
- **Context:** `script.md` and `outline.md` if present, for what the video is
  meant to communicate.
- Sections = chapters. The cut follows `natural_script.md`'s section and
  card order.

### 5.2 Which attempt is kept

- **Keep the last attempt that is complete and fluent.** Search backwards
  from the end for each thought.
- **One exception:** if that last attempt gets a 🔒 fact wrong (number,
  name, source, quote) and an earlier complete attempt gets it right, use
  the earlier one, and record it as a judgment call.
- **An attempt can span pauses.** A thought said in pieces with silence
  between them is one attempt; its pieces are joined, not treated as
  retakes of each other.
- **Attempts are compared across part files**, not per file.

### 5.3 What is cut

- Every attempt at a thought except the kept one; fumbles, half sentences,
  abandoned starts (`…`, `--`, cut-off words).
- **Fillers and stutters: cut only where the cut hides naturally**, i.e. at
  the start of a sentence or beside a pause (the old skill's "safe" edge
  rule). **Single fillers or stutters inside a fluent sentence stay**: each
  cut there is a visible jump on camera. If an attempt is full of them, that
  counts against its fluency and a cleaner attempt at the same thought is
  chosen instead (still subject to §5.2). *(Decided by Vinit: options b + c.)*
- **A point repeated straight away** (the immediately preceding sentence or
  so), even inside a fluent run. E.g. "So that might just sound fine, right?
  Because they're just three days away." followed by "So that sounds fine,
  right? It's just three days away" keeps one.
- **Kept:** a point the speaker comes back to later in the video (a callback,
  not a repeat), and anything said **beyond the card** when it is part of a
  fluent sentence. The card is an outline, not a limit; over-long additions
  are trimmed by hand in Resolve.

### 5.4 Pauses

Natural pauses stay; only long dead air is shortened. Air always comes from
the real footage (extend the clip edge into real room tone; never stretched
or synthetic). Defaults, tunable as presets like the old skill's:

| Where | Rule |
|---|---|
| Between sentences, ≤ 1.0 s recorded | Left exactly as recorded |
| Between sentences, > 1.0 s | Shortened to ~0.7 s |
| Mid-sentence, > 0.6 s | Shortened to ~0.3 s |
| Join where removed material sat between two kept pieces | ~0.5 s (his median sentence pause); a join *inside* one sentence (stitched attempt) ~0.3 s max |
| Between `## N.` sections | 2.0 s black gap (must stay ≥ 1.5 s: `mg-setup` reads these as chapter markers) |

No black gap at part-file boundaries.

### 5.5 Outputs

In the output folder (default `<project>/rough-cut/`, overridable with
`--out-dir`; the BH-5 clone test uses `new-rough-cut/`):

- `rough-cut.mp4` (+ `.words.json`, `.srt`, `.vtt`): baked preview, real
  black section gaps, sync-verified (old skill's gate). **Not
  loudness-normalized by default** (opt in with a flag): on BH-3 the -14 LUFS
  loudnorm pushed a -25.8 LUFS mic up 11.6 dB into dynamic compression and
  Vinit heard it as too loud, boomy and unclear; every BH render since used
  `--no-normalize`. Same for the review reel. *(Claude's call.)*
- `rough-cut.xml`: FCP XML, every kept piece a trimmable clip with handles,
  **plus a timeline marker at each judgment call**.
- `rough-cut.plan.json`: same shape as the old skill's, so downstream
  readers (speaking scorecard, mg pipeline) keep working.
- `rough-cut.review.mp4`: **the review reel**, judgment calls only (§5.6).
- `rough-cut.report.md`: also printed to the terminal (§5.7).
- `edit.json`: the editor's decisions (§6), the source of truth for a
  rebuild.
- `transcript.md`: the prepared transcript the editor read.

Same file names as the old skill on purpose.

### 5.6 Judgment calls: markers + review reel

A **judgment call** is any decision the editor was unsure of, at minimum:
an earlier attempt used instead of the last; a repeat it wasn't sure was a
repeat; unsure where one attempt ends and the next begins; unsure which
card a stretch belongs to.

- **Marker** on the Resolve timeline at the call's position in the cut,
  numbered, with a note that names the review file, e.g.:
  *"Judgment call 3: used the earlier attempt; the last one said 'half', the
  🔒 says 'nearly half'. Alternatives in new-rough-cut/rough-cut.review.mp4
  (Call 3)."*
- **Review reel**: one MP4 for all calls. Per call: a title card ("Call 3 of
  5 · 02:14 in the cut · used earlier attempt"), the kept version, then each
  alternative with a short label card.
- **Not** added to Resolve's media pool (Vinit: it would be confusing).
  The reel stays in the folder.
- **Every time the cut is placed on the Resolve timeline (or the XML is
  written), the skill's closing chat message reminds Vinit** that the review
  file exists, where it is, and that the markers point into it. Mandatory,
  every run, in SKILL.md.
- Ordinary removed attempts (not judgment calls) are *not* in the reel;
  they're listed in the report.

### 5.7 Report (`rough-cut.report.md` + terminal), most important first

1. **Missing:** cards, bullets that seem uncovered, and 🔒 lines never said,
   **within sections that have footage**. A missing line can't be fixed in
   the edit; the cut goes on without it. Sections with no footage at all are
   listed on one line as "not recorded" (a partial shoot is normal, e.g. the
   test shoot covers sections 1–2 of 12), and black gaps go only between
   recorded sections. *(Builder-check answer; Claude's call.)*
2. **🔒 check:** each fixed line, what was actually said, and whether the
   facts match (exact / facts OK, wording differs / wrong / missing).
3. **Judgment calls:** numbered to match markers and reel, with the reason
   and the time in the cut.
4. **Every removed attempt next to the kept one**, with part file and
   timestamp (folded, for when something sounds wrong).
5. Stats: raw → cut duration, wpm of the cut, number of joins and air
   statistics.

## 6. Shape of the skill

Three steps, run by the Claude session following SKILL.md:

1. **`prepare <project-dir>`** (CLI, deterministic). Per part: probe,
   transcribe (ElevenLabs Scribe, cached by content hash), silence detect,
   clamp word ends. Parse `natural_script.md`. Write `transcript.md`, all
   parts in recording order with **stable word or phrase IDs** (e.g.
   `p2@24.18`), pause lengths before each phrase, and hints: cut-off endings,
   same-opening restart candidates, fuzzy matches of each 🔒 line (the old
   aligner's approximate-substring matcher, run against 🔒 lines only), and
   filler flags. Also writes a machine-readable `prepare.json`.
2. **Edit** (the Claude session). Reads `transcript.md`, `natural_script.md`
   (+ `script.md`/`outline.md`), applies §5.2–5.3, writes `edit.json`. At
   minimum it contains: per section, the kept spans in output order
   (word-level start/end IDs, so a phrase can be trimmed inside, such as
   removing a stutter or keeping "Now, finally the center says" attached),
   the card each span belongs to, the judgment calls (kept span,
   alternative spans, reason), the 🔒 check results, and the removed
   attempts with what superseded them.
3. **`build <project-dir> [--to xml,mp4,resolve]`** (CLI, deterministic).
   Validates `edit.json` against `prepare.json`: IDs exist, no kept span
   overlaps another, every 🔒 line accounted for (said or reported missing),
   every section non-empty or warned. Sizes pauses (§5.4), assembles the
   CutPlan with black gaps between sections only, and writes all outputs in
   §5.5. A `--dry-run` prints the report without rendering. Bridge mode
   appends to Resolve as the old skill does, and adds the markers via the
   scripting API.

Re-running `build` with an edited `edit.json` gives the same cut, so "swap
call 3" or "put back that line" is: Claude edits `edit.json`, re-runs
`build`.

**Reuse:** start the new skill as a copy of `footage-rough-cut` (Vinit's
suggestion) and remove the script-alignment path. Keep transcription and
ffmpeg from `scripts/shared/`, and silence detection, fillers, XML, render,
the sync gate, subtitles and `resolve-append.py` from the old skill.
`extract-part.sh` is useful as-is (works on `partN.screenstudio`; the BH-5
test bundles were named `new_partN` and were symlinked for extraction).

**Location:** `feynman/.claude/skills/natural-footage-rough-cut/` (project-local while it is tested; videopowers untouched until Vinit decides).
Inputs: `<project>/natural_script.md` (required) and
`<project>/assets/camera/partN.mp4` (CFR, same fps).

## 7. Acceptance (on the BH-5 clone test shoot)

Run on `feynman/projects/BH-5-clone-…/` into `new-rough-cut/` and compare
with `old-rough-cut/`:

- "So those first three days…" appears once, and the kept attempt says
  "nearly half" (the exception rule, recorded as a judgment call) or is the
  last complete attempt and the 🔒 check flags its wording.
- "Four real case studies" once; Card 1a once (the second run); Section 2's
  opening once (from part4).
- "Not a week later. Just 3 days." listed as missing in the report.
- Black gaps exactly at section boundaries (Section 1 → 2), none at part
  boundaries.
- "Now, finally the center says, 'We can set the appointment on Friday'"
  kept whole.
- Vinit watches it and judges it close to final.

## 8. Claude's calls (for Vinit to check)

Made by Claude, not discussed in the brainstorm:
- Sections follow `natural_script.md` order in the cut, whatever order they
  were recorded in.
- The cut never stitches sentences from different attempts, only pieces of
  one attempt said across pauses.
- The pause numbers in §5.4 (from measuring the test shoot).
- Default output folder `rough-cut/`; the test uses `--out-dir new-rough-cut`.
- No loudness normalization by default (§5.5).
- Unrecorded sections listed on one line, not as missing (§5.7).
- Working name `natural-footage-rough-cut`.

## 9. Left to the builder

- Phrase-splitting threshold and the exact restart-detection heuristics in
  `prepare`, and how hints are shown in `transcript.md`.
- Exact `edit.json` schema and ID format (within §6's minimum).
- How the editing instructions are split between SKILL.md and a reference
  file; whether the edit pass works section by section.
- Review-reel styling (title card look, durations) and marker colours.
- Preset names and values around §5.4's defaults.
- Whether the copied modules are imported from the old skill or duplicated
  (duplicating keeps the old skill untouchable; Vinit preferred a copy).
- Plugin version bump and README entry, per the videopowers dev loop.
