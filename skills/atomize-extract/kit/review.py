#!/usr/bin/env python3
"""Build the review page for a video's microcontent folder. Both stages call it; the page grows with the run.

    python3 review.py MC

Writes MC/review/index.html, its images (img/) and upload copies with clear names (dl/), and
MC/review/files.json (published path -> source file) for publishing the page. Prints the page path.

- After part 1: the picked ideas, backups, article plan and ideas not picked.
- After part 2: the same, with every visual.
- After stage 2: the profile on each post, the document title, the post and the first comment, each
  with a copy button, a download button for the upload files, and the article text.
"""
from __future__ import annotations

import html
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT))
import accounts as acc  # noqa: E402
import cards  # noqa: E402
import paths  # noqa: E402

TEMPLATE = KIT.parent / "templates" / "review.html"
COLS = ["id", "idea", "hook", "retain", "reward", "total", "result", "why"]
FORMAT_ORDER = ("infographic", "carousel")
ARTICLE_IMAGES = ("cover", "figure-1", "figure-2", "figure-3")
THUMB = 1000  # longest side of the page images, in pixels
DEFAULT_BRAND = "#4b5bd6"


def esc(v) -> str:
    return html.escape(str(v if v is not None else ""), quote=True)


def parse_candidates(path: Path) -> list[dict]:
    """Rows of the candidates.md table; a missing file gives []."""
    p = Path(path)
    if not p.is_file():
        return []
    rows = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if not re.match(r"^C\d+$", cells[0]):
            continue
        cells += [""] * (len(COLS) - len(cells))
        rows.append(dict(zip(COLS, cells)))
    return rows


def parse_post(path: Path) -> dict:
    """The parts of a post.md the page shows: account, document title, post and first comment."""
    text = Path(path).read_text()
    m = re.search(r"^account:\s*(\S+)", text, re.M)

    def fence(heading):
        mm = re.search(rf"^## {heading}\s*\n```text\n(.*?)\n```", text, re.S | re.M)
        return mm.group(1).strip() if mm else ""
    doc = re.search(r"^Document title:\s*(.+)$", text, re.M)
    return {"account": m.group(1) if m else "", "doc_title": doc.group(1).strip() if doc else "",
            "post": fence("Post"), "comment": fence("First comment")}


def stage(mc: Path) -> str:
    """ideas, visuals or posts: how far the run has got."""
    if any((mc / "posts").glob("*/post.md")):
        return "posts"
    if any((mc / "posts").glob("*/report.json")):
        return "visuals"
    return "ideas"


class Page:
    """Collects the page's image and download files while the HTML is built."""

    def __init__(self, mc: Path, out: Path, slug: str):
        self.mc, self.out, self.slug = mc, out, slug
        self.files: dict[str, str] = {}

    def thumbs(self, folder: Path, key: str) -> list[tuple[str, tuple[int, int]]]:
        from PIL import Image
        got = []
        for i, f in enumerate(sorted(Path(folder).glob("slide-*.png")), 1):
            name = f"img/{key}-{i:02d}.jpg"
            im = Image.open(f).convert("RGB")
            im.thumbnail((THUMB, THUMB))
            im.save(self.out / name, "JPEG", quality=82, optimize=True)
            self.files[name] = str(self.out / name)
            got.append((name, im.size))
        return got

    def downloads(self, folder: Path, key: str, account: str = "", fmt: str = "") -> list[dict]:
        """The upload files from report.json (carousel: the PDF; image: the PNGs), copied under clear names."""
        rep = Path(folder) / "report.json"
        srcs = []
        if rep.is_file():
            srcs = [Path(folder) / Path(f).name for f in json.loads(rep.read_text()).get("files") or []]
        srcs = [s for s in srcs if s.is_file()] or sorted(Path(folder).glob("slide-*.png"))
        out = []
        for i, src in enumerate(srcs, 1):
            part = f"_{i}-of-{len(srcs)}" if len(srcs) > 1 else ""
            name = "_".join(x for x in (self.slug, key, account, fmt) if x) + part + src.suffix
            shutil.copyfile(src, self.out / "dl" / name)
            self.files["dl/" + name] = str(self.out / "dl" / name)
            out.append({"url": "dl/" + name, "name": name})
        return out


