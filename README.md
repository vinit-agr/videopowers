# videopowers

A factory for making YouTube videos with Claude Code — inspired by
[superpowers](https://github.com/obra/superpowers), aimed at one-person video
studios.

Free tools do the heavy lifting (DaVinci Resolve, Remotion, ffmpeg); Claude
Code is the only paid thing in the loop. Each skill captures one stage of the
pipeline so it can be repeated video after video.

## The pipeline

```
idea ─► outline ─► script ─► packaging ─► record ─► rough cut ─► FINAL CUT (you, in Resolve)
                                                                      │
              render ◄─ polish ◄─ visuals ◄─ layout ◄─ setup ◄────────┘
                                (motion graphics, in Remotion)
```

## Skills

| Skill | Stage | Responsibility | Status |
|---|---|---|---|
| `outline-shaping` | pre-production | braindump → approved beat outline | planned |
| `script-writing` | pre-production | outline + voice reference → spoken-word manuscript for the human rewrite | planned |
| `packaging-kit` | pre & post | titles, thumbnails, description, chapters — one promise, two phases | planned |
| `footage-rough-cut` | edit | camera recordings + script → retake-cleaned rough cut on a Resolve timeline | **built** |
| `mg-setup` | motion graphics | final-cut MP4 + script → per-video Remotion project, beat sheet, word timestamps | **built** |
| `mg-layout` | motion graphics | layout timeline (doc = source of truth) → placeholder composition for review | **built** |
| `mg-design` | motion graphics | look & feel → style package (design-system.md + tokens.ts), previewed as a probe reel on real footage in Studio | **built** |
| `mg-visuals` | motion graphics | placeholders → real graphics, chapter by chapter, per the design system | planned |
| `mg-polish` | motion graphics | tightening + sound effects, in Remotion | planned |
| `mg-render` | delivery | machine-aware parallel chunk render with retry/recover, 4K stitch | planned |

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
