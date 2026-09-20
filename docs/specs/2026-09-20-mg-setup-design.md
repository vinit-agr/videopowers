# mg-setup — design

Approved 2026-09-20 (brainstorm in Claude Code session). The mechanical,
zero-judgment first stage of the motion-graphics pipeline: final-cut MP4 +
script.md → a self-contained per-video Remotion project ready for mg-layout.

## Decisions locked in brainstorm

1. **Done-state:** opening Remotion Studio shows the `main` composition
   playing the footage with one named `<Sequence>` per chapter, plus a
   toggleable **sync-check overlay** (chapter name + currently-spoken word)
   so transcription sync and chapter boundaries are verifiable by scrubbing.
2. **Naming (hybrid):** composition ids short and generic inside the
   per-video project (`main`, later `short-1`, `thumb-a`). Chapter Sequences
   get machine ids `ch01-<slug>` and display the script's own heading in the
   timeline (`01 · COLD OPEN — …`).
3. **Shape:** CLI script + thin skill (the footage-rough-cut pattern) — a
   TypeScript CLI does everything deterministically with a dry-run report;
   SKILL.md tells Claude how to run and read it.

## Contract

- **In:** a project directory with `script.md` (beats = `##` headings
  containing `**Say:**` blocks) and a final-cut MP4 (`--input`, explicit).
  The final cut carries ~2s black gaps between chapters — the machine-
  readable markers this pipeline standardizes on.
- **Out:** `<project-dir>/remotion/` — a pnpm-installed Remotion project
  scaffolded from `templates/remotion-project/`, with:
  - `public/footage.mp4` — mezzanine working copy (see below)
  - `src/data/beat-sheet.json` — chapters: id, title, start/end (sec+frames)
  - `src/data/words.json` — word-level timestamps of the final cut
  - `src/data/source.json` — original input path + probe (for mg-render)
  - `src/chapters.ts`, `src/video.config.ts` — generated TS the comp reads

## Pipeline

`tsx scripts/cli.ts <project-dir> --input <mp4> [--dry-run] …`

1. Parse script.md → ordered beat titles (Say-block sections only).
2. Probe the input (fps, dims, pix_fmt, duration).
3. Blackdetect → gaps; a gap is **black ≥ 1.5s** (real gaps measure 1.9–2.0s;
   frame boundaries eat a frame or two). Threshold overridable.
4. **Zip check: gaps + 1 == beats, else hard stop** printing found-vs-expected
   side by side. The skill never guesses which beat is missing.
5. Dry-run report: chapter table (id, script title, span, duration) +
   warnings (10-bit/HEVC source, unusually long/short chapter). `--dry-run`
   stops here.
6. Mezzanine: 1920×1080/30, 8-bit H.264 (CRF 18), CFR, audio stream copied →
   `remotion/public/footage.mp4`. Always produced, even from clean sources —
   10-bit HEVC crashes Remotion's frame extractor (evals-video lesson), and
   normalizing unconditionally keeps the pipeline uniform.
7. Transcribe the mezzanine with ElevenLabs Scribe → words.json. Cached by
   streaming content hash (sources can exceed Node's 2 GiB buffer cap).
8. Scaffold from the template, write generated files, `pnpm install
   --ignore-workspace`, `tsc --noEmit` as the boot check.

## Resolution strategy

The comp authors at **1080p30** (fast previews, sane layout math);
compositions are resolution-independent, so 4K output is decided at render
time. mg-render derives its own full-resolution render mezzanine from the
original file recorded in `source.json` — mg-setup deliberately does not
ship a 4K working copy.

## Template vs. generated

- **Template (copied once, then owned by the video forever — the freeze):**
  `package.json` (Remotion pinned exact), `remotion.config.ts`,
  `tsconfig.json`, `src/index.ts`, `src/Root.tsx`, `src/Main.tsx`,
  `src/debug/SyncOverlay.tsx`. **No theme, no tokens** — look & feel is a
  later, separate decision the template must not pre-empt.
- **Generated (safe to regenerate, header-marked):** `chapters.ts`,
  `video.config.ts`, everything in `src/data/`.
- **Re-run behavior:** generated files and a missing mezzanine are always
  rewritten; template-derived files are written only if absent
  (`--force` re-copies them). Files the user edited are never touched by a
  plain re-run.

## Failure modes

- beats/gaps mismatch → stop with table (step 4).
- No `ELEVENLABS_API_KEY` (env / project `.env` / skill `.env`) → stop
  before any paid call, after the free steps.
- `pnpm`/`ffmpeg` missing → actionable error naming the install command.

## Testing

Vitest on pure logic: script parsing, blackdetect output parsing, gap→beat
zipping (match, off-by-one, tolerance), slug/id generation. Live smoke:
the Remotion-with-Claude-Code final cut (8 beats / 7 gaps, verified
2026-09-20).

## Out of scope

Theme and design system, layout structure (mg-layout), 4K render strategy
(mg-render), shorts/thumbnail compositions.
