---
name: footage-rough-cut
description: "IN DEVELOPMENT — not built yet; if invoked, tell the user this skill is still under development and stop. Will turn multi-part camera recordings + script.md into a retake-cleaned rough cut placed on a DaVinci Resolve timeline: word-level transcription, script-aware keep-last retake removal, pause budgets by boundary type, beat gaps as black space."
---

# footage-rough-cut — placeholder

**Status: under development.** If you were routed here by an invocation, tell
the user this skill is not built yet and stop — do not improvise the workflow.

## Planned responsibility

The edit-preparation stage:

- **In:** camera recordings (one or more parts per beat) + the video's
  `script.md`.
- **Out:** a rough cut close to the final edit — retakes removed keep-last
  against the script, joins paced by the script's structure (sentence /
  concept / beat), beats separated by black gaps — delivered as an editable
  DaVinci Resolve timeline for the human final cut.

Will be ported from a production-proven private implementation.