def strip(imgs, alt: str) -> str:
    if not imgs:
        return ""
    cls = "strip one" if len(imgs) == 1 else "strip"
    tags = "".join(f'<img src="{n}" width="{w}" height="{h}" loading="lazy" alt="{esc(alt)}, image {i}">'
                   for i, (n, (w, h)) in enumerate(imgs, 1))
    count = f'<p class="count">{len(imgs)} images, swipe</p>' if len(imgs) > 1 else ""
    return f'<div class="{cls}">{tags}</div>{count}'


def dl_row(files: list[dict], label: str) -> str:
    if not files:
        return ""
    links = "".join(f'<a class="btn" href="{esc(f["url"])}" download="{esc(f["name"])}">'
                    f'{esc(label if len(files) == 1 else f"{label} {i}")}</a>' for i, f in enumerate(files, 1))
    btn = f'<button type="button" class="btn dl" hidden data-files="{esc(json.dumps(files))}">{esc(label)}</button>'
    return f'<div class="dl-row">{links}{btn}<span class="dl-status" aria-live="polite"></span></div>'


def copy_block(heading: str, text: str, button: str, cls: str = "", first: bool = False) -> str:
    sub = "" if first else " sub"
    return (f'<div class="post-top{sub}"><p class="post-h">{heading}</p>'
            f'<button type="button" class="btn copy">{esc(button)}</button></div>'
            f'<div class="caption{(" " + cls) if cls else ""}">{esc(text)}</div>')


def review_chip(folder: Path) -> str:
    rv = Path(folder) / "review.json"
    if not rv.is_file():
        return ""
    st = str(json.loads(rv.read_text()).get("status", ""))
    return f' <span class="rv rv-{esc(st)}">review {esc(st)}</span>' if st else ""


def post_block(folder: Path, names: dict) -> tuple[str, str, str]:
    """(html, account id, display name) for a written post; empty when there is no post.md."""
    f = Path(folder) / "post.md"
    if not f.is_file():
        return "", "", ""
    p = parse_post(f)
    who = names.get(p["account"], p["account"])
    out, first = ['<div class="post">'], True
    if p["doc_title"]:
        out.append(copy_block("Document title (for the PDF upload)", p["doc_title"], "Copy title", "dt", first=True))
        first = False
    out.append(copy_block(f"Post for {esc(who)}{review_chip(folder)}", p["post"], "Copy post", first=first))
    if p["comment"]:
        out.append(copy_block("First comment", p["comment"], "Copy comment", "fc"))
    out.append("</div>")
    return "".join(out), p["account"], who


