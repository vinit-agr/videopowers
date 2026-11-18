"""Idea cards: card.md = YAML front matter (fields scripts read) + prose sections."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

REQUIRED = ["id", "idea", "persona", "step", "bucket", "format", "product", "points_to_offer", "customer_story", "scores",
            "why_picked", "findings", "numbers", "sources", "excerpts", "real_moments", "said_in"]
OPTIONAL = ["idea_type", "repeat_flag"]
FORMATS = {"infographic", "carousel"}
SECTIONS = ["Hook", "Retain", "Reward", "Ask", "Proof", "Visual plan"]
ID_RE = re.compile(r"^(P(0[1-9]|1[0-5])|B[1-5])$")
FINDING_RE = re.compile(r"^F-[a-z0-9]+(-[a-z0-9]+)*$")
BAR = 10
FLOOR = 3
GATES = ("stands_alone", "true")
POINTS = ("hook", "retain", "reward")
FIGURES = ("figure-1", "figure-2", "figure-3")
TITLE_MAX = 60


def load(path: Path) -> dict:
    text = Path(path).read_text()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        raise ValueError(f"{path}: no YAML front matter")
    card = yaml.safe_load(m.group(1)) or {}
    prose: dict[str, str] = {}
    for sec in re.split(r"^## ", m.group(2), flags=re.M)[1:]:
        title, _, body = sec.partition("\n")
        prose[title.strip()] = body.strip()
    if isinstance(card.get("scores"), dict):  # YAML reads the bare key `true` as the boolean True
        card["scores"] = {("true" if k is True else k): v for k, v in card["scores"].items()}
    card["prose"] = prose
    card["path"] = str(Path(path).resolve())
    return card


def load_vocab(start: Path) -> dict:
    """Products (fenced `products` block in the profile file), buckets (first column of the `| Bucket |`
    table in the framework file) and idea types (lists.json)."""
    import json
    import paths
    p = paths.atomize_paths(start)
    profile = Path(p["profile"])
    m = re.search(r"^```products[ \t]*\n(.*?)^```", profile.read_text(), re.S | re.M)
    if not m:
        raise ValueError(f"{profile}: no fenced `products` block")
    products = {l.strip() for l in m.group(1).splitlines() if l.strip()}
    buckets: set[str] = set()
    in_table = False
    for line in Path(p["framework"]).read_text().splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")] if line.strip().startswith("|") else None
        if cells is None:
            in_table = False
        elif cells[0].lower() == "bucket":
            in_table = True
        elif in_table and not set(cells[0]) <= set("-: "):
            buckets.add(cells[0])
    lists = json.loads((Path(__file__).resolve().parent / "lists.json").read_text())
    return {"products": products, "buckets": buckets, "idea_types": set(lists["idea_types"])}


def _is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def scores_errors(scores: dict) -> list[str]:
    errs: list[str] = []
    if not isinstance(scores, dict):
        return ["scores: must be a mapping"]
    for k in (*GATES, *POINTS, "total"):
        if k not in scores:
            errs.append(f"scores: missing {k}")
    if errs:
        return errs
    for k in GATES:
        if scores[k] not in ("pass", "fail"):
            errs.append(f"scores: {k} must be pass or fail")
    for k in POINTS:
        if not _is_int(scores[k]) or not 1 <= scores[k] <= 5:
            errs.append(f"scores: {k} must be a whole number 1 to 5")
    if not _is_int(scores["total"]):
        errs.append("scores: total must be a whole number")
    elif not errs and scores["total"] != sum(scores[k] for k in POINTS):
        errs.append("scores: total is not hook + retain + reward")
    return errs


def passes_bar(scores: dict) -> bool:
    return (not scores_errors(scores) and all(scores[g] == "pass" for g in GATES)
            and scores["total"] >= BAR and all(scores[k] >= FLOOR for k in POINTS))


def _source_errors(card: dict) -> list[str]:
    """The source rules a card and an article plan share: source fields, and every number, excerpt and real
    moment pointing at a listed source. A missing list counts as empty."""
    errs: list[str] = []
    ids = set()
    for s in card.get("sources") or []:
        for k in ("id", "title", "year", "link", "tier", "file"):
            if k not in s:
                errs.append(f"sources: {s.get('id', '?')} missing {k}")
        ids.add(s.get("id"))
    for kind in ("numbers", "excerpts", "real_moments"):
        for e in card.get(kind) or []:
            if e.get("source") not in ids:
                errs.append(f"{kind}: unknown source {e.get('source')!r}")
            if kind == "numbers" and not str(e.get("value", "")).strip():
                errs.append("numbers: empty value")
            if kind != "numbers" and not str(e.get("text", "")).strip():
                errs.append(f"{kind}: empty text")
    return errs


def validate(card: dict, vocab: dict) -> list[str]:
    errs = [f"missing field: {k}" for k in REQUIRED if k not in card]
    if errs:
        return errs
    if not ID_RE.match(str(card["id"])):
        errs.append(f"id: {card['id']!r} is not P01-P15 or B1-B5")
    if card["format"] not in FORMATS:
        errs.append(f"format: {card['format']!r} not in {sorted(FORMATS)}")
    if card["bucket"] not in vocab["buckets"]:
        errs.append(f"bucket: {card['bucket']!r} not in {sorted(vocab['buckets'])}")
    if card["product"] not in vocab["products"]:
        errs.append(f"product: {card['product']!r} not in {sorted(vocab['products'])}")
    if card.get("idea_type") and card["idea_type"] not in vocab["idea_types"]:
        errs.append(f"idea_type: {card['idea_type']!r} not in {sorted(vocab['idea_types'])}")
    if not _is_int(card["step"]) or not 1 <= card["step"] <= 7:
        errs.append("step: must be a whole number 1 to 7")
    if not str(card["persona"] or "").strip():
        errs.append("persona: empty")
    for k in ("points_to_offer", "customer_story"):
        if not isinstance(card[k], bool):
            errs.append(f"{k}: must be true or false")
    if not str(card["idea"]).strip():
        errs.append("idea: empty")
    errs += scores_errors(card["scores"])
    if not card["findings"] or not isinstance(card["findings"], list):
        errs.append("findings: needs at least one finding id")
    else:
        for f in card["findings"]:
            if not FINDING_RE.match(str(f)):
                errs.append(f"findings: {f!r} is not an id like F-name-year-word")
    said_in = card["said_in"] or []
    for s in said_in:
        if not isinstance(s, dict) or not str(s.get("file", "")).strip() or not str(s.get("quote", "")).strip():
            errs.append("said_in: each entry needs file and quote")
    if not (card["numbers"] or card["excerpts"]) and not said_in:
        errs.append("said_in: a card with no numbers and no excerpts needs at least one quote from the video")
    errs += _source_errors(card)
    for sec in SECTIONS:
        if not card.get("prose", {}).get(sec):
            errs.append(f"prose: missing section '## {sec}'")
    return errs


def card_numbers(card: dict) -> set[str]:
    """Every number a piece made from this card may show: values, derived notes, source years, said_in quotes."""
    from numtok import extract
    out: set[str] = set()
    for n in card.get("numbers") or []:
        out |= extract(str(n.get("value", "")))
        out |= extract(str(n.get("derived", "")))
    for s in card.get("sources") or []:
        out |= extract(str(s.get("year", "")))
    # excerpts and real moments are checked word for word against their source files, so their numbers are sourced too
    for kind in ("excerpts", "real_moments"):
        for e in card.get(kind) or []:
            out |= extract(str(e.get("text", "")))
    for s in card.get("said_in") or []:
        out |= extract(str(s.get("quote", "")))
    return out


def load_plan(path: Path) -> dict:
    text = Path(path).read_text()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        raise ValueError(f"{path}: no YAML front matter")
    plan = yaml.safe_load(m.group(1)) or {}
    h2: dict[str, str] = {}
    for sec in re.split(r"^## ", m.group(2), flags=re.M)[1:]:
        title, _, body = sec.partition("\n")
        h2[title.strip()] = body.strip()

    def numbered(body: str) -> list[str]:
        return [x.group(1).strip() for x in re.finditer(r"^\d+\.\s+(.*\S)\s*$", body, re.M)]

    plan["titles"] = numbered(h2.get("Title options", ""))
    plan["subtitles"] = numbered(h2.get("Subtitle options", ""))
    plan["why"] = h2.get("Why this structure", "")
    plan["close"] = h2.get("Close", "")
    sections = []
    for blk in re.split(r"^### ", h2.get("Sections", ""), flags=re.M)[1:]:
        head, _, body = blk.partition("\n")
        sec = {"heading": re.sub(r"^\d+\.\s*", "", head.strip()), "purpose": "", "beats": "", "uses": "", "figure": ""}
        for line in body.splitlines():
            km = re.match(r"^(Purpose|Beats|Uses|Figure):\s*(.*)$", line.strip())
            if km:
                sec[km.group(1).lower()] = km.group(2).strip()
        sections.append(sec)
    plan["sections"] = sections
    plan["path"] = str(Path(path).resolve())
    return plan


def plan_figures(plan: dict) -> list[str]:
    out: list[str] = []
    for s in plan.get("sections") or []:
        f = s.get("figure", "")
        if f and f not in out:
            out.append(f)
    return out


def validate_plan(plan: dict) -> list[str]:
    errs: list[str] = []
    if plan.get("id") != "A01":
        errs.append(f"id: {plan.get('id')!r} is not A01")
    if plan.get("format") != "article":
        errs.append(f"format: {plan.get('format')!r} is not article")
    titles = plan.get("titles") or []
    if len(titles) < 2:
        errs.append("titles: needs at least 2 title options")
    for t in titles:
        if len(t) > TITLE_MAX:
            errs.append(f"titles: {t[:30]!r}... is over {TITLE_MAX} characters")
    if not plan.get("subtitles"):
        errs.append("subtitles: needs at least 1 subtitle option")
    if not str(plan.get("why") or "").strip():
        errs.append("plan: '## Why this structure' is empty")
    if not str(plan.get("close") or "").strip():
        errs.append("plan: '## Close' is empty")
    secs = plan.get("sections") or []
    if not secs:
        errs.append("sections: needs at least 1 section")
    for s in secs:
        for k in ("purpose", "beats"):
            if not s.get(k):
                errs.append(f"sections: {s.get('heading', '?')!r} has no {k}")
    figs = plan_figures(plan)
    if not 2 <= len(figs) <= 3 or any(f not in FIGURES for f in figs):
        errs.append(f"figures: needs 2 or 3 distinct figures named {', '.join(FIGURES)}; got {figs}")
    return errs + _source_errors(plan)


def handover_counts(n_pass: int, n_profiles: int) -> tuple[int, int] | None:
    """(posts, backups) to hand over for n_pass passing items and n_profiles profiles, or None if too few."""
    n, p = n_pass, n_profiles
    if n >= 4 * p:
        return 3 * p, p
    if n >= 3 * p:
        return 3 * p, n - 3 * p
    if n >= 2 * p:
        return 2 * p, n - 2 * p
    return None
