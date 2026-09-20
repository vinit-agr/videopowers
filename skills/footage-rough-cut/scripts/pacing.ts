import type { Pacing, PacingPreset } from "./types.js";

// Pacing presets map a feel ("tight"/"medium"/"loose") to the two knobs that
// govern the cut: how big a pause counts as a cuttable boundary, and how much
// breath to leave around each kept slice.
const PRESETS: Record<Pacing, PacingPreset> = {
  tight: { gapThreshold: 0.2, padLead: 0.04, padTrail: 0.06 },
  medium: { gapThreshold: 0.4, padLead: 0.06, padTrail: 0.1 },
  loose: { gapThreshold: 0.7, padLead: 0.08, padTrail: 0.14 },
};

export function pacingPreset(name: Pacing): PacingPreset {
  return PRESETS[name];
}