def tile(page: Page, c: dict, folder: Path | None, names: dict) -> str:
    s, prose = c.get("scores") or {}, c.get("prose") or {}
    imgs = page.thumbs(folder, c["id"]) if folder else []
    pb, account, who = post_block(folder, names) if folder else ("", "", "")
    dl = ""
    if folder and imgs:
        files = page.downloads(folder, c["id"], account, str(c.get("format") or ""))
        kind = "carousel PDF" if c.get("format") == "carousel" and files and files[0]["name"].endswith(".pdf") else "image"
        dl = dl_row(files, f"Download {kind}")
    rep = f'<p class="flag">Repeat: {esc(c["repeat_flag"])}</p>' if str(c.get("repeat_flag") or "").strip() else ""
    who_tag = f'<span class="who">{esc(who)}</span>' if who else ""
    details = [("Idea", c.get("idea")), ("Retain", prose.get("Retain")), ("Reward", prose.get("Reward")),
               ("Ask", prose.get("Ask")), ("Visual plan", prose.get("Visual plan")), ("Proof", prose.get("Proof")),
               ("Why picked", c.get("why_picked"))]
    dl_html = "".join(f"<dt>{k}</dt><dd>{esc(v)}</dd>" for k, v in details if v)
    idea_type = f' · {esc(c["idea_type"])}' if c.get("idea_type") else ""
    return f'''<article class="idea" id="{esc(c["id"])}">
<header class="idea-head"><span class="pid">{esc(c["id"])}</span><span class="fmt">{esc(c.get("format"))}</span>{who_tag}<span class="score" aria-label="total score">{esc(s.get("total"))}<small>/15</small></span></header>
<p class="hook">{esc(prose.get("Hook", ""))}</p>
{strip(imgs, c["id"])}{dl}
<p class="tags">{esc(c.get("bucket"))} · step {esc(c.get("step"))} · persona: {esc(c.get("persona"))}{idea_type}</p>
<p class="bars"><span>hook {esc(s.get("hook"))}</span><span>retain {esc(s.get("retain"))}</span><span>reward {esc(s.get("reward"))}</span><span>stands alone {esc(s.get("stands_alone"))}</span><span>true {esc(s.get("true"))}</span></p>
{rep}{pb}
<details><summary>Idea card</summary><dl>{dl_html}</dl></details>
</article>'''


def article_section(page: Page, mc: Path) -> str:
    art = mc / "article"
    out = []
    imgs, files = [], []
    for n in ARTICLE_IMAGES:
        if (art / n).is_dir():
            imgs += page.thumbs(art / n, f"article-{n}")
            files += page.downloads(art / n, f"article-{n}")
    if (art / "plan.md").is_file():
        plan = cards.load_plan(art / "plan.md")
        secs = "".join(f'<li><p class="sec-h">{esc(s["heading"])}'
                       + (f' <span class="fig">{esc(s["figure"])}</span>' if s["figure"] else "")
                       + f'</p><p class="sec-p">{esc(s["purpose"])}</p>'
                       f'<details><summary>Beats</summary><p class="sec-b">{esc(s["beats"])}</p></details></li>'
                       for s in plan["sections"])
        out.append('<div class="card">')
        if imgs:
            out.append(f"<h3>Cover and figures</h3>{strip(imgs, 'article')}{dl_row(files, 'Download image')}")
        out.append("<h3>Title options</h3><ol>" + "".join(f"<li>{esc(t)}</li>" for t in plan["titles"]) + "</ol>")
        out.append("<h3>Subtitle options</h3><ol>" + "".join(f"<li>{esc(t)}</li>" for t in plan["subtitles"]) + "</ol>")
        if plan.get("why"):
            out.append(f'<h3>Why this structure</h3><p style="margin:0">{esc(plan["why"])}</p>')
        out.append(f'<h3>Sections</h3><ul class="secs">{secs}</ul>')
        if plan.get("close"):
            out.append(f'<h3>Close</h3><p style="margin:0">{esc(plan["close"])}</p>')
        out.append("</div>")
    else:
        out.append('<p class="sec-note">No article plan.</p>')
    if (art / "article.html").is_file():
        body = (art / "article.html").read_text()
        body = re.sub(r"(?is)<script.*?</script>", "", body)
        body = re.sub(r"(?is)^.*<body[^>]*>|</body>.*$", "", body)
        out.append(f'<h3 class="sec-note">Article text{review_chip(art)}</h3><div class="card article-body">{body}</div>')
    return "".join(out)


def not_picked(rows: list[dict]) -> str:
    if not rows:
        return '<p class="sec-note">None.</p>'
    items = "".join(f'<li><span class="pid sm">{esc(r["id"])}</span><div><p class="np-idea">{esc(r["idea"])}</p>'
                    f'<p class="np-why">{esc(r["total"])}/15 · {esc(r["why"])}</p></div></li>' for r in rows)
    return f'<ul class="np">{items}</ul>'


