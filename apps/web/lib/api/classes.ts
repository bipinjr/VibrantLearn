// Live classes (v0.5): typed calls to /api/v1. Every rule is decided on the server.
import { api } from "./client";

export type Phase = "upcoming" | "teacher_early" | "grace" | "open" | "ended" | "cancelled" | "done";

export type LiveClass = {
  id: string;
  subject: string;
  topic: string;
  level: "beginner" | "exam_prep" | "all";
  teacher: string;
  mine_teaching: boolean;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  phase: Phase;
  cancel_reason: string | null;
  interested: number;
  min_students: number;
  max_students: number;
  mine_interested: boolean;
  position: number | null;
  seated: boolean;
};

export type Teacher = { user_id: string; display_name: string; bio: string; subjects: string[]; status: "pending" | "verified" | "suspended" };
export type Earnings = {
  classes: { class_id: string; topic: string; starts_at: string; students: number; net_paise: number; status: "to_be_paid" | "paid" }[];
  to_be_paid_paise: number;
  paid_paise: number;
  warnings: number;
  warnings_to_suspend: number;
};
export type Room = { room_url: string; role: "teacher" | "student"; display_name: string; ends_at: string };

export const listClasses = () => api<{ classes: LiveClass[] }>("/classes").then((r) => r.classes);
export const setInterest = (id: string, on: boolean) =>
  api<{ interested: number; mine: boolean; position: number | null }>(`/classes/${encodeURIComponent(id)}/interest`, { method: on ? "PUT" : "DELETE" });
export const joinClass = (id: string) => api<Room>(`/classes/${encodeURIComponent(id)}/join`, { method: "POST" });
export const cancelClass = (id: string) => api(`/classes/${encodeURIComponent(id)}/cancel`, { method: "POST" });
export const myTeaching = () => api<{ teacher: Teacher | null; earnings: Earnings | null }>("/teachers/me");
export const applyToTeach = (b: { display_name: string; bio: string; subjects: string[] }) =>
  api<{ teacher: Teacher }>("/teachers/apply", { method: "POST", body: JSON.stringify(b) });
export const postClass = (b: { subject: string; topic: string; level: string; starts_at: string; duration_min: number }) =>
  api<{ id: string }>("/classes", { method: "POST", body: JSON.stringify(b) });

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** The room embed: Jitsi config travels in the URL fragment, so no third-party script runs on our page. */
export function jitsiSrc(room: Room): string {
  const cfg = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(room.display_name))}`,
  ];
  return `${room.room_url}#${cfg.join("&")}`;
}
