# videopowers

A factory for making YouTube videos with Claude Code — inspired by
[superpowers](https://github.com/obra/superpowers), aimed at one-person video
studios.

Free tools do the heavy lifting (DaVinci Resolve, Remotion, ffmpeg); Claude
Code is the only paid thing in the loop. Each skill captures one stage of the
pipeline so it can be repeated video after video.

## The pipeline

```
ideation ─► research + outline ─► script ─► record ─► rough cut ─► FINAL CUT (you, in Resolve) ─► packaging (late)
(+ packaging v1)  (gate 1: Approved)  (gate 2: Locked)                     │
                         render ◄─ polish ◄─ visuals ◄─ layout ◄─ setup ◄──┘
                                   (motion graphics, in Remotion)
```

## Skills

| Skill | Stage | Responsibility | Status |
|---|---|---|---|
| `content-ideation` | pre-production | plan a month or the next video, test one idea, review a plan; packaging v1 (overview, titles, first line, thumbnail concept + HTML mockup) with a Reach / Sales score | **built** |
| `research-and-outline` | pre-production | planned idea → research (desk, your own study behind a criteria gate, or conversation prep) + an approved one-page story outline with stand-alone chapters | **built** |
| `script-writing` | pre-production | approved outline + craft, niche and speaker layers → a `script.md` to read on camera without edits; learns from the speaker's edits | **built** |
| `packaging-kit` | post | late packaging: chapters with timestamps and the final description (early packaging lives in content-ideation) | planned |
| `footage-rough-cut` | edit | camera recordings + script → retake-cleaned rough cut on a Resolve timeline | **built** |
| `natural-footage-rough-cut` | edit | improvised recordings from prompt cards (`natural_script.md`) → finished rough cut, retakes found by meaning, with judgment-call markers + a review reel | **built** |
| `mg-setup` | motion graphics | final-cut MP4 + script → per-video Remotion project, beat sheet, word timestamps | **built** |
| `mg-layout` | motion graphics | layout timeline (doc = source of truth) → placeholder composition for review | **built** |
| `mg-design` | motion graphics | look & feel → style package (design-system.md + tokens.ts), previewed as a probe reel on real footage in Studio | **built** |
| `mg-visuals` | motion graphics | placeholders → real graphics, chapter by chapter, per the design system | planned |
| `mg-polish` | motion graphics | tightening + sound effects, in Remotion | planned |
| `mg-render` | delivery | machine-aware parallel chunk render with retry/recover, 4K stitch | planned |

### The content workspace

The plugin holds only the method. Everything about one company (its
profile, approved proof, buyers' words, speakers, framework and the list of
every video and idea) lives in that company's own repo, in a folder marked
by a `videopowers.md` file. The three pre-production skills find it, read
it and keep it up to date; the first run offers a short setup interview that
builds it from whatever you already have. Formats:
`skills/content-ideation/references/workspace.md`.

Worked example: Tars, which makes chat and voice AI agents for behavioral
health providers, plans, outlines and scripts its videos this way from its
own private workspace.

### Two rough-cut skills: pick by how you recorded

- **Read word for word from `script.md`** → `footage-rough-cut`. Code aligns
  every take to the script's sentences and drops retakes keep-last.
- **Improvised from prompt cards in `natural_script.md`** (sections → cards →
  free bullets + `> 🔒` fixed lines you say nearly verbatim) → `natural-footage-rough-cut`.
  The words on camera match no script, so Claude Code is the editor, in three steps:
  `prepare` (transcribe, write `transcript.md` with restart/cut-off hints) →
  Claude writes `edit.json` (which attempt of each thought to keep) →
  `build` (MP4, Resolve XML with yellow "Call N" markers, a review reel of the
  alternatives for each judgment call, and a report that leads with any
  🔒 line never said). Natural pauses are kept; only dead air is shortened.

The final cut is deliberately **not** a skill — pacing decisions belong to a
human in the edit bay.

## Install

```
/plugin marketplace add vinit-agr/videopowers
/plugin install videopowers@videopowers
```

> ⚠️ Work in progress: the skills below are being built in the open, one at a
> time. A skill marked *planned* is a placeholder — installing the plugin is
> safe, but placeholders announce themselves and stop when invoked.

## Layout of this repo

```
.claude-plugin/   plugin + marketplace manifests
skills/           one folder per skill (SKILL.md + supporting scripts)
templates/        scaffolds skills copy from (e.g. the per-video Remotion project)
scripts/          shared helpers used by multiple skills
```

## License

MIT — see [LICENSE](LICENSE).
