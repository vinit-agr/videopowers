// videopowers:mg-visuals — chapter graphics registry.
// Phase B0 writes the real version of this file ONCE (importing every
// chapter stub); after that no agent edits it. Each chapter folder owns its
// component AND its `BUILT` shot-id list, so parallel chapter agents never
// touch a shared file:
//
//   import { Ch01, BUILT as B01 } from "./ch01";
//   export const CHAPTER_GRAPHICS: Record<string, React.ComponentType> =
//     { "ch01-…": Ch01, … };
//   export const BUILT_SHOT_IDS: Set<string> = new Set([...B01, …]);
//
// A shot in BUILT_SHOT_IDS stops rendering the Pass-1 PlaceholderPanel in
// FootageStage (media shots count as built once their MediaSlot frame
// exists, even while the capture file is pending).
import type React from "react";

export const CHAPTER_GRAPHICS: Record<string, React.ComponentType> = {};

export const BUILT_SHOT_IDS: Set<string> = new Set([]);
