// All times shown in the student's clock (Asia/Kolkata). Fixed locale + zone so server and client
// render identical strings (no hydration mismatch).
const TZ = "Asia/Kolkata";
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function clock(isoOrDate: string | Date): string {
  return timeFmt.format(new Date(isoOrDate)).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
}

export function timeRange(start: string, end?: string): string {
  if (!end) return clock(start);
  const a = clock(start);
  const b = clock(end);
  // "9:30 PM – 10:15 PM" -> "9:30 – 10:15 PM" when both share the same half of the day
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

function dayDiff(target: Date, now: Date): number {
  const d = (x: Date) => Date.parse(`${ymd.format(x)}T00:00:00Z`);
  return Math.round((d(target) - d(now)) / 86_400_000);
}

/** "Tonight", "Tomorrow", "Thu, 12 Oct" */
export function dayLabel(iso: string, nowIso: string): string {
  const t = new Date(iso);
  const now = new Date(nowIso);
  const diff = dayDiff(t, now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(t));
  if (diff === 0) return hour >= 17 ? "Tonight" : "Today";
  if (diff === 1) return hour < 12 ? "Tomorrow morning" : "Tomorrow";
  return dayFmt.format(t);
}

/** Short countdown: "13 h 20 min", "3 days", "5 weeks" */
export function timeLeft(iso: string, nowIso: string): string {
  const ms = new Date(iso).getTime() - new Date(nowIso).getTime();
  if (ms <= 0) return "now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  const days = Math.round(h / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  return `${Math.round(days / 7)} weeks`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ago(iso: string, nowIso: string): string {
  const min = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** For use mid-sentence: "tonight", "tomorrow morning", but "Sun, 11 Oct" keeps its capitals. */
export function dayInline(iso: string, nowIso: string): string {
  const d = dayLabel(iso, nowIso);
  return /^(Tonight|Today|Tomorrow)/.test(d) ? d.toLowerCase() : d;
}
