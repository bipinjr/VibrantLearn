"""Build data/intents.csv: labelled study requests for the intent model (BUILD_PLAN E1).

Synthetic on purpose: templates x real subjects, topics, time phrases and file names, in English,
Kanglish, Hinglish and native Kannada/Devanagari script. No student data. Seeded, so the file is
reproducible:

    uv run python data/build_intents.py

The honest test of the model is data/intents_holdout.csv, which is hand-written with phrasings
that do NOT come from these templates (see docs/ml-report.md).
"""

import csv
import random
from pathlib import Path

PER_INTENT = 70
rng = random.Random(20261016)

SUBJ = ["java", "Java", "dbms", "DBMS", "python", "OS", "operating systems", "CN", "computer networks",
        "data structures", "DS", "ಜಾವಾ", "जावा", "ಡಿಬಿಎಂಎಸ್", "पायथन"]  # fmt: skip
TOPIC = ["inheritance", "method overriding", "normalization", "deadlock", "stacks", "paging",
         "subnetting", "tuples", "polymorphism", "exception handling", "joins", "linked list",
         "TCP handshake", "semaphores", "interfaces", "BCNF", "queues", "OSI model", "lambda",
         "ಡೆಡ್‌ಲಾಕ್", "डेडलॉक", "ಓವರ್‌ರೈಡಿಂಗ್"]  # fmt: skip
WHEN = ["tomorrow", "tomorrow 10am", "in 2 hours", "in 3 days", "next monday", "on friday",
        "tonight", "in 2 weeks", "day after tomorrow", "nale", "naale belige 9 gantege",
        "3 dinadalli", "kal", "kal subah 10 baje", "parso", "2 ghante mein", "ನಾಳೆ", "कल",
        "on 15/11", "in 5 weeks", "in 2 months"]  # fmt: skip
FILE = ["unit3 notes", "@Unit3_Inheritance.pdf", "my notes", "my slides", "@dbms_unit2.pptx",
        "the pdf I uploaded", "@os-notes.docx", "chapter 4 notes", "@lab_programs.txt"]  # fmt: skip
N = ["2", "3", "4", "1.5", "5"]

