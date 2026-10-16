"""Live-class chat bot, local pass (app/ml/moderate.py)."""

import pytest

from app.ml.moderate import check

HIDE = [
    ("you are a fucking idiot", "abuse"),
    ("F.U.C.K this", "abuse"),
    ("fuuuuck", "abuse"),
    ("f*ck off", "abuse"),
    ("b1tch", "abuse"),
    ("teacher is a chutiya", "abuse"),
    ("bc madarchod", "abuse"),
    ("nin amman", "abuse"),
    ("boli maga yen madtiya", "abuse"),
    ("ನೀನು ಬೋಳಿಮಗ", "abuse"),
    ("तू चूतिया है", "abuse"),
    ("send nudes", "sexual"),
    ("you look sexy", "sexual"),
    ("i will kill you after class", "threat"),
    ("I'll kill you", "threat"),
    ("ninna saaysthini", "threat"),
    ("जान से मार दूंगा", "threat"),
    ("stop acting like a retard", "hate"),
    ("call me 98450 12345", "contact"),
    ("+91 9845012345", "contact"),
    ("mail me at abc.def@gmail.com", "contact"),
    ("join https://bit.ly/xyz", "contact"),
    ("my insta id is coolguy", "contact"),
    ("whatsapp 9845012345", "contact"),
]

FINE = [
    "Sir, can you explain method overriding again?",
    "I have an assignment on class inheritance",
    "Scanner sc = new Scanner(System.in);",
    "import java.io.*;",
    "kill the child process with SIGKILL",
    "how do I kill your process tree in Linux",
    "Scunthorpe is a town",
    "Charles Dickens wrote novels",
    "ನನಗೆ ಅರ್ಥ ಆಗಿಲ್ಲ, ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ",
    "kal subah 10 baje exam hai",
    "The shell script runs in grape.sh",
    "Randip, your mic is on",
    "Thanks sir, very helpful 🙏",
    "Unit 3 marks 10",
]


@pytest.mark.parametrize(("text", "category"), HIDE)
def test_hides_bad_messages(text: str, category: str) -> None:
    v = check(text)
    assert v.hide, text
    assert v.category == category, text


@pytest.mark.parametrize("text", FINE)
def test_allows_normal_class_talk(text: str) -> None:
    v = check(text)
    assert not v.hide, (text, v)
    assert not v.soft, (text, v)


@pytest.mark.parametrize("text", ["this topic is stupid", "shut up", "you are dumb", "ಹುಚ್ಚ"])
def test_rude_but_unclear_goes_to_the_llm(text: str) -> None:
    v = check(text)
    assert not v.hide and v.soft, text


def test_teachers_may_share_links_but_not_numbers() -> None:
    assert not check("Slides: https://example.com/unit3", allow_links=True).hide
    assert check("Slides: https://example.com/unit3").hide
    assert check("call 9845012345", allow_links=True).category == "contact"


def test_bot_notice_counts_up_then_removes() -> None:
    from app.services.class_chat import notice

    assert (
        notice("user.a", "abuse", 1)
        == "Hid a message from user.a: abusive language. Warning 1 of 3."
    )
    assert notice("user.a", "contact", 2).endswith("Warning 2 of 3.")
    assert notice("user.a", "threat", 3) == "Removed user.a from this class after 3 warnings."
