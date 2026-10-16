"""Message in, study material out (ARCHITECTURE.md §2, steps 5-8). No LLM in here.

Port of apps/web/lib/demo/respond.ts. Where the reply needs the AI it says so (`open` for an
open question, `ai_notes` for a syllabus topic) and app/services/messages.py makes that call.
Everything else (plans, follow-ups, questions, quizzes, flashcards) is answered locally.
"""

import json
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from app.ml.parse import Lang, Parsed, mode_for, parse_deadline, parse_request, to_latin
from app.ml.scheduler import Topic, build_plan, priority

Block = dict[str, Any]
ServedFrom = Literal["ml", "cache", "llm"]
TopicsFor = Callable[[str], list[Topic]]
_A = re.ASCII


@lru_cache
def curated() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(
        (Path(__file__).parents[1] / "ml" / "data" / "curated.json").read_text("utf-8")
    )
    return data


@dataclass
class Ctx:
    now: datetime
    language: Lang
    subjects: Sequence[str]
    topics_for: TopicsFor
    session_subject: str | None = None
    pending: dict[str, Any] | None = None
    files: Sequence[dict[str, Any]] = ()  # {"name", "status"} of this session's files


@dataclass
class Reply:
    blocks: list[Block]
    served_from: ServedFrom = "ml"
    pending: dict[str, Any] | None = None
    plan: dict[str, Any] | None = None
    session_patch: dict[str, Any] = field(default_factory=dict)
    open: str | None = None  # ask the AI this, in `lang`
    lang: Lang | None = None
    ai_notes: Topic | None = None  # ask the AI for notes on this topic
    # ask the AI for questions/quiz/flashcards: (kind, subject, topics); the blocks hold the
    # syllabus-built version to keep if the AI is off or fails
    ai_study: tuple[str, str, list[Topic]] | None = None
    intent: str = "out_of_scope"


STARTERS = ["Java internal tomorrow 10am", "Explain normalization", "Quiz me on stacks"]


def short(s: str) -> str:
    return s.replace(" Programming", "").replace("Database Management Systems", "DBMS")


def _iso(d: datetime) -> str:
    ms = round(d.timestamp() * 1000)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms % 1000:03d}Z"


def _from_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def find_topic(ctx: Ctx, subject: str | None, hint: str | None) -> Topic | None:
    pool = (
        ctx.topics_for(subject) if subject else [t for s in ctx.subjects for t in ctx.topics_for(s)]
    )
    if not hint:
        return priority(pool)[0] if subject and pool else None
    words = [w for w in re.split(r"\W+", hint.lower(), flags=_A) if len(w) > 2]
    best: Topic | None = None
    score = 0

    def stem(w: str) -> str:
        return w[: max(4, len(w) - 2)]

    # Topic-name hits count double; ties go to the topic that carries more exam weight.
    for t in sorted(pool, key=lambda t: -t.weightage):
        name = t.topic.lower()
        rest = f"{t.unit_title} {' '.join(t.subtopics)}".lower()
        s = sum(2 if stem(w) in name else 1 if stem(w) in rest else 0 for w in words)
        if s > score:
            best, score = t, s
    if best:
        return best
    return priority(pool)[0] if subject and pool else None


def matches_syllabus(ctx: Ctx, hint: str) -> bool:
    words = [w for w in re.split(r"\W+", hint.lower(), flags=_A) if len(w) > 3]
    hay = " ".join(
        f"{t.unit_title} {t.topic} {' '.join(t.subtopics)}".lower()
        for s in ctx.subjects
        for t in ctx.topics_for(s)
    )
    return any(w[: max(4, len(w) - 2)] in hay for w in words)


def topic_note(t: Topic) -> dict[str, str]:
    """Syllabus summary note: the fallback when the AI is off or fails."""
    hand = curated()["notes"].get(t.topic)
    if hand:
        return {lang: hand[lang]["short"] for lang in ("en", "kn", "hi")}
    subs = ", ".join(t.subtopics)
    return {
        "en": f"{t.topic}: the key points are {subs}. This topic is in Unit {t.unit} ({t.unit_title}) of {t.subject} and comes up often in exams. Learn each definition first, then practise one example for every point.",  # noqa: E501
        "kn": f"{t.topic}: ಈ topic ನ ಮುಖ್ಯ ಅಂಶಗಳು {subs}. ಇದು {t.subject} ನ Unit {t.unit} ({t.unit_title}) ಗೆ ಸೇರಿದ್ದು, exam ನಲ್ಲಿ ಆಗಾಗ ಕೇಳಲಾಗುತ್ತದೆ. ಮೊದಲು ಪ್ರತಿಯೊಂದು ಅಂಶದ definition ಕಲಿಯಿರಿ, ನಂತರ ಪ್ರತಿ ಅಂಶಕ್ಕೂ ಒಂದು example ಅಭ್ಯಾಸ ಮಾಡಿ.",  # noqa: E501
        "hi": f"{t.topic}: इस topic के मुख्य points हैं {subs}। यह {t.subject} की Unit {t.unit} ({t.unit_title}) का हिस्सा है और exam में अक्सर पूछा जाता है। पहले हर point की definition याद करें, फिर हर point का एक example practice करें।",  # noqa: E501
    }


