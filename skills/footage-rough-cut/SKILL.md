---
name: footage-rough-cut
description: Use to turn a multi-part talking-head shoot plus its script.md into a rough cut close to the final edit — retakes removed against the script (keep-last), joins paced by the script's structure, chapters separated by black gaps — delivered as an editable DaVinci Resolve timeline, a watchable MP4, or both. Also cleans a single video file without any script (silences, fillers, verbatim retakes).
---

# Footage Rough Cut

Turns raw camera footage into a rough cut that is close to the final edit,
so the human's manual pass is minutes of trimming instead of days of
assembly. Two modes, one CLI:

- **Project mode** (input is a directory): script-aware. Retakes are decided
  against the script, air at every join is sized by the script's structure,
  and the cut lands as trimmable clips on a DaVinci Resolve timeline.
- **Single-file mode** (input is a media file): script-free cleanup of one
  recording — silences collapsed, filler words dropped, near-verbatim
  repeated takes keep-last — baked to `<name>.clean.mp4`.

What the script buys you (why project mode cuts better): with a script,
retakes collapse **by intent** (two paraphrased attempts at the same script
sentence merge; similar-sounding takes of *different* sentences never do),
and pauses are sized **by meaning** (recorded pause lengths are reading
noise — the script's sentence/paragraph/beat structure decides the air).
Without a script, only near-verbatim repeats can be caught, and every
silence is collapsed uniformly by `--pacing`.

## Prerequisites

- `ffmpeg` + `ffprobe` on PATH (`brew install ffmpeg`).
- `ELEVENLABS_API_KEY` — env var, or a `.env` in the project dir / any
  parent / this skill's folder. Found automatically.
- One-time in this folder: `pnpm install --ignore-workspace`.
- Bridge mode only (`--to resolve`): one-time `scripts/setup-bridge.sh`
  (clones davinci-resolve-mcp into `vendor/`; `RESOLVE_BRIDGE_VENDOR`
  overrides). Not needed for XML import.

## Project layout it expects

```
<project-dir>/
  script.md                    ## headings with **Say:** blocks = beats
  assets/camera/part1.mp4      recordings in numeric order (CFR, same fps)
  assets/camera/part2.mp4      (multiple parts per beat is fine — crashes,
  ...                           re-starts and overlaps are handled)
```

`script.md` conventions (shared across the videopowers pipeline): a beat is
any `## ` section containing at least one `**Say:**` block; only Say text is
"spoken"; blank lines inside Say blocks separate paragraphs = concepts;
normal sentence punctuation separates sentences. `**Show:**` lines and
sections without Say blocks are ignored.

## Run

```bash
cd <plugin>/skills/footage-rough-cut
pnpm rough:cut "/path/to/project-dir" --dry-run     # always look first
pnpm rough:cut "/path/to/project-dir"               # → rough-cut/rough-cut.xml
pnpm rough:cut "/path/to/project-dir" --to xml,mp4  # + baked preview
pnpm rough:cut "/path/to/project-dir" --to resolve  # live bridge append
```

Outputs land in `<project-dir>/rough-cut/`:
- `rough-cut.xml` — FCP XML timeline. In Resolve: **File → Import Timeline**.
  Every kept segment is a separate clip with full trim handles into the part
  files; beat gaps are empty (black) timeline space. No bridge needed.
- `rough-cut.plan.json` — the full cut plan (seconds + frames + record
  positions); input for bridge mode and for word-anchoring graphics later.
- `rough-cut.mp4` (+ `.words.json` / `.srt` / `.vtt`) with `--to mp4` —
  baked preview with real black beat gaps, loudness-normalized, sync-verified.

`--to resolve` needs DaVinci Resolve OPEN with the in-app bridge running —
the script prints exactly what to click (Workspace → Scripts →
resolve_bridge) and waits up to 5 minutes for you, then appends in verified,
saved chunks. Don't click around in Resolve while it writes.

## How the cut is decided (project mode)

1. Each part is transcribed (ElevenLabs Scribe, cached by content hash),
   silence-clamped, filler-cleaned, and split into phrases.
2. Phrases are fuzzily aligned to the script's sentences, in order
   (word-level approximate-substring matching, forward-walking cursor with
   backward reach for retakes/restarts).
3. **Retakes are decided against the script, keep-last**: two takes of the
   same script sentence collapse even when paraphrased; similar-sounding
   takes of *different* script sentences never collapse. Off-script phrases
   are kept as ad-libs (unless they trail an abandoned take). Script
   evidence alone never deletes — a drop also needs locality, high
   similarity, and its content covered by the surviving takes (stray retakes
   are cheap; lost content is expensive).
4. Joins get air by boundary type, cut from the speaker's real footage
   (never stretched, never synthetic — reading pauses shrink to the budget):

   | Boundary | Source of truth | medium (default) |
   |---|---|---|
   | intra-sentence | fragments of one script sentence | tight join |
   | sentence | script punctuation, same paragraph | 0.15s |
   | concept | new paragraph in script | 0.35s |
   | beat | new `## ` beat (or new part = new beat) | 2.0s black gap |

   The medium defaults were calibrated against a creator's real manual edit
   (measured air at 151 hand-cut joins) and approved by ear. Presets:
   `--pause-preset tight|medium|loose`; override any knob with
   `--sentence-pause / --concept-pause / --beat-gap` (seconds). When the
   real recorded gap is already within budget, the footage is left uncut.
5. A part boundary inside a beat (recorder crash / manual split) is joined
   with concept-level air, with keep-last applied across the overlap.

Note the two similarly-named knobs: `--pause-preset` (project mode: the
sentence/concept/beat budgets above) and `--pacing` (single-file mode: one
uniform silence-collapse setting). Same preset names, different machinery.

## The pipeline contract (videopowers)

The **~2s black beat gap** is the interchange format of this pipeline:
footage-rough-cut writes it between beats, the human's manual final cut
keeps it (adding/moving chapters by adding/moving gaps), and `mg-setup`
detects "black ≥ 1.5s" as the chapter markers that name every chapter from
script.md and position the title cards. Keep the gaps ≥ 1.5s and the whole
downstream motion-graphics pipeline stays automatic.

## Reading the report / dry-run

Always run `--dry-run` first. It prints: per-part ingest, retakes dropped
(each dropped take shown next to its surviving take — audit this list),
script coverage (sentences never spoken = you changed the script on camera
or the take is missing), **low-confidence matches** (eyeball these — heavy
paraphrase or transcription noise), overlap warnings (two kept takes touch
one sentence — trim by hand in Resolve), join/air statistics, and the full
segment list.

## Single-file mode

`pnpm rough:cut <file.mp4> [flags]` — a FILE input runs the script-free
pipeline: silence collapse (`--pacing tight|medium|loose`), edge filler
removal (`--filler-mode safe|aggressive`), near-verbatim keep-last retakes,
loudness normalization, `.clean.mp4` + `.srt`/`.vtt`/words sidecars. No
script structure means no sentence/concept/beat budgets and no beat gaps.

## Extraction from Screen Studio bundles (optional helper)

```bash
scripts/extract-part.sh <project-dir> <N> [--delete-bundle]
```
Screen Studio–specific: exports camera+mic from
`<project-dir>/partN.screenstudio` to `assets/camera/partN.mp4` (CFR 30, A/V
aligned, enhanced-mic fallback, channel numbers auto-detected), verifies
duration/framerate/tracks, and only deletes the bundle if you ask. Recording
from anything else? Just drop CFR mp4s into `assets/camera/` yourself.

## Recording discipline that makes it work

When you flub a line while recording: don't react, don't sigh — go silent,
then say the line again. The silence is the retake marker; keep-last does
the rest. Mistakes while recording cost nothing.

## Scripts map (scripts/)

`cli.ts` routes file vs project input. Project mode: `project.ts` →
`script.ts` (parse script.md) → `transcribe/silence/phrases/fillers` (per
part) → `align.ts` (script matching + keep-last) → `cut.ts` (boundaries +
pause budgets) → `xml.ts` / `render.ts renderPlan` (mp4 + black gaps) /
`resolve-append.py` (bridge). Pure logic is vitest-covered (`pnpm test`);
`scripts/__smoke__/render-sync.smoke.ts` covers the render+verify path.
Transcription, ffmpeg, and script parsing come from the plugin's shared lib
(`scripts/shared/` at the repo root).

## Sync safety (mp4 outputs)

Frame-snapped cuts, PCM intermediates in .mov, CFR video, exactly one final
AAC encode, and a verification gate (phantom-audio / VFR / A-V length /
plan-duration) that fails the render rather than shipping a drifting file.
