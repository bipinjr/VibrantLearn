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

/** A fresh access token. Background tabs (a class in the other tab) delay Supabase's timer-based
 * refresh, so a token can be expired when we read it: refresh when it has under a minute left. */
async function accessToken(force = false): Promise<string | null> {
  const auth = createClient().auth;
  const { data } = await auth.getSession();
  const s = data.session;
  if (!s) return null;
  if (force || (s.expires_at ?? 0) * 1000 - Date.now() < 60_000) {
    const { data: fresh } = await auth.refreshSession();
    return fresh.session?.access_token ?? null;
  }
  return s.access_token;
}

/** Typed fetch for /api/v1 (same origin via rewrite). Attaches the user's access token; on a 401
 * it refreshes the token once and retries, so a long class never ends in "Sign in again". */
export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const send = async (force: boolean) => {
    if (init.auth !== false) {
      const token = await accessToken(force);
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`/api/v1${path}`, { ...init, headers });
  };

  let res: Response;
  try {
    res = await send(false);
    if (res.status === 401 && init.auth !== false) res = await send(true);
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
