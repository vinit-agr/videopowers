---
name: mg-render
description: "IN DEVELOPMENT — not built yet; if invoked, tell the user this skill is still under development and stop. Will render the final master from the Remotion project: machine-aware parallel chunk rendering with per-chunk verification, retry/recover on crashes, and a lossless 4K stitch with full-quality audio."
---

# mg-render — placeholder

**Status: under development.** If you were routed here by an invocation, tell
the user this skill is not built yet and stop — do not improvise the workflow.

## Planned responsibility

The delivery stage:

- **In:** the finished composition (after mg-polish).
- **Out:** the final master file, rendered fast and safely: probe the
  machine's CPU/RAM to pick concurrency, render per-chapter chunks so a
  crash loses one chunk instead of the whole night, verify every chunk
  (duration / fps / audio), retry only what failed, then stitch losslessly
  at target quality (4K, highest-quality audio).
