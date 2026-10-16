// Teacher onboarding and review (TEACHER.md T1). Every rule is checked by the API.
import { api } from "./client";

export type Payout = { method: "upi" | "bank"; display: string };
export type DocKind = "degree" | "staff_id" | "net_set" | "bed" | "tet" | "other";
export type TeacherDoc = { kind: DocKind; uploaded_at: string };

/** What a reviewer can check. Only the degree is required: most of our teachers teach college. */
export const DOC_KINDS: { kind: DocKind; label: string; hint: string; required?: boolean }[] = [
  { kind: "degree", label: "Degree certificate", hint: "Bachelor's or Master's. Confirms the subject you teach.", required: true },
  { kind: "staff_id", label: "College staff ID or appointment letter", hint: "If you teach at a college or school now." },
  { kind: "net_set", label: "UGC-NET or KSET certificate", hint: "College-level teaching eligibility." },
  { kind: "bed", label: "B.Ed., D.El.Ed. or equivalent", hint: "Teacher training." },
  { kind: "tet", label: "CTET or state TET scorecard", hint: "School-level teaching eligibility." },
  { kind: "other", label: "Anything else", hint: "Another certificate that shows you can teach this." },
];
export type ReviewItem = {
  user_id: string;
  display_name: string;
  email: string;
  organisation: string;
  qualification: string;
  experience_years: number;
  subjects: string[];
  bio: string;
  status: "pending" | "rejected";
  institution_code: string;
  documents: { kind: DocKind; url: string }[];
  review_note: string | null;
  submitted_at: string | null;
  document_url: string | null;
};

export const teachSubjects = () => api<{ subjects: string[] }>("/teachers/subjects").then((r) => r.subjects);

export const DOC_TYPES: Record<string, "pdf" | "jpg" | "png"> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Certificate or college ID: server-signed upload into the teacher's own private folder,
 * then the API checks the actual bytes before it counts. */
export async function uploadDocument(file: File, kind: DocKind = "degree"): Promise<void> {
  const ext = DOC_TYPES[file.type];
  if (!ext) throw new Error("Upload a PDF, JPG or PNG.");
  if (file.size > 5 * 1024 * 1024) throw new Error("That file is over 5 MB. Upload a smaller scan or photo.");
  const slot = await api<{ upload_url: string; path: string }>("/teachers/document/upload-url", {
    method: "POST",
    body: JSON.stringify({ ext }),
  });
  const put = await fetch(slot.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: file,
  });
  if (!put.ok) throw new Error("The upload didn't go through. Check your connection and try again.");
  await api("/teachers/document", { method: "POST", body: JSON.stringify({ path: slot.path, kind }) });
}

export const savePayout = (
  b: { method: "upi"; upi_id: string } | { method: "bank"; account_name: string; account_number: string; ifsc: string },
) => api<{ payout: Payout }>("/teachers/payout", { method: "PUT", body: JSON.stringify(b) }).then((r) => r.payout);

export const amReviewer = () => api<{ reviewer: boolean }>("/review/me").then((r) => r.reviewer);
export const reviewQueue = () => api<{ teachers: ReviewItem[] }>("/review/teachers").then((r) => r.teachers);
export const reviewTeacher = (id: string, decision: "verify" | "reject", note: string) =>
  api<{ status: string }>(`/review/teachers/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
