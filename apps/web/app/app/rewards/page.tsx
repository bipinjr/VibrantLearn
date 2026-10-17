"use client";

import { Award, Flame, Lock, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { ApiError } from "@/lib/api/client";
import { getBoard, getRewards, setOptin, type Board, type Rewards } from "@/lib/api/live";
import { useDemo } from "@/lib/demo/store";

/** Rewards: effort points, streaks, badges, and a weekly leaderboard you choose to join. */
export default function RewardsPage() {
  const { mode } = useDemo();
  const [r, setR] = useState<Rewards | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "account") return;
    Promise.all([getRewards(), getBoard()])
      .then(([a, b]) => {
        setR(a);
        setBoard(b);
      })
      .catch((e) => setProblem(e instanceof ApiError ? e.message : "Couldn't load your rewards."));
  }, [mode]);

  async function toggle() {
    if (!r) return;
    const on = !r.on_leaderboard;
    setR({ ...r, on_leaderboard: on }); // instant
    try {
      await setOptin(on);
      setBoard(await getBoard());
    } catch {
      setR({ ...r, on_leaderboard: !on });
    }
  }

  return (
    <PageTransition>
      <title>Rewards | VibrantLearn</title>
      <Main>
        <PageHeader title="Rewards" sub="Points for showing up and doing the work, never for marks. Streaks and badges keep the habit going." />
        {mode !== "account" ? (
          <p className="mt-8 text-muted">
            Rewards are saved to your account. <Link href="/signup">Create a free account</Link> to start earning them.
          </p>
        ) : problem ? (
          <p role="alert" className="mt-8 text-danger">{problem}</p>
        ) : !r || !board ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading rewards">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-28" />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-10">
            <section aria-label="Your points" className="grid gap-px overflow-hidden rounded-[var(--radius-sheet)] bg-line sm:grid-cols-3">
              <div className="bg-ink p-6 text-mist" data-theme="dark">
                <p className="flex items-center gap-2 text-sm text-mist/75">
                  <Flame size={16} aria-hidden="true" className="text-ember" /> Streak
                </p>
                <p className="mt-1 font-display text-5xl font-bold tabular-nums">{r.streak}</p>
                <p className="text-sm text-mist/75">{r.streak === 1 ? "day" : "days"} in a row{r.studied_today ? ", today counted" : ". Study today to keep it"}</p>
              </div>
              <div className="bg-surface p-6">
                <p className="text-sm text-muted">This week</p>
                <p className="mt-1 font-display text-5xl font-bold tabular-nums">{r.week}</p>
                <p className="text-sm text-muted">points since Monday</p>
              </div>
              <div className="bg-surface p-6">
                <p className="text-sm text-muted">All time</p>
                <p className="mt-1 font-display text-5xl font-bold tabular-nums">{r.total}</p>
                <p className="text-sm text-muted">points</p>
              </div>
            </section>
            <p className="-mt-6 text-sm text-muted">{r.rules}</p>

            <section aria-labelledby="badges-h">
              <h2 id="badges-h" className="text-2xl font-bold">Badges</h2>
              <ul className="stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {r.badges.map((b) => (
                  <li key={b.id} className={`lift flex items-start gap-3 rounded-[var(--radius-card)] border p-4 ${b.earned ? "border-leaf/50 bg-leaf/[0.06]" : "border-line opacity-70"}`}>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${b.earned ? "bg-leaf text-white" : "bg-text/10 text-muted"}`}>
                      {b.earned ? <Award size={20} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
                    </span>
                    <span>
                      <span className="block font-semibold">{b.name}</span>
                      <span className="text-sm text-muted">{b.earned ? b.how : `To earn: ${b.how.toLowerCase()}`}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="board-h">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="board-h" className="flex items-center gap-2 text-2xl font-bold">
                  <Trophy size={22} aria-hidden="true" className="text-now" /> This week&rsquo;s leaderboard
                </h2>
                <button type="button" role="switch" aria-checked={r.on_leaderboard} onClick={toggle} className="btn btn-secondary">
                  {r.on_leaderboard ? "Leave the leaderboard" : "Join the leaderboard"}
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">Only students who join appear, by username. Nobody sees your marks or topics.</p>
              {board.board.length === 0 ? (
                <p className="mt-4 text-muted">Nobody has joined this week&rsquo;s board yet. Be the first.</p>
              ) : (
                <ol className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line">
                  {board.board.map((x) => (
                    <li key={x.rank} className={`flex items-center justify-between gap-3 px-5 py-3 ${x.me ? "bg-violet/[0.07] font-semibold" : ""}`}>
                      <span className="flex items-center gap-4">
                        <span className={`w-6 text-right tabular-nums ${x.rank <= 3 ? "font-bold text-now" : "text-muted"}`}>{x.rank}</span>
                        {x.username}
                        {x.me ? <span className="text-sm font-normal text-muted">(you)</span> : null}
                      </span>
                      <span className="tabular-nums">{x.points}</span>
                    </li>
                  ))}
                </ol>
              )}
              {r.on_leaderboard && board.my_rank && board.my_rank > 20 ? (
                <p className="mt-2 text-sm text-muted">You&rsquo;re number {board.my_rank} of {board.players}.</p>
              ) : null}
            </section>
          </div>
        )}
      </Main>
    </PageTransition>
  );
}
