"""v0.5: the live-class rules, tested at the exact minutes they change."""

from datetime import UTC, datetime, timedelta

import pytest

from app.services.classes import Klass, payout, phase, seat_decision, settle_decision

START = datetime(2026, 10, 20, 12, 30, tzinfo=UTC)  # 6:00 PM IST
M = timedelta(minutes=1)
T = "teacher"


def klass(status: str = "scheduled", joined: datetime | None = None) -> Klass:
    return Klass("c1", T, START, 60, status, joined)


@pytest.mark.parametrize(
    ("at", "want"),
    [
        (START - 11 * M, "upcoming"),
        (START - 10 * M, "teacher_early"),
        (START - 1 * M, "teacher_early"),
        (START, "grace"),
        (START + 2 * M - timedelta(seconds=1), "grace"),
        (START + 2 * M, "open"),
        (START + 59 * M, "open"),
        (START + 60 * M, "ended"),
    ],
)
def test_phase_boundaries(at: datetime, want: str) -> None:
    assert phase(klass(), at) == want


def test_cancelled_and_done_stay_put() -> None:
    assert phase(klass("cancelled"), START + 5 * M) == "cancelled"
    assert phase(klass("done"), START - 30 * M) == "done"


# ---- settling --------------------------------------------------------------------------------


def test_fewer_than_10_interested_cancels_at_the_start() -> None:
    d = settle_decision(klass(), interested=9, students_joined=0, now=START)
    assert d.status == "cancelled" and "Fewer than 10" in (d.reason or "")
    assert (
        settle_decision(klass(), interested=9, students_joined=0, now=START - M).status
        == "scheduled"
    )


def test_ten_interested_runs() -> None:
    assert (
        settle_decision(
            klass(joined=START - 5 * M), interested=10, students_joined=0, now=START
        ).status
        == "scheduled"
    )


def test_teacher_no_show_cancels_with_a_warning_after_10_minutes() -> None:
    assert settle_decision(klass(), 25, 12, START + 9 * M).status == "scheduled"
    d = settle_decision(klass(), 25, 12, START + 10 * M)
    assert d.status == "cancelled" and d.warn_teacher and "didn't join" in (d.reason or "")


def test_a_class_that_ran_is_done_and_paid() -> None:
    d = settle_decision(klass(joined=START - 2 * M), 30, 28, START + 60 * M)
    assert d.status == "done" and d.pay_teacher and not d.warn_teacher


def test_no_students_turned_up_means_no_payout() -> None:
    d = settle_decision(klass(joined=START), 12, 0, START + 60 * M)
    assert d.status == "done" and not d.pay_teacher


def test_payout_is_2000_minus_20_percent() -> None:
    assert payout(30) == {
        "gross_paise": 200_000,
        "fee_paise": 40_000,
        "net_paise": 160_000,
        "students": 30,
    }


# ---- seats -----------------------------------------------------------------------------------


QUEUE = [f"s{i}" for i in range(1, 46)]  # 45 interested, in signup order


def test_doors_open_at_the_start_for_students() -> None:
    ok, why = seat_decision(klass(), "s1", START - M, QUEUE, set())
    assert not ok and "6:00 PM" in why


def test_grace_period_seats_the_first_40_interested_only() -> None:
    assert seat_decision(klass(), "s1", START, QUEUE, set()) == (True, "")
    assert seat_decision(klass(), "s40", START + M, QUEUE, set())[0] is True
    assert (
        seat_decision(klass(), "s41", START + M, QUEUE, set())[0] is False
    )  # 41st interested waits
    assert seat_decision(klass(), "walk-in", START + M, QUEUE, set())[0] is False


def test_after_grace_any_open_seat_goes_to_whoever_joins() -> None:
    seated = set(QUEUE[:30])
    assert seat_decision(klass(), "walk-in", START + 2 * M, QUEUE, seated) == (True, "")


def test_a_full_room_refuses_newcomers_but_keeps_seated_students() -> None:
    full = {f"x{i}" for i in range(40)}
    ok, why = seat_decision(klass(), "walk-in", START + 5 * M, QUEUE, full)
    assert not ok and "full (40" in why
    assert seat_decision(klass(), "x3", START + 5 * M, QUEUE, full) == (
        True,
        "",
    )  # rejoin after a drop


def test_grace_reserves_seats_for_interested_who_havent_arrived() -> None:
    # Late interested students still get their reserved seat in grace.
    seated = set(QUEUE[:35])
    assert seat_decision(klass(), "s36", START + M, QUEUE, seated)[0] is True
    assert seat_decision(klass(), "s41", START + M, QUEUE, seated)[0] is False


def test_nobody_joins_a_finished_class() -> None:
    assert seat_decision(klass(), "s1", START + 60 * M, QUEUE, set())[0] is False
    assert seat_decision(klass("cancelled"), "s1", START + 5 * M, QUEUE, set())[0] is False
