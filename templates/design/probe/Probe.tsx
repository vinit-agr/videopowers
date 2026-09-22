import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Shot } from "../layout/shots";
import { footageRect } from "../layouts/geometry";
import type { BaseTokens } from "./tokens-base";

/**
 * The style probe: eight templatized element archetypes — every question a
 * design system must answer — staged on the video's REAL footage in the
 * real layouts. Same reel for every candidate; only `tokens` varies.
 * What you approve here is literally what mg-visuals builds with.
 */
export const SCENE_FRAMES = 120; // 4s per scene @30fps
export const PROBE_SCENES = 8;
export const PROBE_DURATION = SCENE_FRAMES * PROBE_SCENES;

/** Footage timestamps (sec) used as backdrops, spread across the video. */
const BACKDROPS = [40, 75, 130, 200, 260, 330, 400, 470];

function probeShot(kind: Shot["kind"], extra: Partial<Shot> = {}): Shot {
  return {
    id: "probe", chapterId: "probe", origin: "yaml", tag: `[${kind}]`, kind,
    content: "graphics", cells: [6], side: "left", facePct: 35, shape: "circle",
    startFrame: 0, durationInFrames: SCENE_FRAMES, purpose: null, subjects: [],
    builds: [], cardTitle: null, ...extra,
  };
}

const ease = Easing.out(Easing.cubic);

