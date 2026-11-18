"""Find the content workspace (the folder holding videopowers.md) and the atomize paths in it."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

KEYS = {
    "profile": "profile",
    "framework": "framework",
    "product facts": "product_facts",
    "accounts": "accounts",
    "company voice": "company_voice",
    "brand": "brand",
    "videos": "videos",
    "ledger": "ledger",
    "findings": "findings",
    "posts": "posts",
    "personas": "personas",
    "scoring notes": "scoring_notes",
    "matching rules": "matching_rules",
    "quality bar": "quality_bar",
    "atomize feedback log": "feedback_log",
    "final-cut words": "final_cut_words_glob",
}

# These four have no default: a key with no line in videopowers.md is absent from the dict.
REQUIRED = {
    1: ["profile", "framework", "accounts", "company_voice"],
    2: ["profile", "accounts", "company_voice"],
}

BRAND_DEFAULTS = {"name": "", "logo": "", "font": "", "colours": {}, "themes": ["light", "dark"]}


def find_content_root(start: Path) -> Path:
    """Walk up from start to the folder that holds videopowers.md."""
    p = Path(start).resolve()
    if p.is_file():
        p = p.parent
    for d in [p, *p.parents]:
        if (d / "videopowers.md").is_file():
            return d
    raise FileNotFoundError(f"no videopowers.md above {start}")


def locate_content_root(cwd: Path) -> Path:
    """find_content_root(cwd), else the single videopowers.md found at most 3 levels below cwd."""
    try:
        return find_content_root(cwd)
    except FileNotFoundError:
        pass
    base = Path(cwd).resolve()
    found: list[Path] = []

    def walk(d: Path, depth: int) -> None:
        if (d / "videopowers.md").is_file():
            found.append(d)
        if depth >= 3:
            return
        try:
            kids = sorted(k for k in d.iterdir() if k.is_dir() and not k.name.startswith("."))
        except OSError:
            return
        for k in kids:
            walk(k, depth + 1)

    walk(base, 0)
    if len(found) == 1:
        return found[0]
    if not found:
        raise FileNotFoundError(f"no videopowers.md above or within 3 levels below {cwd}")
    raise FileNotFoundError(f"more than one videopowers.md below {cwd}: " + ", ".join(str(f) for f in found))


def atomize_paths(start: Path) -> dict[str, Path]:
    """Read the '- name: path' lines of videopowers.md (## Paths and ## Atomize) into absolute paths."""
    root = find_content_root(start)
    out: dict[str, Path] = {"root": root}
    for line in (root / "videopowers.md").read_text().splitlines():
        m = re.match(r"^- ([a-z -]+):\s*(\S+)", line.strip())
        if m and m.group(1) in KEYS:
            key = KEYS[m.group(1)]
            val = m.group(2)
            out[key] = val if key == "final_cut_words_glob" else root / val
    # a key with no line falls back to a file of that name at the top of the workspace, as for the other videopowers files
    out.setdefault("ledger", root / "ledger.csv")
    out.setdefault("findings", root / "findings.csv")
    out.setdefault("posts", root / "posts.csv")
    out.setdefault("scoring_notes", root / "scoring-notes.md")
    out.setdefault("matching_rules", root / "matching-notes.md")
    out.setdefault("quality_bar", root / "quality-bar-notes.md")
    out.setdefault("feedback_log", root / "atomize-feedback-log.md")
    out.setdefault("brand", root / "brand")
    out.setdefault("videos", root / "videos")
    if "profile" in out:
        out.setdefault("personas", out["profile"])
    return out


def missing_required(p: dict, stage: int) -> list[str]:
    """Required keys that are absent from p or whose file is missing, in REQUIRED order."""
    return [k for k in REQUIRED[stage] if k not in p or not Path(p[k]).exists()]


_NOTES = {
    "scoring_notes": ("Scoring notes", "What the scoring has taught so far; read before scoring and updated after each run."),
    "matching_rules": ("Matching notes", "What the matching has taught so far; read before matching posts to profiles."),
    "quality_bar": ("Quality bar notes", "What the quality checks have taught so far; read before writing and reviewing posts."),
}


def ensure_setup(p: dict) -> list[Path]:
    """Create any missing notes files and brand/brand.json. Never touches an existing file."""
    made: list[Path] = []
    for key, (title, purpose) in _NOTES.items():
        f = Path(p[key])
        if not f.exists():
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(f"# {title}\n\n{purpose}\n")
            made.append(f)
    brand = Path(p["brand"])
    bj = brand / "brand.json"
    if not bj.exists():
        brand.mkdir(parents=True, exist_ok=True)
        data = dict(BRAND_DEFAULTS)
        logos = sorted(f.name for f in brand.iterdir() if f.is_file() and "logo" in f.name.lower())
        data["logo"] = logos[0] if logos else ""
        bj.write_text(json.dumps(data, indent=2) + "\n")
        made.append(bj)
    return made


def find_post_dir(mc: Path, post_id: str, where: tuple[str, ...] = ("posts", "backups")) -> Path | None:
    """A01 -> mc/article; else the first <sub>/<post_id>-* in `where` order (plain or with the account)."""
    mc = Path(mc)
    if post_id == "A01":
        d = mc / "article"
        return d if d.is_dir() else None
    for sub in where:
        base = mc / sub
        if base.is_dir():
            hits = sorted(d for d in base.glob(f"{post_id}-*") if d.is_dir())
            if hits:
                return hits[0]
    return None


def _after_id(name: str) -> str:
    return re.sub(r"^[A-Z]+\d+-", "", name)


def folder_account(name: str, account_ids: list[str]) -> str | None:
    """'P01-acme-idea-p01' -> 'acme'; 'P01-idea-p01' -> None."""
    rest = _after_id(name)
    for a in account_ids:
        if rest.startswith(a + "-"):
            return a
    return None


def idea_slug(name: str, account_ids: list[str]) -> str:
    """'B1-acme-idea-b1' -> 'idea-b1'."""
    rest = _after_id(name)
    a = folder_account(name, account_ids)
    return rest[len(a) + 1:] if a else rest


def video_dir(slug_or_path: str, start: Path) -> Path:
    """Accept 'every-day-they-wait', '05-every-day-they-wait' or a path; return the video folder."""
    p = Path(slug_or_path)
    if p.is_dir():
        return p.resolve()
    videos = atomize_paths(start)["videos"]
    for d in sorted(videos.iterdir()):
        if d.is_dir() and (d.name == slug_or_path or re.sub(r"^\d+-", "", d.name) == slug_or_path):
            return d
    raise FileNotFoundError(f"no video folder for {slug_or_path} in {videos}")


def video_slug(video_folder: Path) -> str:
    """'05-every-day-they-wait' -> 'every-day-they-wait'."""
    return re.sub(r"^\d+-", "", Path(video_folder).name)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="paths.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    ck = sub.add_parser("check", help="check the video folder and the required workspace files")
    ck.add_argument("video", help="video slug or video folder path")
    ck.add_argument("--stage", type=int, choices=(1, 2), required=True)
    a = ap.parse_args(argv)
    try:
        if Path(a.video).is_dir():
            start = Path(a.video)
        else:
            start = locate_content_root(Path.cwd())
        p = atomize_paths(start)
        vd = video_dir(a.video, start)
    except FileNotFoundError as e:
        print(f"error: {e}")
        return 1
    print(f"video: {vd}")
    for f in ensure_setup(p):
        print(f"created: {f}")
    bad = 0
    for k in missing_required(p, a.stage):
        print(f"missing: {k} ({p.get(k, 'no line in videopowers.md')})")
        bad += 1
    if a.stage == 1 and not ((vd / "said.md").is_file() or (vd / "script.md").is_file()):
        print(f"missing: script ({vd / 'script.md'}, or said.md with the words of the final cut)")
        bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
