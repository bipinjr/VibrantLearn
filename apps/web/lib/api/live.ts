// TEACHER.md T2-T10 and student rewards: typed calls to /api/v1. Rules live on the server.
import { api } from "./client";

export type Demand = {
  subject: string;
  students: number;
  within_48h: number;
  soonest_at: string;
  weak_topics: { topic: string; students: number }[];
  yours: boolean;
  est_net_paise: number;
};
export type SyllabusTopic = { id: string; unit: number; unit_title: string; topic: string };
export type Person = { user_id: string; username: string; joined_at: string; removed: boolean };
export type ClassSummary = {
  phase: string;
  interested: number;
  attended: number;
  rating: number | null;
  ratings: number;
  payout: { gross_paise: number; fee_paise: number; net_paise: number; status: string } | null;
  quiz_feedback: { topic: string; students: number; struggled: number }[];
};
export type PublicTeacher = {
  display_name: string;
  subjects: string[];
  bio: string;
  organisation: string;
  qualification: string;
  experience_years: number;
  languages: string[];
  verified: boolean;
  verified_since: string | null;
  classes_taught: number;
  attendance_rate: number | null;
  rating: number | null;
  ratings: number;
};
export type Warning = {
  id: number;
  at: string;
  reason: string;
  class_topic: string | null;
  class_at: string | null;
  appeal: { status: "open" | "upheld" | "removed"; outcome: string | null } | null;
};
export type Report = { id: number; at: string; reason: string; status: "open" | "actioned" | "dismissed"; outcome: string | null; class_topic: string | null };
export type Badge = { id: string; name: string; how: string; earned: boolean };
export type Rewards = { total: number; week: number; streak: number; studied_today: boolean; badges: Badge[]; on_leaderboard: boolean; rules: string };
export type Board = { week_start: string; board: { rank: number; username: string; points: number; me: boolean }[]; my_rank: number | null; players: number };
export type Cases = {
  appeals: { id: number; body: string; reason: string; email: string; at: string }[];
  reports: { id: number; reason: string; class_topic: string | null; reporter: string; reported: string | null; message: string | null; at: string }[];
};

const id = (x: string) => encodeURIComponent(x);
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const getDemand = () => api<{ demand: Demand[]; bucket_min: number }>("/teachers/demand");
export const getTopics = (subject: string) =>
  api<{ topics: SyllabusTopic[] }>(`/teachers/topics?subject=${id(subject)}`).then((r) => r.topics);
export const getPublicTeacher = (teacherId: string) =>
  api<{ teacher: PublicTeacher }>(`/teachers/${id(teacherId)}/public`).then((r) => r.teacher);
export const reschedule = (classId: string, startsAt: string) => api(`/classes/${id(classId)}/reschedule`, post({ starts_at: startsAt }));
export const runAgain = (classId: string, days = 7) => api<{ id: string }>(`/classes/${id(classId)}/repeat`, post({ days }));
export const getPeople = (classId: string) => api<{ people: Person[] }>(`/classes/${id(classId)}/people`).then((r) => r.people);
export const getSummary = (classId: string) => api<ClassSummary>(`/classes/${id(classId)}/summary`);
export const markAnswered = (classId: string, messageId: number) => api(`/classes/${id(classId)}/chat/${messageId}/answered`, { method: "POST" });
export const reportInClass = (classId: string, b: { reason: string; user_id?: string; message_id?: number }) =>
  api(`/classes/${id(classId)}/report`, post(b));
export const getHealth = () => api<{ warnings: Warning[]; reports: Report[] }>("/teachers/health");
export const appealWarning = (warningId: number, body: string) => api("/teachers/appeals", post({ warning_id: warningId, body }));
export const saveNotify = (b: { class_reminders: boolean; demand_alerts: boolean }) =>
  api("/teachers/notify", { method: "PUT", body: JSON.stringify(b) });
export const getCases = () => api<Cases>("/review/cases");
export const decideAppeal = (appealId: number, remove: boolean, outcome: string) => api(`/review/appeals/${appealId}`, post({ decision: remove, outcome }));
export const decideReport = (flagId: number, action: boolean, outcome: string) => api(`/review/reports/${flagId}`, post({ decision: action, outcome }));
export const getRewards = () => api<Rewards>("/me/rewards");
export const getBoard = () => api<Board>("/me/rewards/leaderboard");
export const setOptin = (on: boolean) => api("/me/rewards/optin", { method: "PUT", body: JSON.stringify({ on }) });

/** Next payout date: the 1st of next month (owner decision 2026-10-17), as a real date. */
export function nextPayoutDate(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
