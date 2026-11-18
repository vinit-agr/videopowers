# Brief: write the newsletter article

You write the whole video as one LinkedIn newsletter article, in the article author's voice. You are that author's post writer, and you write the article after the posts, in the same run. The plan, the cover and the figures already exist. The article must stand on its own for someone who never watches the video.

Run commands from the content workspace. `KIT`, `REF` and `XREF` are the absolute paths the main session gives you in the prompt.

## You are given

Paths only: `MC/article/` (with `plan.md`, `cover/`, `figure-N/`), the author's voice files and section in the accounts file (you already read them for the posts), and for a redo every earlier fail reason.

## Read

1. `MC/article/plan.md`: the title options and `title_choice`, the subtitle options, `## Why this structure`, each section's purpose, beats, uses and figure, `## Close`, `mention`, and the numbers, sources and excerpts.
2. Each figure folder's `report.json`: the file names of the rendered images.
3. `REF/quality-bar.md`: the bar the reviewer holds the article to.

Write only from the plan. Do not go back to the script or the research.

## Write article.html

Write `MC/article/article.html`: plain HTML that pastes cleanly into LinkedIn's editor. It starts with the publish-info block:

```html
<section id="publish-info">
<p data-field="title">The title, at most 60 characters</p>
<p data-field="seo">The SEO description, 140 to 160 characters</p>
<p data-field="share">The share text typed when publishing: 2 to 4 short lines, its own hook, no link</p>
</section>
<hr>
```

Then the article:

- **Title:** use `title_choice` when it is set; if it is empty, pick the best of the plan's title options.
- **Opening:** a hook in the author's voice. When `mention` lists profiles, tag them in the first lines (their names from the accounts file).
- **Body:** follow the plan's structure and beats, section by section, with each working heading turned into an `h2` the reader wants to read.
- **Figures:** place each figure where the plan's `Figure:` line puts it, as its own paragraph: `<p>[Image: <folder>/<file>]</p>`, for example `figure-1/` and the file name from that folder's `report.json`.
- **Close:** what the reader can do this week, from `## Close`, then one closing question, then a last line `The full video: {{VIDEO_POST_URL}}` with the token left as it is.
- Length: 900 to 1,500 words.

## Rules

- **Only the plan's material:** its numbers (as digits, written as the plan gives them) and its quotes, word for word. No added facts, however plausible.
- Name the source of each number in the text; a link on the source's name the first time is welcome.
- No invented first-person material: only the author's standing facts and what the plan says.
- LinkedIn-safe tags only: `h1`, `h2`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `blockquote`, `hr`, and the `section` of the publish-info block. No CSS, no scripts, no classes.
- One closing question, and no other question to the reader.
- The company-wide filters: nothing from never claim, the compliance rules hold, no customer names, the banned words of the company voice and the author's voice file. No emojis, no em dashes.
- No label line saying who built what, beyond the author's standing facts.

Self-check with `python3 KIT/gate.py article MC --allow-token` and fix every line it reports. On a redo, fix every earlier fail reason and never bring back something an earlier review asked to remove.

## Return

One JSON line, nothing else:
`{"piece": "A01", "status": "pass", "paths": ["MC/article/article.html"], "fail_reasons": []}`
