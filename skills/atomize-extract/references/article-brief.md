# Brief: make the article images

You make the cover and the figures for the newsletter article, from its plan. You make images only. You write no article text; stage 2 does that.

**You are given:** the microcontent folder (`MC`). Run commands from the content workspace. `KIT`, `REF` and `XREF` are the absolute paths the main session gives you in the prompt.

## Read

1. `MC/article/plan.md`: the title options, the sections, each `Figure:` line and the beats that say what the figure shows, and the numbers, sources and excerpts.
2. `REF/formats.md`: the `cover` and `figure` templates, their slots and limits.

## Do

1. **Cover:** write `MC/article/cover/slots.json`: kind `article-cover`, one slide with template `cover`, headline = the article's hook in a few words (use `title_choice` if set, else the first title option). A cover has no source line: leave `source` empty.
2. **Figures:** for each `Figure:` line in the plan, write `MC/article/figure-N/slots.json`: kind `article-figure`, one slide with template `figure` and one of bars, rows or items. Each figure explains one idea at a glance. Set `source` to short citations from the plan's sources.
3. **Rules for every image:** numbers only from the plan's `numbers`, written as digits. Neutral voice: no "I", no names of anyone on the team. Theme from the `themes` list in `brand.json` (in the folder at the `brand` key).
4. **Render each one** as soon as its slot file is ready, so a later failure loses nothing: `python3 KIT/render.py MC/article/<name>/slots.json`. If it prints errors (a slot over its limit, overflow, a font problem), shorten or rephrase and run it again. At most 4 runs per image.
5. **Check:** `python3 KIT/gate.py visuals MC/article/cover MC/article/figure-1 MC/article/figure-2` (add `figure-3` when the plan has one). Fix what it reports.

## Return

One JSON line per image, nothing else:
`{"piece": "A01/figure-1", "status": "pass", "paths": ["MC/article/figure-1/slots.json", "MC/article/figure-1/report.json"], "fail_reasons": []}`
Use `"status": "fail"` with the reasons if an image still fails after 4 renders.
