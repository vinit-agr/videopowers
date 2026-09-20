# Per-video Remotion project

Scaffolded by `videopowers:mg-setup`. Self-contained on purpose: dependencies
are pinned so this video keeps rendering identically years from now, whatever
newer videos upgrade to.

- `pnpm studio` — open Remotion Studio (comp `main`; sync overlay on by default)
- `pnpm render` — plain single-machine render (the mg-render skill does the
  fast parallel version)

## What's what

| Path | Owner |
|---|---|
| `src/chapters.ts`, `src/video.config.ts`, `src/data/` | **generated** — mg-setup rewrites them on re-run; don't hand-edit |
| `src/Main.tsx`, `src/Root.tsx`, everything else | **yours** — mg-setup never touches an existing file (only `--force` re-copies) |
| `public/footage.mp4` | mezzanine working copy (1080p 8-bit H.264); the original final cut is referenced in `src/data/source.json` |

Chapter `<Sequence>` blocks in `Main.tsx` are the mount points for the
mg-layout pass. The `debug` prop toggles the sync overlay; turn it off in
`Root.tsx` defaultProps when layout work starts.