T: dict[str, list[str]] = {
    "make_plan": [
        "{s} exam {w}",
        "{s} internal {w}, help me",
        "make a study plan for {s}, exam {w}",
        "{w} {s} test ide",
        "{w} {s} ka exam hai",
        "I have {n} hours, {s} test {w}",
        "{s} sem exam {w}, plan please",
        "{s} exam {w} ide, plan maadi",
        "{s} ki padhai ka plan chahiye, exam {w}",
        "help me prepare for {s} {w}",
        "timetable for {s} exam {w}",
        "{s} unit test {w}, {t} is weak",
        "ನಾಳೆ {s} ಪರೀಕ್ಷೆ ಇದೆ",
        "कल {s} की परीक्षा है",
        "{s} internals {w} and I haven't started",
        "exam {w} for {s}, I can study {n} hours a day",
        "{s} {w} exam, how should I study",
    ],
    "ask_about_file": [
        "in {f}, what is {t}",
        "{f} explain {t}",
        "what does {f} say about {t}",
        "{f} alli {t} bagge heli",
        "{f} mein {t} kya hai",
        "find {t} in {f}",
        "according to {f}, define {t}",
        "from {f}, how does {t} work",
        "{f} nalli {t} enu",
        "is {t} covered in {f}",
        "answer from {f}: what is {t}",
        "{f} padke {t} samjhao",
    ],
    "summarize_file": [
        "summarise {f}",
        "summary of {f}",
        "give me a short summary of {f}",
        "{f} summary kodi",
        "{f} ka summary do",
        "tl;dr {f}",
        "key points from {f}",
        "summarize {f} in kannada",
        "make short notes from {f}",
        "what is {f} about",
        "{f} saaramsha",
        "{f} ka saar batao",
    ],
    "important_questions": [
        "important questions for {s}",
        "{s} imp questions",
        "likely questions on {t}",
        "2 mark and 5 mark questions {s}",
        "{s} mukhya prashnegalu",
        "{s} ke important sawal",
        "what questions will come in {s} exam",
        "10 mark questions on {t}",
        "{t} important questions kodi",
        "{s} exam questions please",
        "which questions are important in {s} unit 3",
        "{t} pe important sawal batao",
    ],
    "make_quiz": [
        "quiz me on {t}",
        "{s} quiz",
        "test me on {t}",
        "mcq on {t}",
        "{t} mele quiz kodi",
        "{t} par quiz lo",
        "{s} ರಸಪ್ರಶ್ನೆ",
        "{s} क्विज़",
        "5 question quiz on {s}",
        "check if I know {t}",
        "give me mcqs for {s}",
        "{t} quiz please",
    ],
    "make_flashcards": [
        "flashcards for {t}",
        "make flash cards {s}",
        "{t} cards",
        "revision cards for {s}",
        "{s} flashcards kodi",
        "{t} ke flashcards banao",
        "flashcards to memorise {t}",
        "create cards for {s} definitions",
        "{t} flash cards please",
        "quick recall cards on {t}",
    ],
    "pyq_style": [
        "previous year questions {s}",
        "pyq for {s}",
        "questions like last year paper {s}",
        "past paper style questions on {t}",
        "{s} hindina varshada prashne",
        "{s} pichle saal ke questions",
        "model paper for {s}",
        "BCU style question paper {s}",
        "{t} pyq",
        "old question paper pattern {s}",
        "sample paper {s} like university exam",
        "{s} previous papers jaisa questions",
    ],
    "explain_topic": [
        "explain {t}",
        "what is {t}",
        "{t} bagge heli",
        "{t} samjhao",
        "define {t}",
        "difference between {t} and {t2}",
        "{t} ವಿವರಿಸಿ",
        "{t} समझाओ",
        "notes on {t} in kannada",
        "meaning of {t}",
        "how does {t} work",
        "{t} enu",
        "{t} kya hota hai",
        "teach me {t}",
        "{t} artha agilla",
        "explain {t} with an example",
    ],
    "edit_plan": [
        "move tomorrow's blocks to the evening",
        "I missed today's plan, replan",
        "change my plan to {n} hours a day",
        "add {t} to my plan",
        "remove {t} from the plan",
        "replan from now",
        "shift the quiz to sunday",
        "plan swalpa change maadi",
        "plan badlo, sirf {n} ghante hai",
        "I am behind schedule, fix my plan",
        "skip {t} in my timetable",
        "my exam got postponed to {w}, update the plan",
        "make my plan lighter",
        "I finished {t}, what next in my plan",
        "ivattu odakke aagilla, plan change maadi",
    ],
    "smalltalk": [
        "hi",
        "hello",
        "hey there",
        "thanks",
        "thank you so much",
        "namaskara",
        "namaste",
        "hegiddira",
        "kaise ho",
        "good morning",
        "ok",
        "okay cool",
        "who are you",
        "what can you do",
        "bye",
        "cool thanks",
        "nice",
        "super, thanks",
        "dhanyavaada",
        "shukriya",
        "good night",
        "how does this app work",
        "are you a bot",
        "ಧನ್ಯವಾದ",
        "धन्यवाद",
    ],
    "out_of_scope": [
        "who won the cricket match",
        "book a movie ticket",
        "what's the weather in bangalore",
        "tell me a joke",
        "ipl score today",
        "recommend a phone under 15000",
        "how to cook biryani",
        "bitcoin price",
        "how to hack wifi password",
        "write a love letter",
        "best place to visit in goa",
        "when is the next holiday",
        "song lyrics of kesariya",
        "ola cab booking",
        "who is the prime minister",
        "play some music",
        "train ticket to mysore",
        "netflix recommendations",
        "how to lose weight",
        "stock tips for tomorrow",
        "translate this whatsapp message",
        "nearest petrol bunk",
    ],
}


def fill(template: str) -> str:
    t, t2 = rng.sample(TOPIC, 2)
    return template.format(
        s=rng.choice(SUBJ), t=t, t2=t2, w=rng.choice(WHEN), f=rng.choice(FILE), n=rng.choice(N)
    )


def main() -> None:
    rows: list[tuple[str, str]] = []
    for intent, templates in T.items():
        seen: set[str] = set()
        # Every fixed template once, then random fills until PER_INTENT distinct lines.
        for tpl in templates:
            if "{" not in tpl:
                seen.add(tpl)
        tries = 0
        while len(seen) < PER_INTENT and tries < 5000:
            seen.add(fill(rng.choice(templates)))
            tries += 1
        for text in sorted(seen):
            rows.append((text, intent))
        # Casing/punctuation noise students actually produce.
        for text in rng.sample(sorted(seen), min(8, len(seen))):
            rows.append((text.upper() if rng.random() < 0.3 else text + " pls", intent))
    out = Path(__file__).parent / "intents.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "intent"])
        w.writerows(sorted(set(rows)))
    print(f"wrote {len(set(rows))} rows to {out}")


if __name__ == "__main__":
    main()
