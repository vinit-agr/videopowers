---
name: natural-footage-rough-cut
description: Use to turn a multi-part talking-head shoot recorded the natural way (improvised from natural_script.md prompt cards, not read word for word from script.md) into a finished rough cut — retakes found by meaning, the last complete and fluent attempt kept, local repeats and fumbles removed, natural pauses kept with only dead air shortened, 2s black gaps between sections — delivered as an MP4, a DaVinci Resolve timeline with judgment-call markers, a review reel and a report. Claude Code is the editor.
---

# Natural Footage Rough Cut

For footage recorded from `natural_script.md` (sections → cards → free
bullets + 🔒 fixed lines). The words on camera don't match any script, so
**you (Claude) are the editor**: code prepares and builds, you decide what
stays. Design: `docs/specs/2026-11-01-natural-footage-rough-cut-design.md` (repo root).

For footage read word for word from `script.md`, use `videopowers:footage-rough-cut` instead.

## Prerequisites

- `ffmpeg`/`ffprobe` on PATH; Python 3 with PIL (review-reel title cards).
- `ELEVENLABS_API_KEY` in env or a `.env` in the project dir / a parent / this
  skill dir (found automatically). Otherwise `set -a; . path/to/.env; set +a`
  before `prepare`.
- One-time: `pnpm install --ignore-workspace` in this folder.
- Project: `<project>/natural_script.md` (sections `## N.`, cards `### Card Nx`,
  free bullets, `> 🔒` fixed lines; optional `script.md` / `outline.md` for meaning).
- Footage: `<project>/assets/camera/part1.mp4 …` (CFR, same fps). From Screen
  Studio bundles: `scripts/extract-part.sh <project> <N>` (expects
  `partN.screenstudio`; symlink other names to that).

## Run (three steps)

```bash
cd <plugin>/skills/natural-footage-rough-cut
pnpm prepare:cut "<project>" [--out-dir "<project>/rough-cut"]      # 1. transcript.md + prepare.json
#                                                                    2. YOU write <out-dir>/edit.json
pnpm build:cut "<project>" [--out-dir …] --dry-run                   # 3a. validate + print report + cut text
pnpm build:cut "<project>" [--out-dir …] --to xml,mp4                # 3b. outputs (add ,resolve for the live bridge)
```

**Step 2 is the editing.** Read `references/editing-rules.md` in full every
time, then read `<out-dir>/transcript.md` and the project's
`natural_script.md` (plus `script.md` / `outline.md` for what the video means
to say). Work section by section and write `edit.json` (schema in the rules
file). Then run `--dry-run` and **read the printed cut text end to end**,
as a viewer would hear it. Fix `edit.json` until it reads clean: no repeated
thought, no half sentence, no lost lead-in, every recorded card present.
Only then build.

Flags: `--quality native|1080p|720p|480p` (MP4 downscale; low disk → 480p),
`--normalize` (loudness normalize; off by default — it made BH-3 sound
boomy).

## Outputs (in the out dir, default `<project>/rough-cut/`)

- `rough-cut.mp4` + `.words.json` / `.srt` / `.vtt` — watchable cut, sync-verified.
- `rough-cut.xml` — Resolve: File → Import Timeline. Every kept piece is a
  trimmable clip; yellow markers "Call N" at each judgment call.
- `rough-cut.review.mp4` — **review reel**: per judgment call, a title card,
  the kept version, then each alternative. Not imported into Resolve. Rebuilt
  on every build that has judgment calls (whatever `--to` says), so markers
  never point at a stale reel; removed when there are no calls.
- `rough-cut.report.md` — missing lines first, then 🔒 check, judgment
  calls, removed attempts, stats.
- `rough-cut.plan.json` (same shape as footage-rough-cut's), `rough-cut.markers.json`,
  `edit.json`, `transcript.md`, `prepare.json`.

`--to resolve` needs DaVinci Resolve open with the bridge running (Workspace →
Scripts → resolve_bridge); the bridge vendor checkout is set with
`RESOLVE_BRIDGE_VENDOR` (see the old skill's notes). It places the clips and
adds the markers. It never adds the review reel to the media pool.

## Mandatory closing message

Whenever you finish a run that produced the XML or placed the cut on the
Resolve timeline, and there are judgment calls, your closing message to the
user MUST say: there is a review file at `<out-dir>/rough-cut.review.mp4`,
it holds the alternatives for every judgment call, and the numbered "Call N"
markers on the timeline point into it. Every run, no exceptions. Also lead
with anything under **Missing** in the report (lines that were never said
can't be fixed in the edit).

## Fixing after review

The user says "swap call 3", "put back the Amy line", "cut the second
'right?'". Edit `edit.json` (spans, calls), re-run `build`. The same
`edit.json` always rebuilds the same cut.