/** 0→1 over `sec`, starting at frame `from`. */
function rise(frame: number, fps: number, from: number, sec: number): number {
  return interpolate(frame, [from, from + Math.max(1, sec * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

const Footage: React.FC<{ shot: Shot; t: BaseTokens; atSec: number }> = ({ shot, t, atSec }) => {
  const { fps } = useVideoConfig();
  const r = footageRect(shot);
  if (r.opacity === 0) return null;
  return (
    <div
      style={{
        position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h,
        borderRadius: r.radius, overflow: "hidden",
        border: shot.kind === "SPLIT" || shot.kind === "BUBBLE" ? `4px solid ${t.panelBorder}` : undefined,
        boxShadow: r.w < 1900 ? `0 14px 44px ${t.shadow}` : undefined,
        transform: shot.kind === "SPLIT" ? "rotate(-1deg)" : undefined,
      }}
    >
      <OffthreadVideo
        src={staticFile("footage.mp4")}
        startFrom={Math.round(atSec * fps)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
};

const label = (t: BaseTokens): React.CSSProperties => ({
  fontFamily: t.fonts.body, fontSize: 19, letterSpacing: "0.22em",
  textTransform: "uppercase", color: t.muted,
});

const Panel: React.FC<{ t: BaseTokens; style?: React.CSSProperties; children: React.ReactNode }> = ({ t, style, children }) => (
  <div
    style={{
      position: "absolute", background: t.panel, border: `1px solid ${t.panelBorder}`,
      borderRadius: t.radius, boxShadow: `0 14px 44px ${t.shadow}`, padding: 36,
      color: t.ink, boxSizing: "border-box", ...style,
    }}
  >
    {children}
  </div>
);

/* ── scenes ─────────────────────────────────────────────────────────── */

const ChapterCard: React.FC<{ t: BaseTokens }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = rise(frame, fps, 6, t.motion.enterSec);
  const ruleW = rise(frame, fps, 6 + t.motion.enterSec * fps, 0.5);
  const sub = rise(frame, fps, 6 + (t.motion.enterSec + t.motion.annotationDelaySec) * fps, 0.4);
  return (
    <AbsoluteFill style={{ background: t.stage, justifyContent: "center", alignItems: "center" }}>
      <div style={{ ...label(t), opacity: a }}>CHAPTER 3 · THE ROUGH CUT</div>
      <div
        style={{
          fontFamily: t.fonts.display, fontWeight: t.fonts.displayWeight, fontSize: 88,
          color: t.ink, marginTop: 24, opacity: a, transform: `translateY(${(1 - a) * 16}px)`,
        }}
      >
        A skill edits your footage
      </div>
      <div style={{ height: 5, width: 320 * ruleW, background: t.accent, marginTop: 28 }} />
      <div style={{ fontFamily: t.fonts.hand ?? t.fonts.body, fontSize: 34, color: t.accent, marginTop: 22, opacity: sub, transform: "rotate(-2deg)" }}>
        the boring part, automated
      </div>
    </AbsoluteFill>
  );
};

const ClaimOverlay: React.FC<{ t: BaseTokens; atSec: number }> = ({ t, atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = rise(frame, fps, 8, t.motion.enterSec);
  const hl = rise(frame, fps, 8 + (t.motion.enterSec + t.motion.annotationDelaySec) * fps, 0.5);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Footage shot={probeShot("OVERLAY")} t={t} atSec={atSec} />
      <Panel t={t} style={{ right: 96, top: 300, width: 560, opacity: a, transform: `translateY(${(1 - a) * 14}px)` }}>
        <div style={label(t)}>THE CLAIM</div>
        <div style={{ fontFamily: t.fonts.display, fontWeight: t.fonts.displayWeight, fontSize: 46, lineHeight: 1.2, marginTop: 14 }}>
          The script decides the <span style={{ position: "relative", whiteSpace: "nowrap" }}>
            breathing
            <span style={{ position: "absolute", left: 0, bottom: -4, height: 6, width: `${hl * 100}%`, background: t.highlight }} />
          </span>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

const ListSplit: React.FC<{ t: BaseTokens; atSec: number }> = ({ t, atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = probeShot("SPLIT", { side: "left", facePct: 35 });
  const items = ["mistakes", "silences", "retakes"];
  return (
    <AbsoluteFill style={{ background: t.stage }}>
      <Footage shot={shot} t={t} atSec={atSec} />
      <div style={{ position: "absolute", left: 700, top: 220, width: 1050 }}>
        <div style={label(t)}>WHAT GETS CUT</div>
        {items.map((it, i) => {
          const a = rise(frame, fps, 14 + i * 24, t.motion.enterSec);
          return (
            <div key={it} style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 34, opacity: a, transform: `translateX(${(1 - a) * 18}px)` }}>
              <div style={{ width: 34, height: 34, border: `2px solid ${t.ink}`, borderRadius: 8, color: t.accent, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {a > 0.9 ? "✓" : ""}
              </div>
              <div style={{ fontFamily: t.fonts.body, fontSize: 44, color: t.ink }}>{it}</div>
              <div style={{ flex: 1, borderBottom: `1px solid ${t.panelBorder}` }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const NumberStamp: React.FC<{ t: BaseTokens; atSec: number }> = ({ t, atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = rise(frame, fps, 8, t.motion.enterSec);
  const n = Math.round(rise(frame, fps, 8, 0.9) * 70);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Footage shot={probeShot("OVERLAY", { cells: [4] })} t={t} atSec={atSec} />
      <Panel t={t} style={{ left: 96, top: 300, width: 480, opacity: a, textAlign: "center" }}>
        <div style={{ fontFamily: t.fonts.display, fontWeight: t.fonts.displayWeight, fontSize: 130, color: t.ink }}>
          ~{n}<span style={{ fontSize: 70 }}>%</span>
        </div>
        <div style={{ display: "inline-block", background: t.highlight, color: "#151310", fontFamily: t.fonts.body, fontWeight: 700, fontSize: 22, padding: "6px 14px", borderRadius: 6, marginTop: 8 }}>
          RIGHT ON RETAKES
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

const VersusSplit: React.FC<{ t: BaseTokens; atSec: number }> = ({ t, atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = probeShot("SPLIT", { side: "right", facePct: 35 });
  const rows: Array<[string, string, boolean]> = [
    ["fix a cut", "ask again & again", false],
    ["fix a cut", "two clicks", true],
  ];
  return (
    <AbsoluteFill style={{ background: t.stage }}>
      <Footage shot={shot} t={t} atSec={atSec} />
      <div style={{ position: "absolute", left: 170, top: 240, width: 1000 }}>
        <div style={{ display: "flex", gap: 40 }}>
          <div style={{ ...label(t), width: 460 }}>REMOTION STUDIO</div>
          <div style={{ ...label(t), width: 460 }}>DAVINCI RESOLVE</div>
        </div>
        {rows.map(([what, how, win], i) => {
          const a = rise(frame, fps, 16 + i * 26, t.motion.enterSec);
          return (
            <div key={i} style={{ display: "flex", gap: 40, marginTop: 30, opacity: a }}>
              <div style={{ width: 460, fontFamily: t.fonts.body, fontSize: 34, color: t.muted, borderBottom: `1px solid ${t.panelBorder}`, paddingBottom: 14 }}>
                {what}
              </div>
              <div
                style={{
                  width: 460, fontFamily: t.fonts.body, fontSize: 34, paddingBottom: 14,
                  color: win ? "#151310" : t.ink, background: win ? t.highlight : "transparent",
                  borderBottom: `1px solid ${t.panelBorder}`, padding: win ? "4px 12px 14px" : "0 0 14px",
                  borderRadius: win ? 6 : 0, fontWeight: win ? 700 : 400,
                }}
              >
                {how}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const FigureFull: React.FC<{ t: BaseTokens }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = rise(frame, fps, 10, t.motion.drawSec);
  const note = rise(frame, fps, 10 + (t.motion.drawSec + t.motion.annotationDelaySec) * fps, 0.4);
  const C = 880; // circle circumference-ish for dash animation
  return (
    <AbsoluteFill style={{ background: t.stage, justifyContent: "center", alignItems: "center" }}>
      <div style={{ ...label(t), position: "absolute", top: 120, left: 160 }}>FIG. 1 — THE LOOP</div>
      <svg width={900} height={560} viewBox="0 0 900 560">
        <rect x={60} y={200} width={280} height={140} rx={t.radius} fill="none" stroke={t.ink} strokeWidth={t.strokeWidth} strokeDasharray={840} strokeDashoffset={840 * (1 - draw)} />
        <rect x={560} y={200} width={280} height={140} rx={t.radius} fill="none" stroke={t.ink} strokeWidth={t.strokeWidth} strokeDasharray={840} strokeDashoffset={840 * (1 - draw)} />
        <path d="M 340 240 C 430 170, 470 170, 560 240" fill="none" stroke={t.accent} strokeWidth={t.strokeWidth + 0.6} strokeDasharray={C} strokeDashoffset={C * (1 - draw)} />
        <path d="M 560 300 C 470 370, 430 370, 340 300" fill="none" stroke={t.accent} strokeWidth={t.strokeWidth + 0.6} strokeDasharray={C} strokeDashoffset={C * (1 - draw)} />
        <text x={200} y={278} textAnchor="middle" fill={t.ink} fontFamily={t.fonts.body} fontSize={30}>MODEL</text>
        <text x={700} y={278} textAnchor="middle" fill={t.ink} fontFamily={t.fonts.body} fontSize={30}>HARNESS</text>
      </svg>
      <div style={{ fontFamily: t.fonts.hand ?? t.fonts.body, fontSize: 32, color: t.accent, opacity: note, transform: "rotate(-2deg)", marginTop: -30 }}>
        until the goal is done!
      </div>
    </AbsoluteFill>
  );
};

const QuoteOverlay: React.FC<{ t: BaseTokens; atSec: number }> = ({ t, atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = rise(frame, fps, 8, t.motion.enterSec);
  const note = rise(frame, fps, 8 + (t.motion.enterSec + t.motion.annotationDelaySec) * fps, 0.4);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Footage shot={probeShot("OVERLAY")} t={t} atSec={atSec} />
      <Panel t={t} style={{ right: 96, top: 270, width: 600, opacity: a }}>
        <div style={label(t)}>EVERYONE KEEPS ASKING</div>
        <div style={{ fontFamily: t.fonts.display, fontWeight: t.fonts.displayWeight, fontStyle: "italic", fontSize: 40, lineHeight: 1.25, marginTop: 14 }}>
          “Why not just ask AI to make it look good?”
        </div>
        <div style={{ borderTop: `1px solid ${t.panelBorder}`, marginTop: 20, paddingTop: 12, fontFamily: t.fonts.hand ?? t.fonts.body, fontSize: 30, color: t.accent, opacity: note, transform: "rotate(-1.5deg)" }}>
          I tried. here's what happens →
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

const TrackerChip: React.FC<{ t: BaseTokens; atSec: number }> = ({ t, atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = rise(frame, fps, 8, t.motion.enterSec);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Footage shot={probeShot("OVERLAY", { cells: [9] })} t={t} atSec={atSec} />
      <div style={{ position: "absolute", right: 96, bottom: 96, opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
        <Panel t={t} style={{ position: "relative", padding: "18px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ background: t.highlight, color: "#151310", borderRadius: 6, fontFamily: t.fonts.body, fontWeight: 800, fontSize: 24, padding: "4px 12px" }}>
              STEP 1 / 5
            </div>
            <div style={{ fontFamily: t.fonts.body, fontSize: 26, color: t.ink }}>the rough cut</div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/* ── the reel ───────────────────────────────────────────────────────── */

export const Probe: React.FC<{ tokens: BaseTokens }> = ({ tokens: t }) => {
  const scenes: Array<{ name: string; el: React.ReactNode }> = [
    { name: "chapter card", el: <ChapterCard t={t} /> },
    { name: "claim + emphasis", el: <ClaimOverlay t={t} atSec={BACKDROPS[1]!} /> },
    { name: "list build (split)", el: <ListSplit t={t} atSec={BACKDROPS[2]!} /> },
    { name: "number stamp", el: <NumberStamp t={t} atSec={BACKDROPS[3]!} /> },
    { name: "versus (split right)", el: <VersusSplit t={t} atSec={BACKDROPS[4]!} /> },
    { name: "drawn figure", el: <FigureFull t={t} /> },
    { name: "quote + hand note", el: <QuoteOverlay t={t} atSec={BACKDROPS[6]!} /> },
    { name: "tracker chip", el: <TrackerChip t={t} atSec={BACKDROPS[7]!} /> },
  ];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scenes.map((s, i) => (
        <Sequence key={s.name} name={`${i + 1} · ${s.name}`} from={i * SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
          {s.el}
        </Sequence>
      ))}
      <div style={{ position: "absolute", left: 24, top: 20, fontFamily: "monospace", fontSize: 22, color: "#888" }}>
        style probe · {t.name}
      </div>
    </AbsoluteFill>
  );
};
