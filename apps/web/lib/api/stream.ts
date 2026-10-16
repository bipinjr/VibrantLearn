import { createClient } from "@/lib/supabase/client";

export type StreamEvent =
  | { event: "status"; data: { label: string } }
  | { event: "plan"; data: Record<string, unknown> }
  | { event: "session"; data: Record<string, unknown> }
  | { event: "block"; data: Record<string, unknown> }
  | { event: "done"; data: { messageId: string; servedFrom: "ml" | "cache" | "llm" } }
  | { event: "error"; data: { code: string; message: string } };

const KNOWN = new Set(["status", "plan", "session", "block", "done", "error"]);

/** Splits an SSE byte stream into parsed events. Exported for tests. */
export function parseEvents(buffer: string): { events: StreamEvent[]; rest: string } {
  const events: StreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    let name = "";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) name = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!KNOWN.has(name)) continue;
    try {
      events.push({ event: name, data: JSON.parse(data) } as StreamEvent);
    } catch {
      /* a malformed event is skipped, never shown */
    }
  }
  return { events, rest };
}

/**
 * POST /api/v1/sessions/{id}/messages and hand each server-sent event to `onEvent` as it arrives.
 * Errors before the stream starts (401, 404, 422, 429) come back as one `error` event with the
 * API's own student-readable message.
 */
export async function streamMessage(
  sessionId: string,
  body: { text: string; id: string; language?: string },
  onEvent: (e: StreamEvent) => void,
): Promise<void> {
  const { data } = await createClient().auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;

  let res: Response;
  try {
    res = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    onEvent({ event: "error", data: { code: "offline", message: "Couldn't reach VibrantLearn. Check your connection, then try again." } });
    return;
  }
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    onEvent({
      event: "error",
      data: { code: err?.error?.code ?? "unknown", message: err?.error?.message ?? "Something failed on our side. Try again in a minute." },
    });
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = parseEvents(buffer + value);
    buffer = rest;
    events.forEach(onEvent);
  }
}
