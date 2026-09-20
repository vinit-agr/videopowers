---
name: mg-setup
description: Use when a final-cut video (MP4 with ~2s black gaps between chapters) and its script.md need to become a per-video Remotion project for motion graphics. Scaffolds from the plugin template with Remotion-safe mezzanine footage, a beat sheet from the chapter markers, word-level timestamps, and one named sequence per chapter. First stage of the mg pipeline, before mg-layout.
---

# mg-setup

The mechanical, zero-judgment stage between the human's final cut and the
motion-graphics passes. Deterministic and re-runnable: same inputs, same
project. Design spec: `docs/specs/2026-09-20-mg-setup-design.md`.

## Prerequisites

- `ffmpeg` + `ffprobe` on PATH (`brew install ffmpeg`), `pnpm`.
- `ELEVENLABS_API_KEY` — env var, or a `.env` in the project dir / any parent
  / this skill's folder. Found automatically; checked before any paid call.
- One-time in this skill folder: `pnpm install --ignore-workspace`.

## Inputs it expects

- `<project-dir>/script.md` — beats as `## ` headings containing `**Say:**`
  blocks (the shared videopowers convention). Sections without Say blocks
  are ignored.
- The final-cut MP4 — exported from the edit bay, with **~2s of black
  between chapters** (the pipeline's machine-readable chapter markers,
  placed during the manual final cut).

## Run

```bash
cd <plugin>/skills/mg-setup
pnpm mg:setup "/path/to/project-dir" --input "/path/to/final-cut.mp4" --dry-run
pnpm mg:setup "/path/to/project-dir" --input "/path/to/final-cut.mp4"
```

**Always dry-run first** and show the user the chapter table before the real
run. The real run then: encodes the mezzanine (1080p30 8-bit H.264 —
mandatory; 10-bit HEVC sources crash Remotion's frame extractor), transcribes
it (Scribe, cached by content hash), scaffolds `<project-dir>/remotion/` from
the plugin template, generates the data files, runs `pnpm install` and a
typecheck.

## Reading the report

- **Chapter table** — id, span, length, script beat. Verify the titles line
  up with what is actually spoken in each span (the sync overlay makes this
  a scrubbing job, not a guessing job).
- **Mismatch hard-stop** — script beats ≠ gaps + 1 prints both sides and
  exits. Never work around it by editing the beat sheet by hand: fix the
  edit (missing/extra gap), the threshold (`--threshold`, default 1.5s), or
  the script, then re-run.
- **Warnings** — 10-bit source (informational; the mezzanine covers it),
  unusually long/short chapters (confirm a gap wasn't lost in the edit).

## Output

`<project-dir>/remotion/` — self-contained (own pinned dependencies — the
freeze that keeps old videos rendering), containing `public/footage.mp4`
(mezzanine), `src/data/{beat-sheet,words,source}.json`, generated
`src/chapters.ts` + `src/video.config.ts`, and a `main` composition with one
named `<Sequence>` per chapter plus the sync-check overlay (on by default).

Review step for the user: `cd <project-dir>/remotion && pnpm studio`, scrub
the video, confirm chapter names and the spoken-word readout track the audio.

## Re-runs

Generated files are always rewritten; template-derived files are written
only if absent; an existing mezzanine is kept. `--force` rebuilds both. The
user's edits to non-generated files are never touched.

## What it deliberately does not do

No theme or design tokens (look & feel is a later decision), no layout
structure (mg-layout), no 4K assets — the comp authors at 1080p30 and
mg-render derives its full-resolution source from the original recorded in
`src/data/source.json`.
