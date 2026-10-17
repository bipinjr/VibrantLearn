// Live classes (v0.5): typed calls to /api/v1. Every rule is decided on the server.
import { api } from "./client";

export type Phase =
  | "upcoming"
  | "teacher_early"
  | "grace"
  | "open"
  | "ended"
  | "cancelled"
  | "done";

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
  my_rating: number | null;
  teacher_id: string;
  for_you: boolean;
};

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Slot = "5-6pm" | "6-7pm" | "7-8pm" | "8-9pm" | "9-10pm";
export type Level = "beginner" | "exam_prep" | "all";
export type TeacherProfile = {
  display_name: string;
  bio: string;
  subjects: string[];
  qualification: string;
  experience_years: number;
  languages: ("en" | "kn" | "hi")[];
  preferred_days: Day[];
  preferred_slots: Slot[];
  levels: Level[];
  organisation: string;
  institution_code: string;
};
export type Teacher = TeacherProfile & {
  user_id: string;
  status: "pending" | "verified" | "rejected" | "suspended";
  review_note: string | null;
  has_document: boolean;
  notify?: { class_reminders: boolean; demand_alerts: boolean };
};
export type TeacherStats = {
  classes_done: number;
  upcoming: number;
  cancelled: number;
  students_taught: number;
  avg_students: number;
  interested_total: number;
  rating: number | null;
  ratings: number;
  focused_subject: string | null;
};
export type Earnings = {
  classes: {
    class_id: string;
    topic: string;
    starts_at: string;
    students: number;
    net_paise: number;
    gross_paise: number;
    fee_paise: number;
    status: "to_be_paid" | "requested" | "paid";
  }[];
  to_be_paid_paise: number;
  requested_paise: number;
  paid_paise: number;
  warnings: number;
  warnings_to_suspend: number;
};
export type Room = {
  room_url: string;
  role: "teacher" | "student";
  display_name: string;
  ends_at: string;
};

export const listClasses = () =>
  api<{ classes: LiveClass[] }>("/classes").then((r) => r.classes);
export const setInterest = (id: string, on: boolean) =>
  api<{ interested: number; mine: boolean; position: number | null }>(
    `/classes/${encodeURIComponent(id)}/interest`,
    { method: on ? "PUT" : "DELETE" },
  );
export const joinClass = (id: string) =>
  api<Room>(`/classes/${encodeURIComponent(id)}/join`, { method: "POST" });
export const cancelClass = (id: string) =>
  api(`/classes/${encodeURIComponent(id)}/cancel`, { method: "POST" });
export const myTeaching = () =>
  api<{
    teacher: Teacher | null;
    earnings: Earnings | null;
    stats: TeacherStats | null;
    payout: { method: "upi" | "bank"; display: string } | null;
    review_promise?: string;
    documents?: { kind: "degree" | "staff_id" | "net_set" | "bed" | "tet" | "other"; uploaded_at: string }[];
  }>("/teachers/me");
export const applyToTeach = (b: TeacherProfile & { consent: true }) =>
  api<{ teacher: Teacher }>("/teachers/apply", {
    method: "POST",
    body: JSON.stringify(b),
  });
export const withdraw = () => api<{ earnings: Earnings }>("/teachers/withdraw", { method: "POST" });
export const rateClass = (id: string, stars: number) =>
  api<{ stars: number }>(`/classes/${encodeURIComponent(id)}/rating`, {
    method: "PUT",
    body: JSON.stringify({ stars }),
  });
export const postClass = (b: {
  subject: string;
  topic: string;
  level: string;
  starts_at: string;
  duration_min: number;
  topic_ids?: string[];
  seat_cap?: number;
}) =>
  api<{ id: string }>("/classes", { method: "POST", body: JSON.stringify(b) });

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN")}`;

/** The Jitsi room link. Config travels in the URL fragment. The video opens in its own tab: meet.jit.si
 * stops embedded calls after 5 minutes. Jitsi's own chat is hidden so every message goes through our
 * moderated class chat, and names are locked so nobody can rename themselves into an insult. */
export function jitsiSrc(room: Room): string {
  const buttons = [
    "microphone",
    "camera",
    "desktop",
    "raisehand",
    "tileview",
    "fullscreen",
    "hangup",
  ];
  const cfg = [
    "config.prejoinPageEnabled=false",
    "config.prejoinConfig.enabled=false",
    // Our room names are random 32-character codes, so the "unsafe name" banner is wrong here.
    "config.enableInsecureRoomNameWarning=false",
    "config.disableDeepLinking=true",
    "config.readOnlyName=true",
    `config.toolbarButtons=${encodeURIComponent(JSON.stringify(buttons))}`,
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(room.display_name))}`,
  ];
  return `${room.room_url}#${cfg.join("&")}`;
}

export type ChatMessage = {
  id: number;
  author: string;
  body: string;
  at: string;
  bot: boolean;
  mine: boolean;
  hidden: string | null;
  question?: boolean;
  answered?: boolean;
};
export type ChatState = {
  strikes: number;
  strikes_to_remove: number;
  removed: boolean;
};

export const readChat = (id: string, after: number) =>
  api<ChatState & { messages: ChatMessage[] }>(
    `/classes/${encodeURIComponent(id)}/chat?after=${after}`,
  );
export const sendChat = (id: string, body: string, isQuestion = false) =>
  api<ChatState & { message: ChatMessage }>(
    `/classes/${encodeURIComponent(id)}/chat`,
    { method: "POST", body: JSON.stringify({ body, is_question: isQuestion }) },
  );
