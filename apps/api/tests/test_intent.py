"""E2: the intent model loads safely, refuses a tampered file, and gets the basics right."""

import json
from pathlib import Path

import pytest

from app.ml import intent
from app.ml.parse import parse_request
from tests.test_parity import _dt

NOW = _dt("2026-10-08T15:00:00Z")


@pytest.fixture(autouse=True)
def fresh_model() -> None:
    intent._model.cache_clear()


@pytest.mark.parametrize(
    ("text", "want"),
    [
        ("quiz me on deadlock", "make_quiz"),
        ("summarise @dbms_unit2.pdf", "summarize_file"),
        ("nale java exam ide", "make_plan"),
        ("ನಾಳೆ ಜಾವಾ ಪರೀಕ್ಷೆ ಇದೆ", "make_plan"),
        ("pyq for dbms", "pyq_style"),
        ("replan from now", "edit_plan"),
        ("hi", "smalltalk"),
        ("ipl score today", "out_of_scope"),
        ("flashcards for joins", "make_flashcards"),
        ("normalization samjhao", "explain_topic"),
        ("dbms important questions", "important_questions"),
        ("in unit3 notes, what is inheritance", "ask_about_file"),
    ],
)
def test_classifies_common_requests(text: str, want: str) -> None:
    got, _ = intent.predict(text, parse_request(text, NOW).intent)
    assert got == want


def test_refuses_a_tampered_artifact(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = tmp_path / "intent-v1.joblib"
    fake.write_bytes(b"not the model we trained")
    meta = tmp_path / "intent-v1.json"
    meta.write_text(json.dumps({"sha256": "0" * 64}), "utf-8")
    monkeypatch.setattr(intent, "ARTIFACT", fake)
    monkeypatch.setattr(intent, "META", meta)
    assert intent._model() is None
    # The app keeps working on the rules alone.
    assert intent.predict("quiz me on stacks", "make_quiz") == ("make_quiz", 0.0)


def test_missing_artifact_falls_back_to_rules(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(intent, "META", tmp_path / "nope.json")
    assert intent.predict("anything", "out_of_scope") == ("out_of_scope", 0.0)
