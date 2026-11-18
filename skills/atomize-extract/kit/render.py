#!/usr/bin/env python3
"""Render a visual from its slot file.

    python3 render.py <slots.json> [--out DIR] [--brand DIR] [--templates DIR]

slots.json: {"kind", "theme", "source", "slides": [{"template", "slots"}]}.
Writes visual.html, slide-NN.png (or .jpg if a PNG stays over 5 MB), carousel.pdf (carousels),
contact.png and report.json next to the slot file (or in --out). Exit 0 if the report is ok.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT))
import paths  # noqa: E402

def _find_chrome() -> str:
    """CHROME from the environment, else the usual install places, else a chrome on PATH."""
    import os
    import shutil
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium"):
        if Path(p).exists():
            return p
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        if shutil.which(name):
            return shutil.which(name)
    return "google-chrome"


CHROME = _find_chrome()
SIZES = {"portrait": (1080, 1350), "landscape": (1200, 675)}
SCALE = 2
CHUNK = 9
TIMEOUT = 60
MAX_IMAGE = 5 * 1024 * 1024
KINDS = {
    "infographic": dict(n=(1, 1), size="portrait"),
    "carousel": dict(n=(5, 10), size="portrait", first="title", last="ask"),
    "article-cover": dict(n=(1, 1), size="landscape", only="cover"),
    "article-figure": dict(n=(1, 1), size="landscape", only="figure"),
}
THEMES = ("light", "dark")
THEME_CLASS = {"purple": "dark"}  # an older name for the dark theme


# ---------- validation ----------

def _check_field(path: str, val, spec: dict, errors: list[str]) -> None:
    if "enum" in spec:
        if val not in spec["enum"]:
            errors.append(f"{path}: must be one of {spec['enum']}, got {val!r}")
    elif "range" in spec:
        lo, hi = spec["range"]
        if not isinstance(val, (int, float)) or not lo <= val <= hi:
            errors.append(f"{path}: must be a number {lo}-{hi}, got {val!r}")
    else:
        if not isinstance(val, str) or not val.strip():
            errors.append(f"{path}: must be non-empty text")
        elif len(_plain(val)) > spec["max"]:
            errors.append(f"{path}: {len(_plain(val))} characters, limit {spec['max']}")


def load_brand(brand_dir: Path) -> dict:
    """brand.json in the brand folder merged over the defaults; a missing file gives the defaults."""
    brand = json.loads(json.dumps(paths.BRAND_DEFAULTS))
    f = Path(brand_dir) / "brand.json"
    if f.is_file():
        brand.update(json.loads(f.read_text()))
    return brand


def validate(data: dict, templates: dict, themes: list[str] = THEMES) -> list[str]:
    errors: list[str] = []
    kind = data.get("kind")
    if kind not in KINDS:
        return [f"kind: must be one of {list(KINDS)}, got {kind!r}"]
    norm = lambda t: THEME_CLASS.get(t, t)
    if norm(data.get("theme", "light")) not in {norm(t) for t in themes}:
        errors.append(f"theme: must be one of {list(themes)}")
    if not str(data.get("source", "")).strip() and kind != "article-cover":
        errors.append("source: a source line is required")
    rule = KINDS[kind]
    slides = data.get("slides") or []
    lo, hi = rule["n"]
    if not lo <= len(slides) <= hi:
        errors.append(f"slides: {kind} needs {lo}-{hi} slides, got {len(slides)}")
    for i, sl in enumerate(slides):
        t = sl.get("template")
        p = f"slides[{i}]"
        if t not in templates:
            errors.append(f"{p}.template: unknown template {t!r}")
            continue
        spec = templates[t]
        if spec["size"] != rule["size"]:
            errors.append(f"{p}.template: {t} is {spec['size']}, {kind} needs {rule['size']}")
        if "only" in rule and t != rule["only"]:
            errors.append(f"{p}.template: {kind} uses {rule['only']}")
        if kind == "carousel" and i == 0 and t != rule["first"]:
            errors.append(f"{p}.template: a carousel starts with 'title'")
        if kind == "carousel" and i == len(slides) - 1 and t != rule["last"]:
            errors.append(f"{p}.template: a carousel ends with 'ask'")
        if kind != "carousel" and t in ("title", "ask"):
            errors.append(f"{p}.template: {t} is only for carousels")
        slots = sl.get("slots") or {}
        for name in slots:
            if name not in spec["slots"]:
                errors.append(f"{p}.{name}: not a slot of {t}")
        for name, s in spec["slots"].items():
            val = slots.get(name)
            if val in (None, "", []):
                if not s.get("optional"):
                    errors.append(f"{p}.{name}: required")
                continue
            if "list" in s:
                if not isinstance(val, list):
                    errors.append(f"{p}.{name}: must be a list")
                    continue
                a, b = s["list"]
                if not a <= len(val) <= b:
                    errors.append(f"{p}.{name}: needs {a}-{b} items, got {len(val)}")
                for j, item in enumerate(val):
                    for fname, fs in s["fields"].items():
                        fv = (item or {}).get(fname)
                        if fv in (None, ""):
                            if not fs.get("optional"):
                                errors.append(f"{p}.{name}[{j}].{fname}: required")
                            continue
                        _check_field(f"{p}.{name}[{j}].{fname}", fv, fs, errors)
            else:
                _check_field(f"{p}.{name}", val, s, errors)
        if "one_of" in spec:
            present = [k for k in spec["one_of"] if slots.get(k)]
            if len(present) != 1:
                errors.append(f"{p}: {t} needs exactly one of {spec['one_of']}, got {present}")
    return errors


# ---------- HTML ----------

def _plain(s: str) -> str:
    """Slot text without the *highlight* / **bold** markers."""
    return re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", str(s))


def fmt(s) -> str:
    t = html.escape(str(s))
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\*([^*]+)\*", r'<span class="scribble">\1</span>', t)
    return t


def fill(tpl: str, ctx: dict) -> str:
    """Tiny template language: {{name}}, {{.field}}, {{#list}}..{{/list}} (repeat or optional),
    {{?name}}..{{/?name}} (once if non-empty)."""
    def once(m):
        return fill(m.group(2), ctx) if ctx.get(m.group(1)) else ""
    tpl = re.sub(r"\{\{\?([\w.]+)\}\}(.*?)\{\{/\?\1\}\}", once, tpl, flags=re.S)

    def section(m):
        val = ctx.get(m.group(1))
        if not val:
            return ""
        if isinstance(val, list):
            out = []
            for n, item in enumerate(val, 1):
                sub = dict(ctx)
                for k, v in (item or {}).items():
                    sub["." + k] = v
                sub[".n"] = n
                out.append(fill(m.group(2), sub))
            return "".join(out)
        return fill(m.group(2), ctx)
    tpl = re.sub(r"\{\{#([\w.]+)\}\}(.*?)\{\{/\1\}\}", section, tpl, flags=re.S)

    def var(m):
        v = ctx.get(m.group(1))
        if v is None:
            return ""
        return str(v) if isinstance(v, (int, float)) else fmt(v)
    return re.sub(r"\{\{([\w.]+)\}\}", var, tpl)


BRAND_COLOURS = ("primary", "primary-mid", "primary-dark", "primary-line", "accent", "accent-light", "accent-dark", "heading", "body", "muted")


def brand_vars(brand: dict, brand_path: Path) -> str:
    """CSS variables from brand.json colours (only the names base.css uses) and the scribble image, if there is one."""
    out = ""
    for k, v in (brand.get("colours") or {}).items():
        if k in BRAND_COLOURS and re.match(r"^#[0-9a-fA-F]{3,8}$", str(v)):
            out += f"--{k}:{v};"
    if (brand_path / "scribble.png").is_file():
        out += f'--scribble:url("{(brand_path / "scribble.png").as_uri()}");'
    return out


def build_html(data: dict, templates_dir: Path, brand_dir: Path, brand: dict) -> str:
    brand_path = Path(brand_dir)
    size = KINDS[data["kind"]]["size"]
    theme = THEME_CLASS.get(data.get("theme", "light"), data.get("theme", "light"))
    n = len(data["slides"])
    single = data["kind"] != "carousel"
    logo = (f'<img src="{(brand_path / brand["logo"]).as_uri()}" alt="{html.escape(brand.get("name", ""), quote=True)}">'
            if brand.get("logo") else "")
    font = brand.get("font", "")
    parts = []
    for i, sl in enumerate(data["slides"]):
        ctx = dict(sl["slots"])
        if sl["template"] == "compare":
            ctx.setdefault("between", "vs")
        body = fill((templates_dir / f"{sl['template']}.html").read_text(), ctx)
        if data["kind"] == "article-cover":
            left = "<span></span>"
        elif single or i == n - 1:
            left = f'<span class="src">{html.escape(data["source"])}</span>'
        elif i == 0:
            left = '<span class="swipe">Swipe &rarr;</span>'
        else:
            left = f'<span class="pg">{i + 1} / {n}</span>'
        parts.append(
            f'<section class="slide {size} t-{theme}{" solo" if data["kind"] == "infographic" else ""}">'
            + (f'<img class="bg-art" src="{(brand_path / "hero-bg.svg").as_uri()}" alt="">' if (brand_path / "hero-bg.svg").is_file() else "")
            +             '<div class="wash1"></div><div class="wash2"></div><div class="glow"></div>'
            f'{body}<div class="foot">{left}{logo}</div>'
            "</section>")
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        + (f'<link rel="stylesheet" href="{(brand_path / "brand.css").as_uri()}">' if (brand_path / "brand.css").is_file() else "")
        + f'<link rel="stylesheet" href="{(templates_dir / "base.css").as_uri()}">'
        + f'<style>:root{{{brand_vars(brand, brand_path)}--brand-font:{json.dumps(font)}, sans-serif}}</style>'
        f'</head><body data-font="{html.escape(font, quote=True)}">' + "".join(parts)
        + f'<script src="{(templates_dir / "base.js").as_uri()}"></script></body></html>')


def slot_text(data: dict) -> tuple[str, str]:
    """All shown slot text plus the source line (for the gate), and the first headline."""
    lines: list[str] = []
    for sl in data["slides"]:
        for name, val in (sl.get("slots") or {}).items():
            if isinstance(val, list):
                for item in val:
                    for k, v in (item or {}).items():
                        if k not in ("pct", "tone", "mark") and v not in (None, ""):
                            lines.append(_plain(v))
            elif val not in (None, ""):
                lines.append(_plain(val))
    if data.get("kind") != "article-cover":
        lines.append(data.get("source", ""))
    first = data["slides"][0].get("slots", {}) if data.get("slides") else {}
    headline = _plain(first.get("headline") or first.get("quote") or first.get("question") or "")
    return "\n".join(lines), headline


# ---------- Chrome ----------

def _chrome(args: list[str]) -> subprocess.CompletedProcess:
    last = None
    for _ in range(2):
        try:
            r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                                "--allow-file-access-from-files", "--no-first-run", *args],
                               capture_output=True, timeout=TIMEOUT)
            if r.returncode == 0:
                return r
            last = RuntimeError(f"chrome exit {r.returncode}")
        except subprocess.TimeoutExpired as e:
            last = e
    raise RuntimeError(f"chrome failed twice: {last}")


def screenshot(html_path: Path, size: str, n: int, out: Path) -> list[Path]:
    w, h = SIZES[size]
    files: list[Path] = []
    with tempfile.TemporaryDirectory() as tmp:
        for start in range(1, n + 1, CHUNK):
            end = min(n, start + CHUNK - 1)
            shot = Path(tmp) / f"chunk{start}.png"
            _chrome([f"--force-device-scale-factor={SCALE}", "--virtual-time-budget=5000",
                     f"--window-size={w},{h * (end - start + 1)}", f"--screenshot={shot}",
                     f"{html_path.as_uri()}#s={start}-{end}"])
            img = Image.open(shot).convert("RGB")
            for k in range(end - start + 1):
                tile = img.crop((0, k * h * SCALE, w * SCALE, (k + 1) * h * SCALE))
                p = out / f"slide-{start + k:02d}.png"
                tile.save(p)
                if p.stat().st_size > MAX_IMAGE:
                    tile.save(p, optimize=True)
                if p.stat().st_size > MAX_IMAGE:
                    j = p.with_suffix(".jpg")
                    tile.save(j, quality=90)
                    p.unlink()
                    p = j
                files.append(p)
    return files


def dom_report(html_path: Path, size: str, n: int) -> dict:
    w, h = SIZES[size]
    for _ in range(2):
        r = _chrome(["--virtual-time-budget=5000", f"--window-size={w},{h * n}", "--dump-dom", html_path.as_uri()])
        m = re.search(r'<script type="application/json" id="report">(.*?)</script>', r.stdout.decode("utf-8", "replace"), re.S)
        if m:
            return json.loads(html.unescape(m.group(1)))
    raise RuntimeError("the page never wrote its report (fonts not ready?)")


def contact_sheet(files: list[Path], out: Path) -> Path:
    thumbs = []
    for f in files:
        im = Image.open(f).convert("RGB")
        thumbs.append(im.resize((540, round(im.height * 540 / im.width))))
    cols = min(3, len(thumbs))
    rows = (len(thumbs) + cols - 1) // cols
    th = max(t.height for t in thumbs)
    sheet = Image.new("RGB", (cols * 540 + (cols + 1) * 12, rows * th + (rows + 1) * 12), "#d9d4dd")
    for i, t in enumerate(thumbs):
        sheet.paste(t, (12 + (i % cols) * 552, 12 + (i // cols) * (th + 12)))
    p = out / "contact.png"
    sheet.save(p)
    return p


# ---------- main ----------

def render(slots_path: Path, out_dir: Path | None = None, brand_dir: Path | None = None,
           templates_dir: Path | None = None) -> dict:
    slots_path = Path(slots_path).resolve()
    out = Path(out_dir).resolve() if out_dir else slots_path.parent
    out.mkdir(parents=True, exist_ok=True)
    tdir = Path(templates_dir).resolve() if templates_dir else KIT / "templates"
    templates = json.loads((tdir / "templates.json").read_text())
    report = {"ok": False, "errors": [], "overflow": [], "font_ok": False, "files": [], "text": "", "headline": "", "source": ""}
    try:
        data = json.loads(slots_path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        report["errors"] = [f"slots file: {e}"]
        return _write(report, out)
    brand_path = Path(brand_dir).resolve() if brand_dir else paths.atomize_paths(slots_path)["brand"]
    brand = load_brand(brand_path)
    report["errors"] = validate(data, templates, brand["themes"])
    if report["errors"]:
        return _write(report, out)
    for old in list(out.glob("slide-*.png")) + list(out.glob("slide-*.jpg")) + [out / "carousel.pdf"]:
        old.unlink(missing_ok=True)
    html_path = out / "visual.html"
    html_path.write_text(build_html(data, tdir, brand_path, brand))
    size = KINDS[data["kind"]]["size"]
    n = len(data["slides"])
    report["text"], report["headline"] = slot_text(data)
    report["source"] = data.get("source", "")
    report["kind"] = data["kind"]
    try:
        dom = dom_report(html_path, size, n)
        report["overflow"], report["font_ok"] = dom["overflow"], dom["font_ok"]
        files = screenshot(html_path, size, n, out)
    except RuntimeError as e:
        report["errors"].append(str(e))
        return _write(report, out)
    if data["kind"] == "carousel":
        pages = [Image.open(f).convert("RGB") for f in files]
        pdf = out / "carousel.pdf"
        pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=144)
        report["files"] = [str(pdf)]
        report["slides"] = [str(f) for f in files]
    else:
        report["files"] = [str(f) for f in files]
    contact_sheet(files, out)
    if not report["font_ok"]:
        report["errors"].append(f"{brand['font']} did not load")
    report["ok"] = not report["errors"] and not report["overflow"]
    return _write(report, out)


def _write(report: dict, out: Path) -> dict:
    (out / "report.json").write_text(json.dumps(report, indent=2))
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("slots")
    ap.add_argument("--out")
    ap.add_argument("--brand")
    ap.add_argument("--templates")
    a = ap.parse_args()
    rep = render(Path(a.slots), a.out, a.brand, a.templates)
    out = Path(a.out) if a.out else Path(a.slots).parent
    print(out / "report.json")
    for e in rep["errors"] + rep["overflow"]:
        print("  " + e)
    return 0 if rep["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
