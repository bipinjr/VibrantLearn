"""Request understanding without an LLM (PRD F5): normalise, entities, urgency, rule intent.

A line-for-line port of apps/web/lib/demo/parse.ts, checked against it by
tests/test_parity.py. JavaScript's `\\b` and `\\d` are ASCII-only, so every Latin pattern here
uses re.ASCII to behave the same next to Kannada and Devanagari letters.
"""

import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

Lang = Literal["en", "kn", "hi"]
Mode = Literal["sprint", "crash", "steady", "deep"]
INTENTS = (
    "make_plan",
    "ask_about_file",
    "summarize_file",
    "important_questions",
    "make_quiz",
    "make_flashcards",
    "pyq_style",
    "explain_topic",
    "edit_plan",
    "smalltalk",
    "out_of_scope",
)

_A = re.ASCII
_DATA = Path(__file__).parent / "data"
IST = timedelta(minutes=330)


def _rx(pattern: str, flags: int = 0) -> re.Pattern[str]:
    return re.compile(pattern, _A | flags)


# ---- script and romanised Kannada/Hindi -> the Latin words the rules know ----------------------

_SCRIPT_WORDS: dict[str, str] = json.loads((_DATA / "script_words.json").read_text("utf-8"))
_ZW = re.compile("[‌‍]")
_SCRIPT_MAP = {_ZW.sub("", k): v for k, v in _SCRIPT_WORDS.items()}
_SCRIPT_RE = re.compile("|".join(re.escape(k) for k in sorted(_SCRIPT_MAP, key=len, reverse=True)))
_INDIC = re.compile("[ಀ-೿ऀ-ॿ]")


def _script_to_latin(s: str) -> str:
    n = r"(\d+(?:\.\d+)?)"
    c = r"(\d{1,2}(?::\d{2})?)"
    for pat, rep in (
        (rf"(?:ಬೆಳಿಗ್ಗೆ|ಬೆಳಗ್ಗೆ|सुबह)\s*{c}\s*(?:ಗಂಟೆಗೆ|बजे)?", r" \1 am "),
        (rf"(?:ಸಂಜೆ|ಮಧ್ಯಾಹ್ನ|शाम|दोपहर)\s*{c}\s*(?:ಗಂಟೆಗೆ|बजे)?", r" \1 pm "),
        (rf"{c}\s*(?:ಗಂಟೆಗೆ|बजे)", r" at \1 "),
        (rf"{n}\s*(?:ಗಂಟೆಯಲ್ಲಿ|ಗಂಟೆಗಳಲ್ಲಿ|घंटे में|घंटों में)", r" in \1 hours "),
        (rf"{n}\s*(?:ನಿಮಿಷದಲ್ಲಿ|ನಿಮಿಷಗಳಲ್ಲಿ|मिनट में)", r" in \1 min "),
        (rf"{n}\s*(?:ದಿನದಲ್ಲಿ|ದಿನಗಳಲ್ಲಿ|दिन में|दिनों में)", r" in \1 days "),
        (rf"{n}\s*(?:ವಾರದಲ್ಲಿ|ವಾರಗಳಲ್ಲಿ|हफ्ते में|हफ़्ते में|हफ्तों में)", r" in \1 weeks "),
    ):
        s = re.sub(pat, rep, s, flags=_A)
    s = _SCRIPT_RE.sub(lambda m: f" {_SCRIPT_MAP[m.group(0)]} ", s)
    return re.sub(r"\s+", " ", s).strip()


_ROMAN_WEEKDAYS = {
    "bhanuvara": "sunday", "somavara": "monday", "mangalavara": "tuesday", "budhavara": "wednesday",
    "guruvara": "thursday", "shukravara": "friday", "shanivara": "saturday",
    "ravivar": "sunday", "somvar": "monday", "mangalvar": "tuesday", "budhvar": "wednesday",
    "guruvar": "thursday", "shukravar": "friday", "shanivar": "saturday",
}  # fmt: skip
_ROMAN_WEEKDAY_RE = _rx(rf"\b({'|'.join(_ROMAN_WEEKDAYS)})\b", re.I)


