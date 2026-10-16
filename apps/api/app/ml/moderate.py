"""Live-class chat filter: the bot's first, local pass (no LLM for clear cases).

Terms live in data/moderation.json. Each Latin term becomes a pattern that survives the usual
dodges: repeated letters (fuuuck), one separator between letters (f.u.c.k, f u c k), leetspeak
(sh1t, @ss) and a masked letter (f*ck). Kannada/Devanagari terms match as plain substrings.
Contact details (phone, email, links, social handles) are blocked for students: off-platform
contact is how strangers reach minors. Teachers may share links, never phone numbers.

`soft` means "maybe rude": the caller asks the LLM, and allows the message if it can't.
"""

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

ORDER = ("threat", "hate", "sexual", "abuse")  # most serious first
_ZW = re.compile("[​-‏⁠﻿]")
_LEET = str.maketrans("0134578@$!", "oieastbasi")


@dataclass(frozen=True)
class Verdict:
    hide: bool
    category: str | None = None  # threat | hate | sexual | abuse | contact
    soft: bool = False


def _term(t: str, whole: bool) -> str:
    words = [" ?".join(f"(?:{re.escape(ch)}+|\\*)" for ch in w) for w in t.split()]
    return "(?<![a-z])" + " +".join(words) + ("(?![a-z])" if whole else "")


@lru_cache
def _rules() -> dict[str, tuple[re.Pattern[str] | None, tuple[str, ...]]]:
    data = json.loads(
        (Path(__file__).parent / "data" / "moderation.json").read_text(encoding="utf-8")
    )
    out: dict[str, tuple[re.Pattern[str] | None, tuple[str, ...]]] = {}
    for cat in (*ORDER, "soft"):
        d = data[cat]
        parts = [_term(t, False) for t in d["stems"]]
        parts += [_term(t, True) for t in d["words"] + d["phrases"]]
        out[cat] = (re.compile("|".join(parts)) if parts else None, tuple(d["script"]))
    return out


_DIGITS = re.compile(r"\+?\d[\d\s().-]{8,}\d")


def _phone(s: str) -> bool:
    """An Indian mobile number however it's spaced: 98450 12345, +91-98450-12345."""
    for m in _DIGITS.finditer(s):
        d = re.sub(r"\D", "", m.group(0))
        if (len(d) == 10 and d[0] in "6789") or (
            len(d) == 12 and d.startswith("91") and d[2] in "6789"
        ):
            return True
    return False


_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", re.I)
# Not .in/.io: Java's System.in and java.io are everyday class talk.
_LINK = re.compile(r"https?://|www\.|\b[\w-]+\.(?:com|net|org|ly|gg|xyz|link|co\.in)\b", re.I)
_SOCIAL = re.compile(
    r"\b(?:insta(?:gram)?|snap(?:chat)?|whats ?app|telegram|discord)\b.{0,20}(?:\bid\b|@|\bnumber\b|\bno\b|\d)"
    r"|\bdm me\b|\bmy (?:number|insta|snap)\b",
    re.I,
)


def flatten(text: str) -> str:
    """Lowercase Latin skeleton: leetspeak undone, punctuation to single spaces, '*' kept."""
    s = _ZW.sub("", unicodedata.normalize("NFKC", text)).lower().translate(_LEET)
    return re.sub(r"[^a-z*ऀ-ॿಀ-೿]+", " ", s).strip()


def check(text: str, *, allow_links: bool = False) -> Verdict:
    native = _ZW.sub("", unicodedata.normalize("NFC", text))
    flat = flatten(text)
    rules = _rules()
    for cat in ORDER:
        rx, script = rules[cat]
        if (rx and rx.search(flat)) or any(t in native for t in script):
            return Verdict(True, cat)
    if _phone(native) or _EMAIL.search(native) or _SOCIAL.search(native):
        return Verdict(True, "contact")
    if not allow_links and _LINK.search(native):
        return Verdict(True, "contact")
    rx, script = rules["soft"]
    if (rx and rx.search(flat)) or any(t in native for t in script):
        return Verdict(False, soft=True)
    return Verdict(False)
