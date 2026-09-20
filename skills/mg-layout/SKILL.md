---
name: mg-layout
description: "IN DEVELOPMENT — not built yet; if invoked, tell the user this skill is still under development and stop. Will decide the layout timeline for a talking-head video (FullFace / Overlay / Split / Bubble / FullGraphics on word boundaries) and place reviewable placeholder graphics in the Remotion composition."
---

# mg-layout — placeholder

**Status: under development.** If you were routed here by an invocation, tell
the user this skill is not built yet and stop — do not improvise the workflow.

## Planned responsibility

Pass 1 of the motion-graphics work — the judgment stage:

- **In:** `script.md`, plus mg-setup's outputs (beat sheet, words.json,
  scaffolded composition).
- **Out:** a layout timeline document (the source of truth) mapping every
  span of the video to a layout from the five-layout vocabulary, each switch
  anchored to a spoken word — and placeholder Sequences generated from it,
  so the pass is reviewed by scrubbing the composition. Placeholders state
  the *purpose* of each future graphic (what the viewer should understand),
  never its visual design.

Encodes the layout-selection criteria: rhetorical job of each paragraph,
retention rhythm rules (max dwell, change cadence, front-loaded density),
and anchor-to-word discipline.