def _roman_to_english(s: str) -> str:
    n = r"(\d+(?:\.\d+)?)\s*"
    c = r"(\d{1,2}(?::\d{2})?)\s*"
    at = "(?:gantege|ganteg|baje)"
    for body, rep in (
        (rf"(?:belige|beligge|belagge|subah|subha)\s+{c}{at}?", r"\1 am "),
        (rf"(?:sanje|madhyahna|shaam|sham|dopahar)\s+{c}{at}?", r"\1 pm "),
        (rf"{c}{at}", r"at \1 "),
        (rf"{n}(?:ganteyalli|gantealli|gante alli|ghante (?:mein|me|main)|ghanton mein)",
         r"in \1 hours "),
        (rf"{n}(?:nimishadalli|minute (?:mein|me)|min (?:mein|me))", r"in \1 min "),
        (rf"{n}(?:dinadalli|dina alli|dinagalalli|din (?:mein|me|main)|dino mein)", r"in \1 days "),
        (rf"{n}(?:varadalli|vaaradalli|hafte (?:mein|me|main)|hafton mein)", r"in \1 weeks "),
        (rf"{n}(?:dina|din)", r"\1 days "),
        (rf"{n}(?:vaara|vara|hafte|hafta)", r"\1 weeks "),
        (rf"{n}(?:tingalu|tingala|mahine|mahina)", r"\1 months "),
    ):  # fmt: skip
        s = re.sub(rf"\b{body}\b", rep, s, flags=_A | re.I)
    s = _ROMAN_WEEKDAY_RE.sub(lambda m: _ROMAN_WEEKDAYS[m.group(0).lower()], s)
    return re.sub(r"\s+", " ", s).strip()


def to_latin(text: str) -> str:
    """Native-script digits/words and romanised Kannada/Hindi -> plain English the rules know."""
    s = _ZW.sub("", unicodedata.normalize("NFC", text))
    s = re.sub("[೦-೯]", lambda m: str(ord(m.group(0)) - 0x0CE6), s)  # noqa: RUF001 - Indic digits on purpose
    s = re.sub("[०-९]", lambda m: str(ord(m.group(0)) - 0x0966), s)  # noqa: RUF001 - Indic digits on purpose
    if _INDIC.search(s):
        s = _script_to_latin(s)
    return _roman_to_english(s)


_KANGLISH = _rx(
    r"\b(nale|naale|naadidu|nadidu|ivattu|ide|idhe|illa|beku|bekagide|maadi|madi|maadu|madu|heli"
    r"|helu|helkodi|bagge|enu|yenu|yaake|hege|hegge|swalpa|tumba|gottilla|gothilla|artha|aagilla"
    r"|agilla|kashta|odbeku|odu|oduttini|saaku|alli|dalli|kodi|kodu|namaskara|prashne|prashnegalu"
    r"|mukhya|gantege|dinadalli|ganteyalli|belige|sanje|nanage|nange|nanna|nimma|hosa|hegiddira)\b"
)
_HINGLISH = _rx(
    r"\b(kal|parso|parson|hai|hain|kya|kaise|kyun|kyu|mujhe|mera|meri|mere|samjhao|samjha"
    r"|samjhaiye|batao|bataiye|karo|chahiye|nahi|nahin|aaj|raat|ghante|ghanta|hafte|mahine|mein"
    r"|padhai|padhna|yaad|sawal|sawaal|namaste|accha|acha|thoda|zaroori|jaruri|kitne|baje|subah"
    r"|shaam)\b"
)


def detect_roman_lang(text: str) -> Lang | None:
    """Kannada or Hindi written in English letters? 2 such words, or 1 in a short message."""
    s = text.lower()
    kn, hi = len(_KANGLISH.findall(s)), len(_HINGLISH.findall(s))
    need = 1 if len(s.split()) <= 4 else 2
    if kn >= need and kn > hi:
        return "kn"
    if hi >= need and hi > kn:
        return "hi"
    return None


# ---- deadlines (Asia/Kolkata) -------------------------------------------------------------------

WEEKDAYS = ("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")


def ist_at(base: datetime, day_offset: int, h: int, m: int = 0) -> datetime:
    """IST wall clock h:m on base's IST date + day_offset, as an aware UTC datetime."""
    local = (base + IST).date() + timedelta(days=day_offset)
    return (
        datetime(local.year, local.month, local.day, tzinfo=UTC)
        + timedelta(hours=h, minutes=m)
        - IST
    )