def brand_colour(brand_dir: Path) -> str:
    f = Path(brand_dir) / "brand.json"
    try:
        cols = json.loads(f.read_text()).get("colours") or {}
    except (OSError, ValueError):
        return DEFAULT_BRAND
    first = next((v for v in cols.values() if isinstance(v, str) and re.match(r"^#[0-9a-fA-F]{6}$", v)), None)
    return first or DEFAULT_BRAND


def howto(st: str, slug: str) -> str:
    ids = "Reply in chat with the ids, for example <code>drop P10, use B2</code> or <code>article title 2</code>."
    if st == "ideas":
        return f"Ideas only, no visuals yet. {ids} When the ideas look right: <code>atomize-extract {esc(slug)} visuals</code>."
    if st == "visuals":
        return (f"Visuals are made and reviewed. No post text yet. Feedback on a visual works the same way, for example "
                f"<code>P04 slide 3: shorter label</code>. When they look right: <code>atomize-create {esc(slug)}</code>.")
    return ("Ready to post. Each post has its profile, the document title for carousels, the post and the first comment, "
            "each with a copy button, and the visual to download. The article is at the end.")


def build_review(mc: Path, template: Path | None = None) -> Path:
    mc = Path(mc).resolve()
    p = paths.atomize_paths(mc)
    slug = paths.video_slug(mc.parent)
    out = mc / "review"
    if out.exists():
        shutil.rmtree(out)
    (out / "img").mkdir(parents=True)
    (out / "dl").mkdir()
    page = Page(mc, out, slug)
    try:
        names = {a["id"]: a["name"] for a in acc.load_accounts(p["accounts"])} if "accounts" in p else {}
    except (OSError, ValueError):
        names = {}
    post_files = sorted((mc / "posts").glob("*/card.md"))
    posts = [cards.load(f) for f in post_files]
    backups = [cards.load(f) for f in sorted((mc / "backups").glob("*/card.md"))]
    cand = parse_candidates(mc / "candidates.md")
    np_rows = [r for r in cand if r["result"].lower() == "not picked"]
    st = stage(mc)
    fc = Counter(c.get("format") for c in posts)
    sections = [
        '<section id="posts"><h2>Posts</h2>' + "".join(tile(page, c, f.parent, names) for c, f in zip(posts, post_files)) + "</section>",
        '<section id="backups"><h2>Backups</h2><p class="sec-note">Used in stage 2 if a post fails. No visuals until then.</p>'
        + "".join(tile(page, c, None, names) for c in backups) + "</section>",
        '<section id="article"><h2>Article</h2>' + article_section(page, mc) + "</section>",
        '<section id="not-picked"><h2>Not picked</h2>' + not_picked(np_rows) + "</section>",
    ]
    nav = "".join(f'<a href="#{k}">{v}</a>' for k, v in
                  (("posts", "Posts"), ("backups", "Backups"), ("article", "Article"), ("not-picked", "Not picked")))
    values = {
        "title": esc(f"{slug} review"),
        "brand": brand_colour(p["brand"]),
        "summary": f"{len(posts)} posts · {len(backups)} backups · article · {len(np_rows)} not picked",
        "formats": " · ".join(f"{fc[f]} {f}" for f in FORMAT_ORDER),
        "howto": howto(st, slug),
        "nav": nav,
        "sections": "\n".join(sections),
    }
    text = Path(template or TEMPLATE).read_text()
    text = re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m.group(1), m.group(0)), text)
    (out / "index.html").write_text(text)
    (out / "files.json").write_text(json.dumps(page.files, indent=2) + "\n")
    return out / "index.html"


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("usage: review.py MC", file=sys.stderr)
        return 2
    try:
        print(build_review(Path(args[0])))
    except (OSError, ValueError) as e:
        print(f"review.py: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
