import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { UploadUpdate } from "./upload";

const api = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), api: (...a: unknown[]) => api(...a) }));

// A stand-in for XMLHttpRequest: reports two progress events, then succeeds (or fails).
let putStatus = 200;
const sent: { url: string; headers: Record<string, string> }[] = [];
class FakeXhr {
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  status = 0;
  private url = "";
  private headers: Record<string, string> = {};
  open(_m: string, url: string) {
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send() {
    sent.push({ url: this.url, headers: this.headers });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    this.status = putStatus;
    this.onload?.();
  }
}
vi.stubGlobal("XMLHttpRequest", FakeXhr);

const { uploadFile } = await import("./upload");
const file = new File(["%PDF-1.4 notes"], "Unit3_Inheritance.pdf", { type: "application/pdf" });

async function run(): Promise<UploadUpdate[]> {
  const seen: UploadUpdate[] = [];
  await uploadFile("s1", file, (u) => seen.push(u));
  return seen;
}

describe("real uploads for a signed-in student", () => {
  beforeEach(() => {
    api.mockReset();
    sent.length = 0;
    putStatus = 200;
  });

  it("signed URL -> PUT with the server's content type -> processed and ready", async () => {
    api
      .mockResolvedValueOnce({ file_id: "f1", upload_url: "https://x.supabase.co/storage/v1/object/upload/sign/p?token=t", content_type: "application/pdf", path: "u/s1/f1/unit3.pdf" })
      .mockResolvedValueOnce({ file_id: "f1", status: "ready", pages: 18 });
    const seen = await run();
    expect(sent[0].headers["Content-Type"]).toBe("application/pdf");
    expect(sent[0].headers["x-upsert"]).toBe("false");
    expect(seen).toEqual([{ serverId: "f1" }, { progress: 50 }, { progress: 100 }, { status: "scanning", progress: 100 }, { status: "ready", pages: 18 }]);
  });

  it("shows the API's own reason when it refuses the file", async () => {
    api.mockRejectedValueOnce(new ApiError(413, "file_too_large", "This file is over 50 MB. Split it into parts."));
    expect((await run()).at(-1)).toEqual({ status: "failed", error: "This file is over 50 MB. Split it into parts." });
    expect(sent).toEqual([]); // never uploaded
  });

  it("shows why the server rejected the bytes", async () => {
    api
      .mockResolvedValueOnce({ file_id: "f2", upload_url: "u", content_type: "application/pdf", path: "p" })
      .mockResolvedValueOnce({ file_id: "f2", status: "failed", error: "This file is a program, not notes." });
    expect((await run()).at(-1)).toEqual({ status: "failed", error: "This file is a program, not notes." });
  });

  it("a dropped connection during the upload is a plain retry message", async () => {
    putStatus = 500;
    api.mockResolvedValueOnce({ file_id: "f3", upload_url: "u", content_type: "application/pdf", path: "p" });
    expect((await run()).at(-1)?.status).toBe("failed");
  });

  it("a duplicate points the row at the file already processed", async () => {
    api
      .mockResolvedValueOnce({ file_id: "new", upload_url: "u", content_type: "application/pdf", path: "p" })
      .mockResolvedValueOnce({ file_id: "old", status: "ready", duplicate: true });
    const seen = await run();
    expect(seen).toContainEqual({ serverId: "old" });
    expect(seen.at(-1)).toMatchObject({ status: "ready" });
  });
});