def _read_clock(s: str) -> tuple[int, int] | None:
    t = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", s, _A) or re.search(
        r"\bat\s+(\d{1,2})(?::(\d{2}))?\b", s, _A
    )
    if not t:
        return None
    h, m = int(t.group(1)), int(t.group(2) or 0)
    ampm = t.group(3) if t.re.groups >= 3 else None
    if ampm == "pm" and h < 12:
        h += 12
    if ampm == "am" and h == 12:
        h = 0
    if not ampm and h < 8:
        h += 12  # "at 5" for an exam means 5 PM
    return (h, m) if h < 24 and m < 60 else None


def parse_deadline(text: str, now: datetime) -> datetime | None:
    s = to_latin(text).lower()
    clock = _read_clock(s)
    ch, cm = clock or (10, 0)

    def day(offset: int) -> datetime:
        return ist_at(now, offset, ch, cm)

    if m := re.search(
        r"\bin\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|ghante|ganta|gante)\b", s, _A
    ):
        return now + timedelta(hours=float(m.group(1)))
    if m := re.search(r"\bin\s+(\d+)\s*(?:m|min|mins|minutes)\b", s, _A):
        return now + timedelta(minutes=int(m.group(1)))
    if re.search(r"day after tomorrow|parso|naadidu|nadidu", s):
        return day(2)
    if re.search(r"\b(tomorrow|tmrw|tmr|nale|naale|kal)\b", s, _A):
        return day(1)
    if re.search(r"\btonight\b|\bivattu raatri\b|\baaj raat\b", s, _A):
        return ist_at(now, 0, *(clock or (21, 0)))
    if re.search(r"\btoday\b|\bivattu\b|\baaj\b", s, _A) and clock:
        return day(0)
    if m := re.search(
        r"\bin\s+(\d+)\s*days?\b|\b(\d+)\s*days?\s*(?:left|later|baaki|alli)\b", s, _A
    ):
        return day(int(m.group(1) or m.group(2)))
    if m := re.search(r"\bin\s+(\d+)\s*weeks?\b|\b(\d+)\s*weeks?\b", s, _A):
        return day(7 * int(m.group(1) or m.group(2)))
    if m := re.search(r"\b(\d+)\s*months?\b", s, _A):
        return day(30 * int(m.group(1)))
    if m := re.search(r"\b(\d{1,2})/(\d{1,2})\b", s, _A):
        d, mo = int(m.group(1)), int(m.group(2))
        year = (now + IST).year
        try:
            target = datetime(year, mo, d, tzinfo=UTC) + timedelta(hours=ch, minutes=cm) - IST
            if target < now:
                target = datetime(year + 1, mo, d, tzinfo=UTC) + timedelta(hours=10) - IST
        except ValueError:
            return None
        return target
    for i, wd in enumerate(WEEKDAYS):
        if re.search(rf"\b{wd}|\b{wd[:3]}\b", s, _A):
            today = ((now + IST).weekday() + 1) % 7  # JS getUTCDay: Sunday = 0
            return day((i - today + 7) % 7 or 7)  # "monday" = the coming Monday
    return None


def mode_for(deadline: datetime, now: datetime) -> Mode:
    h = (deadline - now).total_seconds() / 3600
    if h <= 6:
        return "sprint"
    if h <= 72:
        return "crash"
    if h <= 24 * 28:
        return "steady"
    return "deep"


# ---- subjects, weak topics, intent -------------------------------------------------------------


@lru_cache
def _subject_patterns() -> list[tuple[re.Pattern[str], str]]:
    raw: dict[str, str] = json.loads((_DATA / "subject_aliases.json").read_text("utf-8"))
    return [(_rx(p), name) for name, p in raw.items()]


def find_subject(s: str) -> str | None:
    return next((name for rx, name in _subject_patterns() if rx.search(s)), None)


