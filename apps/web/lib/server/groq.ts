import "server-only";

// One place for every Groq call from the web app: server-only key, 20 s timeout, plain error codes.
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type GroqResult = { ok: true; text: string } | { ok: false; status: number; code: string; message: string } | { ok: false; status: 200; code: "not_configured"; message: string };

// Defaults are the models this project's Groq key can use (checked 2026-10-09 via /v1/models; the
// Llama models returned model_not_found). Override with GROQ_MODEL / GROQ_NOTES_MODEL.
export const CHAT_MODEL = "openai/gpt-oss-20b";
export const NOTES_MODEL = "openai/gpt-oss-120b";

export async function groqChat(messages: ChatMessage[], opts: { maxTokens: number; temperature: number; json?: boolean; model?: string; timeoutMs?: number; reasoning?: "low" | "medium" | "high" }): Promise<GroqResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, status: 200, code: "not_configured", message: "AI is not switched on." };
  const model = opts.model ?? process.env.GROQ_MODEL ?? CHAT_MODEL;
  try {
    const call = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      body: JSON.stringify({
        model,
        // gpt-oss models reason before answering; keep that short so answers stay fast and cheap.
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: opts.reasoning ?? "low" } : {}),
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });
    let res = await call();
    // Free-tier token limits reset within seconds: wait once if Groq says how long, then retry.
    const wait = Number(res.headers.get("retry-after"));
    if (res.status === 429 && wait > 0 && wait <= 15) {
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await call();
    }
    if (!res.ok) {
      // Status and Groq's error code only: never the key or the prompt.
      const err = (await res.json().catch(() => null)) as { error?: { code?: unknown; type?: unknown } } | null;
      console.warn(JSON.stringify({ event: "groq_error", status: res.status, code: err?.error?.code ?? err?.error?.type ?? null }));
    }
    if (res.status === 429) return { ok: false, status: 429, code: "llm_busy", message: "The AI is busy right now. Try again in a minute." };
    if (!res.ok) return { ok: false, status: 502, code: "llm_error", message: "The AI couldn't answer that just now. Try again." };
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return { ok: false, status: 502, code: "llm_empty", message: "The AI returned an empty answer. Try asking another way." };
    return { ok: true, text: text.trim() };
  } catch {
    return { ok: false, status: 504, code: "llm_timeout", message: "The AI took too long to answer. Try again." };
  }
}

// ponytail: in-memory limiter, fine for one process (local demo); production uses Postgres limits (SECURITY.md §11).
const hits = new Map<string, number[]>();
export function limited(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
