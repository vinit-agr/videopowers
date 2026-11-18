"""Pull the numbers out of a piece of text, normalised so the gate can compare them with a card.

Rules (design 7.2): commas stripped; 10k -> 10000; $2M -> 2000000; "2.3 percent" -> 2.3%;
% stays on the number; ranges and arrows give both ends, and a % after the second end applies
to both; years count. Ignored: slide counters on their own line ("3 / 9"), list markers ("1."),
URLs, the video token, and digits glued to letters (Q3, H2) except k/M and ordinals (50th).
"""
from __future__ import annotations

import re
from decimal import Decimal

TOKEN = "{{VIDEO_POST_URL}}"
_NUM = r"\d{1,3}(?:,\d{3})+|\d+"
_RANGE_PCT = re.compile(rf"(?<![\d.,])({_NUM}(?:\.\d+)?)(\s*(?:→|->|–|—|-|\bto\b)\s*\$?)({_NUM}(?:\.\d+)?)%")
_TOKEN = re.compile(rf"(?<![A-Za-z0-9.,])\$?({_NUM})(?:\.(\d+))?(k|K|M)?(%)?")


def normalise(token: str) -> str:
    """'1,200' -> '1200', '5.0' -> '5', '10k' -> '10000', '$2M' -> '2000000', '2.30%' -> '2.3%'."""
    m = _TOKEN.fullmatch(token.strip())
    if not m:
        return token.strip()
    return _value(*m.groups())


def _value(whole: str, frac: str | None, mult: str | None, pct: str | None) -> str:
    d = Decimal(whole.replace(",", "") + ("." + frac if frac else ""))
    if mult in ("k", "K"):
        d *= 1000
    elif mult == "M":
        d *= 1_000_000
    s = format(d.normalize(), "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s + ("%" if pct else "")


def extract(text: str, allowed: list[str] | tuple = ()) -> set[str]:
    t = text.replace(TOKEN, " ")
    for a in allowed:
        t = re.sub(re.escape(a), " ", t, flags=re.I)
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"(\d)\s*per\s?cent\b", r"\1%", t, flags=re.I)
    lines = []
    for line in t.splitlines():
        if re.fullmatch(r"\s*\d+\s*/\s*\d+\s*", line):
            continue
        lines.append(re.sub(r"^\s*\d+[.)]\s+", "", line))
    t = "\n".join(lines)
    t = _RANGE_PCT.sub(lambda m: f"{m.group(1)}%{m.group(2)}{m.group(3)}%" if not m.group(1).endswith("%") else m.group(0), t)
    out: set[str] = set()
    for m in _TOKEN.finditer(t):
        after = t[m.end():m.end() + 3]
        if m.group(3) is None and m.group(4) is None:
            if re.match(r"(st|nd|rd|th)\b", after):
                pass
            elif after[:1].isalpha():
                continue
        elif m.group(3) and after[:1].isalpha():
            continue
        out.add(_value(*m.groups()))
    return out
