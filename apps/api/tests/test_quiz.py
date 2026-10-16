"""D3: quiz scores are decided by the server, and the first answer is the one that counts."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_conn
from app.main import app
from app.services import study
from tests.conftest import make_token
from tests.fake_db import FakeDb

A, B = str(uuid.uuid4()), str(uuid.uuid4())
QUESTIONS = [
    {
        "q": f"Q{i}",
        "options": ["a", "b", "c", "d"],
        "answer": i % 4,
        "why": f"because {i}",
        "topic": f"Topic {i % 2}",
    }
    for i in range(5)
]


@pytest.fixture
def env() -> Iterator[tuple[TestClient, FakeDb, str]]:
    db = FakeDb({})
    cid = study.store_quiz(db, A, "s1", "Java", "en", QUESTIONS)["contentId"]  # type: ignore[arg-type]
    app.dependency_overrides[get_conn] = lambda: db
    yield TestClient(app), db, cid
    app.dependency_overrides.clear()


def post(client: TestClient, cid: str, q: int, choice: int, uid: str = A, **extra: Any) -> Any:
    return client.post(
        f"/api/v1/quiz/{cid}/answers",
        json={"q": q, "choice": choice, **extra},
        headers={"Authorization": f"Bearer {make_token(uid)}"},
    )


def test_server_grades_and_explains(env: tuple[TestClient, FakeDb, str]) -> None:
    client, _, cid = env
    right = post(client, cid, 1, 1).json()
    assert right["correct"] is True and right["why"] == "because 1"
    wrong = post(client, cid, 2, 0).json()
    assert wrong["correct"] is False and wrong["answer"] == 2


def test_first_answer_counts_so_peeking_cant_buy_a_perfect_score(
    env: tuple[TestClient, FakeDb, str],
) -> None:
    client, db, cid = env
    first = post(client, cid, 0, 3).json()  # wrong; the response reveals the right answer...
    again = post(
        client, cid, 0, first["answer"]
    ).json()  # ...and re-answering with it changes nothing
    assert again["correct"] is False and again["counted"] == 3
    for q in range(1, 5):
        last = post(client, cid, q, QUESTIONS[q]["answer"]).json()
    assert last["done"] is True and last["score"] == 4 and last["total"] == 5
    assert last["wrongTopics"] == ["Topic 0"]
    assert db.state["attempts"][-1]["score"] == 4  # the stored score is the server's


def test_try_again_starts_a_new_attempt(env: tuple[TestClient, FakeDb, str]) -> None:
    client, db, cid = env
    post(client, cid, 0, 3)
    r = post(client, cid, 0, 0, restart=True).json()
    assert r["correct"] is True and r["answered"] == 1
    assert len(db.state["attempts"]) == 2


def test_another_student_cannot_answer_or_read_my_quiz(env: tuple[TestClient, FakeDb, str]) -> None:
    client, _, cid = env
    assert post(client, cid, 0, 0, uid=B).status_code == 404


@pytest.mark.parametrize(
    "body", [{"q": 9, "choice": 0}, {"q": 0, "choice": 4}, {"q": 0, "choice": 1, "score": 5}]
)
def test_bad_or_tampered_bodies_are_refused(
    env: tuple[TestClient, FakeDb, str], body: dict[str, Any]
) -> None:
    client, db, cid = env
    r = client.post(
        f"/api/v1/quiz/{cid}/answers",
        json=body,
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.status_code == 422
    assert all(a["score"] == 0 for a in db.state["attempts"])
