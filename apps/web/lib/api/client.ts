import { createClient } from "@/lib/supabase/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type ErrorBody = { error?: { code?: unknown; message?: unknown } };

/** Typed fetch for /api/v1 (same origin via rewrite). Attaches the user's access token. */
export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.auth !== false) {
    const { data } = await createClient().auth.getSession();
    if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "offline", "Couldn't reach VibrantLearn. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ErrorBody | null)?.error;
    const message =
      typeof err?.message === "string" ? err.message : "Something failed on our side. Try again in a minute.";
    throw new ApiError(res.status, typeof err?.code === "string" ? err.code : "unknown", message);
  }
  return body as T;
}
