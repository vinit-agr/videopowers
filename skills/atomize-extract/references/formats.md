# Formats

The three formats, what LinkedIn allows, which idea suits each, and the templates the renderer offers. Platform limits come from the LinkedIn Help pages and 2026 platform datasets. Caption rules are not here; they belong to stage 2.

## The three formats

| Format | How it posts | LinkedIn limits | Kind in `slots.json` | Suits |
|---|---|---|---|---|
| Text + infographic | single image post | 5 MB per image; 4:5 portrait is the safe feed shape | `infographic` (1 slide) | one comparison, one big number, one before/after, one short list |
| Text + carousel | document post (PDF), shown as swipeable pages, read in order | 100 MB, 300 pages; the reader can download it | `carousel` (5 to 10 slides: `title` first, `ask` last) | steps, a sequence, an argument with 3 or more beats, "the guess, then the answer" |
| Newsletter article | an article published as an edition of the author's newsletter | a title over 60 characters is cut | `article-cover` + `article-figure` (landscape) | the whole video, planned in `article-plan.md` |

- One format per idea, picked by fit. One idea is one post: never two formats of the same idea.
- About half of each post format per video (about 6 and 6 in 12), so each profile can get at least one of each. Loose, not strict.
- Carousels have the strongest engagement in every 2026 dataset. A single image is the fastest read.
- No multi-image posts: a grid of separate images reads poorly in the feed. Parallel examples go on one infographic (`list`, `bars`, `beforeafter`) or on the slides of a carousel.

## Templates

| Template | Size | Slots (max characters) | Use for |
|---|---|---|---|
| `title` | portrait | kicker 60, headline 90, lead? 140 | carousel cover only |
| `stat` | portrait | kicker 60, headline 90, number 8, number_label 90, body? 220, note? 160 | one big number |
| `compare` | portrait | kicker 60, headline 90, left_label 40, left_value 10, right_label 40, right_value 10, between? 6, body? 200, note? 160 | two numbers side by side (left = the worse one). `between` is the word between them, default "vs"; use "and" or "+" when both are gains |
| `beforeafter` | portrait | kicker 60, headline 90, rows 1 to 4 x {label 50, before 8, after 8}, note? 160 | change at one or more places |
| `steps` | portrait | kicker 60, headline 90, items 2 to 4 x {title 60, text? 110} | what to do, in order |
| `list` | portrait | kicker 60, headline 90, items 3 to 6 x {text 70, mark? yes/no/dot} | checked items, one answer |
| `quote` | portrait | kicker 60, quote 160, who 70, context? 220 | a real quote from the sources |
| `bars` | portrait | kicker 60, headline 90, bars 2 to 4 x {label 50, value 8, pct 0 to 100, tone green/red/grey}, note? 160 | shares compared on one scale |
| `ask` | portrait | kicker 40, question 110, cta 60 | carousel last slide only |
| `cover` | landscape | kicker 50, headline 80 | article cover |
| `figure` | landscape | headline 80, one of bars / rows / items (as above), note? 140 | article figures |

- `?` = optional.
- In `headline`, `*words*` get the pen underline and `**words**` are bold. Use the underline once per visual, on the words that carry the surprise.
- **Themes** come from the `themes` list in `brand.json`, in the folder at the `brand` key. The logo, font and colours come from the same file. Rotate the themes across a video's posts.