def questions_for(ctx: Ctx, subject: str, focus: Topic | None = None) -> list[dict[str, Any]]:
    ranked = priority(ctx.topics_for(subject))
    top = ([focus] + [t for t in ranked if t.topic != focus.topic])[:3] if focus else ranked[:3]

    def low(s: str) -> str:
        return s.lower()

    items: list[dict[str, Any]] = [
        {"marks": 2, "q": f"Define {re.sub(r'^the ', '', low(t.topic))}."} for t in top[:2]
    ]
    items += [
        {
            "marks": 5,
            "q": f"Explain {low(t.subtopics[0]) if t.subtopics else low(t.topic)} with an example.",
        }
        for t in top[:2]
    ]
    items.append(
        {
            "marks": 10,
            "q": f"Explain {low(top[0].topic)} in detail, "
            f"covering {low(', '.join(top[0].subtopics))}.",
        }
    )
    return items


def quiz_for(ctx: Ctx, subject: str) -> list[dict[str, Any]]:
    hand = curated()["quiz"].get(subject)
    if hand:
        return list(hand)
    topics = priority(ctx.topics_for(subject))[:5]
    others = ctx.topics_for(subject)
    out = []
    for i, t in enumerate(topics):
        right = t.subtopics[0]
        pool: list[str] = []
        for o in others:
            if o.topic != t.topic:
                pool += [x for x in o.subtopics if x not in pool]
        options = pool[i : i + 3]
        answer = i % 4
        options.insert(answer, right)
        out.append(
            {
                "q": f'Which of these belongs to "{t.topic}"?',
                "options": options[:4],
                "answer": answer,
                "why": f"{right} is part of {t.topic}, Unit {t.unit}.",
                "topic": t.topic,
            }
        )
    return out


def cards_for(ctx: Ctx, subject: str) -> list[dict[str, str]]:
    hand = curated()["flashcards"].get(subject)
    if hand:
        return list(hand)
    return [
        {"front": t.topic, "back": f"{' · '.join(t.subtopics)} (Unit {t.unit})"}
        for t in priority(ctx.topics_for(subject))[:6]
    ]


def _followup(text: str, chips: list[str]) -> Block:
    return {"type": "followup", "text": text, "chips": chips}


def open_question(text: str, lang: Lang | None) -> Reply:
    return Reply(
        served_from="llm",
        open=text,
        lang=lang,
        intent="out_of_scope",
        blocks=[
            _followup(
                "That one needs the AI model, which isn't available right now. I can already plan, explain your syllabus topics, quiz you and make flashcards:",  # noqa: E501
                ["Explain method overriding", "Quiz me on DBMS", "OS test in 2 days"],
            )
        ],
    )


LEAD = {
    "sprint": "Short on time, so this covers only the topics that carry the most marks, in 25-minute focus blocks, and ends with a quick mock quiz.",  # noqa: E501
    "steady": "A week-by-week path with a checkpoint every weekend and the last stretch kept for revision.",  # noqa: E501
    "deep": "Plenty of time: one unit at a time, weekend checkpoints, and three spaced revision loops before the exam.",  # noqa: E501
}


def plan_reply(p: dict[str, Any], ctx: Ctx) -> Reply:
    deadline = _from_iso(p["deadline"])
    mode = mode_for(deadline, ctx.now)
    hours = p.get("hours") or (
        (deadline - ctx.now).total_seconds() / 3600 if mode == "sprint" else 3
    )
    steps = build_plan(
        ctx.topics_for(p["subject"]),
        p["subject"],
        deadline,
        ctx.now,
        mode,
        f"p{round(ctx.now.timestamp() * 1000)}",
        hours,
        p.get("weak") or (),
    )
    blocks = [s for s in steps if s["kind"] == "block"]
    first = blocks[0] if blocks else None
    weak_note = (
        f" {first['title']} comes first because you said it's a weak spot."
        if p.get("weak") and first
        else ""
    )
    total = sum(s.get("minutes", 0) for s in blocks)
    if mode == "crash":
        size = f"about {round(total / 60)} hours" if total >= 90 else f"{total} minutes"
        noun = "block" if len(blocks) == 1 else "blocks"
        lead = f"{len(blocks)} {noun}, {size} in total, highest-mark topics first. I kept 11 PM to 6 AM free for sleep and added a checkpoint each day."  # noqa: E501
    else:
        lead = LEAD[mode]
    kind = "exam" if mode in ("steady", "deep") else "test"
    return Reply(
        intent="make_plan",
        plan={
            "subject": p["subject"],
            "deadline": p["deadline"],
            "mode": mode,
            "hours": hours,
            "steps": steps,
            "weak": list(p.get("weak") or ()),
        },
        session_patch={
            "title": f"{short(p['subject'])} {kind}",
            "subject": p["subject"],
            "deadline": p["deadline"],
            "mode": mode,
        },
        blocks=[{"type": "text", "text": lead + weak_note}],
    )


