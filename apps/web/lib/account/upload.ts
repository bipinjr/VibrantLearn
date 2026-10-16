// Real upload for a signed-in student (BUILD_PLAN C3, SECURITY.md §8):
// 1. ask the API for a one-time signed URL (it checks type, name, size and today's quota),
// 2. PUT the bytes straight to Storage (Vercel functions can't take bodies over 4.5 MB),
// 3. ask the API to verify the bytes and index the text.
// Every step reports progress; every failure becomes a sentence the file row can show.
import { api, ApiError } from "@/lib/api/client";
import type { StudyFile } from "@/lib/demo/data";

type UploadUrl = { file_id: string; upload_url: string; content_type: string; path: string };
type Processed = { file_id: string; status: "ready" | "failed" | "scanning" | "processing"; pages?: number | null; error?: string | null; duplicate?: boolean };

export type UploadUpdate = Partial<Pick<StudyFile, "status" | "progress" | "pages" | "error">> & { serverId?: string };

function put(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  // XHR, not fetch: fetch can't report upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export async function uploadFile(sessionId: string, file: File, update: (u: UploadUpdate) => void): Promise<void> {
  try {
    const slot = await api<UploadUrl>(`/sessions/${encodeURIComponent(sessionId)}/files/upload-url`, {
      method: "POST",
      body: JSON.stringify({ name: file.name, mime: file.type.slice(0, 200), size_bytes: file.size }),
    });
    update({ serverId: slot.file_id });
    await put(slot.upload_url, file, slot.content_type, (pct) => update({ progress: pct }));
    update({ status: "scanning", progress: 100 });
    const done = await api<Processed>(`/files/${encodeURIComponent(slot.file_id)}/process`, { method: "POST", body: JSON.stringify({}) });
    if (done.duplicate) update({ serverId: done.file_id });
    update(
      done.status === "failed"
        ? { status: "failed", error: done.error ?? "This file couldn't be read." }
        : { status: done.status === "ready" ? "ready" : "processing", pages: done.pages ?? undefined },
    );
  } catch (e) {
    update({
      status: "failed",
      error: e instanceof ApiError ? e.message : "The upload didn't finish. Check your connection and try again.",
    });
  }
}
