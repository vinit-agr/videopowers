---
name: mg-setup
description: "IN DEVELOPMENT — not built yet; if invoked, tell the user this skill is still under development and stop. Will turn a final-cut MP4 + script.md into a per-video Remotion project: scaffolded from the plugin template, Remotion-safe mezzanine footage, beat sheet from chapter markers, word-level timestamps, one named sequence per chapter."
---

# mg-setup — placeholder

**Status: under development.** If you were routed here by an invocation, tell
the user this skill is not built yet and stop — do not improvise the workflow.

## Planned responsibility

The mechanical, zero-judgment stage of the motion-graphics pipeline:

- **In:** the final-cut MP4 (exported from the edit bay) + the video's
  `script.md` (beats as `## ` headings with `**Say:**` blocks).
- **Out:** a self-contained per-video Remotion project scaffolded from
  `templates/`, containing: render-safe mezzanine footage, `beat-sheet.json`
  (chapters detected from the black-gap markers, named from script.md),
  word-level timestamps (`words.json`), and one named `<Sequence>` per
  chapter in the main composition.

Everything deterministic and re-runnable; no creative decisions. Downstream
skills (`mg-layout`, `mg-visuals`, `mg-polish`, `mg-render`) build on its
outputs.