def weak_topics(text: str) -> list[str]:
    s = text.lower()
    m = re.search(
        r"([a-z][a-z ]{2,40}?)\s+(?:is |are )?(?:weak|difficult|hard|confusing|tough|kashta)\b",
        s,
        _A,
    ) or re.search(
        r"\b(?:weak (?:in|at)|struggle with|stuck on|confused about)\s+([a-z][a-z ]{2,40})", s, _A
    )
    if not m:
        return []
    stop = {"test", "exam", "internal", "with", "about"}
    return [w for w in re.split(r"[\s,]+", m.group(1)) if len(w) > 3 and w not in stop]


def rule_intent(s: str, deadline: datetime | None, hours: float | None, subject: str | None) -> str:
    """The TypeScript rules, kept as the fallback when the classifier is unsure."""

    def has(p: str) -> bool:
        return re.search(p, s, _A) is not None

    if has(r"\bquiz|\bmcq|test me|quiz me|rasaprashne"):
        return "make_quiz"
    if has(r"flash ?cards?|\bcards\b"):
        return "make_flashcards"
    if has(
        r"important q|imp q|likely q|\bpyq|previous year|questions? (from|for|on)|exam questions"
        r"|\bprashne|\bsawaa?l\b"
    ):
        return "important_questions"
    if has(
        r"@\S+\.(pdf|pptx|docx|txt|md|jpg|png|py)|\bin (my |the )?\w*\s?notes\b|\bunit ?\d+ notes\b"
    ):
        return "ask_about_file"
    if has(
        r"\bexplain|what is|what are|\bdefine|notes on|samjhao|samjha|artha|meaning of"
        r"|difference between|\b(bagge|heli|helkodi|batao|bataiye|enu|yenu)\b|kya (hai|hota)"
    ):
        return "explain_topic"
    if (
        deadline
        or has(
            r"\b(exam|test|internal|internals|sem|semester|plan|prepare|study|revision|ide|idhe|hai"
            r"|pariksha|odbeku|padhai)\b"
        )
        or hours
    ):
        return "make_plan"
    if has(r"^(hi|hey|hello|thanks|thank you|ok|okay|namaskara|namaste|hegiddira|kaise ho)\b"):
        return "smalltalk"
    return "explain_topic" if subject else "out_of_scope"


_H = "(?:h|hr|hrs|hours?|ghante|gante|ganta)"


@dataclass
class Parsed:
    text: str  # normalised Latin form, what every later step reads
    intent: str
    subject: str | None
    deadline: datetime | None
    hours: float | None
    language: Lang | None
    mode: Mode | None
    topic_hint: str | None
    weak: list[str] = field(default_factory=list)


def parse_request(text: str, now: datetime) -> Parsed:
    raw = unicodedata.normalize("NFC", text)
    s = unicodedata.normalize("NFKC", to_latin(text).lower())
    subject = find_subject(s)
    deadline = parse_deadline(s, now)
    no_deadline_phrase = re.sub(rf"\bin\s+\d+(?:\.\d+)?\s*{_H}\b", "", s, flags=_A)
    hm = re.search(rf"\b(\d+(?:\.\d+)?)\s*\+?\s*{_H}\b", no_deadline_phrase, _A)
    hours = float(hm.group(1)) if hm else None
    language: Lang | None
    if re.search("kannada|ಕನ್ನಡ", s):
        language = "kn"
    elif re.search("hindi|हिन्दी|हिंदी", s):
        language = "hi"
    elif "english" in s:
        language = "en"
    elif re.search("[ಀ-೿]", raw):
        language = "kn"
    elif re.search("[ऀ-ॿ]", raw):
        language = "hi"
    else:
        language = detect_roman_lang(raw)
    hint = re.search(
        r"(?:explain|what is|what are|define|notes on|about)\s+([a-z0-9 ,'-]{3,60})", s, _A
    )
    topic_hint = (
        re.sub(r"\b(in|from) (kannada|hindi|english)\b.*$", "", hint.group(1), flags=_A).strip()
        if hint
        else None
    )
    return Parsed(
        text=s,
        intent=rule_intent(s, deadline, hours, subject),
        subject=subject,
        deadline=deadline,
        hours=hours,
        language=language,
        mode=mode_for(deadline, now) if deadline else None,
        topic_hint=topic_hint,
        weak=weak_topics(text),
    )
