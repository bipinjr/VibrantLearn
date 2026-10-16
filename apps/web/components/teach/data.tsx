"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { listClasses, myTeaching, type Earnings, type LiveClass, type Teacher, type TeacherStats } from "@/lib/api/classes";
import type { Payout } from "@/lib/api/teachers";

export type Rules = {
  min_students: number;
  max_students: number;
  min_lead_min: number;
  gross_paise: number;
  net_paise: number;
  fee_percent: number;
};

type TeachData = {
  loaded: boolean;
  problem: string | null;
  teacher: Teacher | null;
  earnings: Earnings | null;
  stats: TeacherStats | null;
  payout: Payout | null;
  rules: Rules;
  promise: string;
  rooms: LiveClass[];
  reload: () => void;
  setEarnings: (e: Earnings) => void;
};

const DEFAULT_RULES: Rules = { min_students: 10, max_students: 40, min_lead_min: 30, gross_paise: 200_000, net_paise: 160_000, fee_percent: 20 };
const Ctx = createContext<TeachData | null>(null);

/** One fetch of the teacher's world, shared by Home, Rooms, Earnings and Profile; refreshed every
 * 30 s because rooms go live and fill up by the minute. */
export function TeachProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<TeachData, "reload" | "setEarnings">>({
    loaded: false,
    problem: null,
    teacher: null,
    earnings: null,
    stats: null,
    payout: null,
    rules: DEFAULT_RULES,
    promise: "Under review, usually within 2 days.",
    rooms: [],
  });

  const reload = useCallback(() => {
    myTeaching()
      .then(async (r) => {
        const rooms = r.teacher?.status === "verified" ? (await listClasses()).filter((c) => c.mine_teaching) : [];
        setState({
          loaded: true,
          problem: null,
          teacher: r.teacher,
          earnings: r.earnings,
          stats: r.stats,
          payout: r.payout,
          rules: (r as { rules?: Rules }).rules ?? DEFAULT_RULES,
          promise: r.review_promise ?? "Under review, usually within 2 days.",
          rooms,
        });
      })
      .catch((e) =>
        setState((s) => ({
          ...s,
          loaded: true,
          problem: e instanceof ApiError ? e.message : "Couldn't load your dashboard. Check your connection, then reload.",
        })),
      );
  }, []);

  useEffect(() => {
    reload();
    const id = window.setInterval(reload, 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const setEarnings = useCallback((earnings: Earnings) => setState((s) => ({ ...s, earnings })), []);
  return <Ctx.Provider value={{ ...state, reload, setEarnings }}>{children}</Ctx.Provider>;
}

export function useTeach(): TeachData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTeach outside TeachProvider");
  return v;
}