def continue_plan(p: dict[str, Any], ctx: Ctx) -> Reply:
    if not p.get("subject"):
        return Reply(
            intent="make_plan",
            pending={**p, "awaiting": "subject"},
            blocks=[_followup("Which subject is the exam for?", list(ctx.subjects[:6]))],
        )
    if not p.get("deadline"):
        return Reply(
            intent="make_plan",
            pending={**p, "awaiting": "deadline"},
            blocks=[
                _followup(
                    f"When is the {short(p['subject'])} exam?",
                    ["Tonight", "Tomorrow 10am", "In 3 days", "Next week", "In a month"],
                )
            ],
        )
    deadline = _from_iso(p["deadline"])
    if mode_for(deadline, ctx.now) == "crash" and not p.get("hours"):
        when = "tomorrow" if deadline - ctx.now < timedelta(hours=36) else "in a few days"
        return Reply(
            intent="make_plan",
            pending={**p, "awaiting": "hours"},
            blocks=[
                _followup(
                    f"Got it: {p['subject']}, {when}. How many hours can you study each day?",
                    ["2 hours", "3 hours", "4 hours", "5 hours"],
                )
            ],
        )
    return plan_reply(p, ctx)


def respond(text: str, ctx: Ctx, intent: str | None = None) -> Reply:
    """`intent` is the classifier's answer (app/ml/intent.py); the parser's rules otherwise."""
    s = to_latin(text).lower().strip()
    parsed: Parsed = parse_request(text, ctx.now)
    if intent:
        parsed.intent = intent

    if ctx.pending:
        p = dict(ctx.pending)
        awaiting = p.get("awaiting")
        if awaiting == "subject":
            p["subject"] = next((x for x in ctx.subjects if x.lower() == s), parsed.subject)
        if awaiting == "deadline":
            d = parse_deadline(
                s.replace("next week", "in 7 days").replace("in a month", "in 30 days"), ctx.now
            )
            p["deadline"] = _iso(d) if d else None
        if awaiting == "hours":
            m = re.search(r"\d+(\.\d+)?", s, _A)
            n = float(m.group(0)) if m else 0
            if 0 < n <= 16:
                p["hours"] = n
        if p.get(str(awaiting)):
            return continue_plan(p, ctx)
        if parsed.intent in ("make_plan", "smalltalk", "out_of_scope"):
            again = {"subject": "subject", "deadline": "exam date", "hours": "number of hours"}[
                str(awaiting)
            ]
            r = continue_plan({**p, str(awaiting): None}, ctx)
            if r.blocks and r.blocks[0]["type"] == "followup":
                r.blocks[0]["text"] = f"I didn't catch the {again}. {r.blocks[0]['text']}"
            return r

    subject = parsed.subject or ctx.session_subject
    lang: Lang = parsed.language or ctx.language

    if not re.search("[a-zಀ-೿ऀ-ॿ]{2,}", s):
        return Reply(
            blocks=[
                _followup(
                    "I didn't catch that. Tell me a subject and when the exam is, "
                    "or ask about a topic.",
                    STARTERS,
                )
            ]
        )
    if (
        re.search(
            r"\b(what can you do|what do you do|how (does|do) (this|it|you) work"
            r"|help me|^help$|features?)\b",
            s,
            _A,
        )
        and parsed.intent != "make_plan"
    ):
        return Reply(
            intent="smalltalk",
            blocks=[
                _followup(
                    "I can plan your study hours for an exam, explain topics in English, Kannada or Hindi, list the questions most likely to come, quiz you, make flashcards, and answer from notes you upload. Try one:",  # noqa: E501
                    [*STARTERS, "Flashcards for OS"],
                )
            ],
        )
    if re.search(r"^(thanks|thank you|thx|ty|tq|ok|okay|cool|great|nice|super|done)\b", s, _A):
        return Reply(
            intent="smalltalk",
            blocks=[
                {
                    "type": "text",
                    "text": "You're welcome. Tick off each block in your plan as you finish it, and ask me whenever you get stuck.",  # noqa: E501
                }
            ],
        )

    it = parsed.intent
    if it in ("make_plan", "edit_plan"):
        r = continue_plan(
            {
                "subject": subject,
                "deadline": _iso(parsed.deadline) if parsed.deadline else None,
                "hours": parsed.hours,
                "weak": parsed.weak,
                "awaiting": "subject",
            },
            ctx,
        )
        r.intent = it
        return r
    if it == "smalltalk":
        return Reply(
            intent=it,
            blocks=[
                _followup(
                    "Hi! Tell me your next test and when it is, and I'll plan the hours you have. Or ask me anything you're stuck on.",  # noqa: E501
                    STARTERS,
                )
            ],
        )
    if it == "out_of_scope":
        return open_question(text, lang)
    if it in ("ask_about_file", "summarize_file"):
        ready = [f for f in ctx.files if f.get("status") == "ready"]
        named = next(
            (
                f
                for f in ctx.files
                if f["name"].lower() in s or re.split(r"[_.]", f["name"].lower())[0] in s
            ),
            None,
        )
        if named and named.get("status") != "ready":
            return Reply(
                intent=it,
                blocks=[
                    {
                        "type": "text",
                        "text": f"{named['name']} is still being processed. Ask again in a moment and I'll answer from it.",  # noqa: E501
                    }
                ],
            )
        if not (named or ready):
            return Reply(
                intent=it,
                blocks=[
                    {
                        "type": "text",
                        "text": "This session has no notes yet. Attach a PDF, slides or photos with the clip button and ask again.",  # noqa: E501
                    }
                ],
            )
        # Grounded answers come from retrieval over the file's chunks (BUILD_PLAN C4); the
        # messages service handles that. Never pretend to quote a file here.
        return Reply(intent=it, open=text, lang=lang, served_from="llm", blocks=[])
    if it == "explain_topic":
        if not parsed.subject and not matches_syllabus(ctx, parsed.topic_hint or s):
            return open_question(text, lang)
        t = find_topic(ctx, subject, parsed.topic_hint or s)
        if not t:
            return open_question(text, lang)
        hand = t.topic in curated()["notes"]
        return Reply(
            intent=it,
            lang=lang,
            served_from="ml" if hand else "llm",
            ai_notes=None if hand else t,
            blocks=[{"type": "notes", "topic": t.topic, "text": topic_note(t), "lang": lang}],
        )
    if it in ("important_questions", "pyq_style"):
        if not subject:
            return Reply(
                intent=it,
                blocks=[
                    _followup(
                        "Which subject should the questions be from?",
                        [f"Important questions for {short(x)}" for x in ctx.subjects[:4]],
                    )
                ],
            )
        focus = find_topic(ctx, subject, parsed.topic_hint) if parsed.topic_hint else None
        title = focus.topic if focus else f"{short(subject)}: most likely questions"
        ranked = priority(ctx.topics_for(subject))
        pick = (
            ([focus] + [t for t in ranked if t.topic != focus.topic])[:3] if focus else ranked[:3]
        )
        return Reply(
            intent=it,
            lang=lang,
            ai_study=("pyq" if it == "pyq_style" else "important_questions", subject, pick),
            blocks=[
                {"type": "questions", "topic": title, "items": questions_for(ctx, subject, focus)}
            ],
        )
    if it in ("make_quiz", "make_flashcards"):
        subj = subject or (t.subject if (t := find_topic(ctx, None, s)) else None)
        quiz = it == "make_quiz"
        if not subj:
            ask = "Quiz on which subject?" if quiz else "Flashcards for which subject?"
            chip = "Quiz me on {}" if quiz else "Flashcards for {}"
            return Reply(
                intent=it,
                blocks=[_followup(ask, [chip.format(short(x)) for x in ctx.subjects[:4]])],
            )
        top = priority(ctx.topics_for(subj))
        if quiz:
            return Reply(
                intent=it,
                lang=lang,
                ai_study=("quiz", subj, top[:5]),
                blocks=[{"type": "quiz", "topic": short(subj), "questions": quiz_for(ctx, subj)}],
            )
        return Reply(
            intent=it,
            lang=lang,
            ai_study=("flashcards", subj, top[:6]),
            blocks=[
                {
                    "type": "flashcards",
                    "topic": f"{short(subj)} key terms",
                    "cards": cards_for(ctx, subj),
                }
            ],
        )
    return open_question(text, lang)
