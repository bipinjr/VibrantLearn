"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { rupees } from "@/lib/api/classes";
import { nextPayoutDate } from "@/lib/api/live";
import { useTeach } from "@/components/teach/data";
import { EarningsCard } from "@/components/teach/parts";

const STATUS = { to_be_paid: "Ready to withdraw", requested: "Withdrawal requested", paid: "Paid" } as const;
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** T7: every class with gross, fee, net and status; a month filter; a statement for the ITR. */
export default function TeachEarnings() {
  const { earnings, setEarnings, teacher } = useTeach();
  const months = useMemo(() => {
    const keys = new Set((earnings?.classes ?? []).map((c) => c.starts_at.slice(0, 7)));
    return [...keys].sort().reverse();
  }, [earnings]);
  const [month, setMonth] = useState("all");
  if (!earnings) return null;
  const rows = earnings.classes.filter((c) => month === "all" || c.starts_at.startsWith(month));
  const sum = (k: "gross_paise" | "fee_paise" | "net_paise") => rows.reduce((n, c) => n + c[k], 0);

  function download() {
    const head = ["Date", "Class", "Students", "Gross (INR)", "Platform fee (INR)", "Net (INR)", "Status"];
    const lines = rows.map((c) => {
      return [
        DAY.format(new Date(c.starts_at)),
        `"${c.topic.replaceAll('"', '""')}"`,
        c.students,
        (c.gross_paise / 100).toFixed(2),
        (c.fee_paise / 100).toFixed(2),
        (c.net_paise / 100).toFixed(2),
        STATUS[c.status],
      ].join(",");
    });
    const title = `VibrantLearn earnings statement for ${teacher?.display_name ?? "teacher"}, ${month === "all" ? "all time" : MONTH.format(new Date(`${month}-01`))}`;
    const csv = [title, "", head.join(","), ...lines, "", `Total,,,${(sum("gross_paise") / 100).toFixed(2)},${(sum("fee_paise") / 100).toFixed(2)},${(sum("net_paise") / 100).toFixed(2)},`].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `vibrantlearn-earnings-${month}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-8 sm:px-8">
      <title>Earnings | VibrantLearn</title>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Earnings</h1>
      <EarningsCard earnings={earnings} onChange={setEarnings} />
      <section aria-labelledby="sched-h" className="rounded-[var(--radius-card)] border border-line p-5 text-sm">
        <h2 id="sched-h" className="font-semibold">How you get paid</h2>
        <p className="mt-1 text-muted">
          Request a withdrawal any time. Requests are paid by UPI or bank transfer on the 1st of each month: the next payout is{" "}
          <strong className="text-text">{DAY.format(nextPayoutDate())}</strong>. Each class pays {rupees(200_000)} minus the 20% platform fee. Tax
          deductions (TDS) start only once online payments are switched on, and we&rsquo;ll tell you first.
        </p>
      </section>
      <section aria-labelledby="per-h" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="per-h" className="text-xl font-bold">Per class</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="month" className="sr-only">Month</label>
            <select id="month" value={month} onChange={(e) => setMonth(e.target.value)} className="field w-auto">
              <option value="all">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>{MONTH.format(new Date(`${m}-01`))}</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={download} disabled={!rows.length}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" /> Download statement (CSV)
            </button>
          </div>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Earnings per class</caption>
              <thead className="bg-text/[0.04] text-left">
                <tr>
                  {["Date", "Class", "Students", "Gross", "Fee", "Net", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => {
                  return (
                    <tr key={c.class_id}>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{DAY.format(new Date(c.starts_at))}</td>
                      <td className="px-4 py-2.5">{c.topic}</td>
                      <td className="px-4 py-2.5 tabular-nums">{c.students}</td>
                      <td className="px-4 py-2.5 tabular-nums">{rupees(c.gross_paise)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{rupees(c.fee_paise)}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums">{rupees(c.net_paise)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{STATUS[c.status]}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-line font-semibold">
                <tr>
                  <td className="px-4 py-2.5" colSpan={3}>Total</td>
                  <td className="px-4 py-2.5 tabular-nums">{rupees(sum("gross_paise"))}</td>
                  <td className="px-4 py-2.5 tabular-nums">{rupees(sum("fee_paise"))}</td>
                  <td className="px-4 py-2.5 tabular-nums">{rupees(sum("net_paise"))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-muted">Each class you teach shows up here with what you earned.</p>
        )}
      </section>
    </div>
  );
}
