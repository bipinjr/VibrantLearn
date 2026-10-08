"use client";

import { createContext, startTransition, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Demo, Message, Plan, StudyFile } from "./data";
import { respond, type Pending, type Reply } from "./respond";
import { buildPlan } from "./scheduler";

type State = Demo & { pending: Record<string, Pending | null | undefined>; seen: string[] };
type Thinking = { sessionId: string; label: string } | null;

type Api = {
  state: State;
  now: Date;
  thinking: Thinking;
  fresh: Set<string>;
  send: (sessionId: string, text: string) => void;
  startSession: (text: string) => string;
  toggleStep: (planId: string, stepId: string) => void;
  replan: (planId: string) => void;
  addFiles: (sessionId: string, files: File[]) => string[];
  deleteSession: (sessionId: string) => void;
  updateProfile: (patch: Partial<Demo["profile"]>) => void;
  reset: () => void;
};

const KEY = "vl-demo-v1";
const Ctx = createContext<Api | null>(null);
const ALLOWED = /\.(pdf|docx|pptx|txt|md|csv|json|xml|html|css|js|ts|py|java|c|cpp|jpe?g|png|webp)$/i;
const MAX_MB = 50;

export function DemoProvider({ seed, children }: { seed: Demo; children: ReactNode }) {
  const [state, setState] = useState<State>({ ...seed, pending: {}, seen: [] });
  const [now, setNow] = useState(() => new Date(seed.now));
  const [thinking, setThinking] = useState<Thinking>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const loaded = useRef(false);
  const failed = useRef<Record<string, string>>({});

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Restore what this visitor did last time (per-browser convenience only), after hydration.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    // Seeded files that are mid-pipeline finish shortly after the demo opens.
    const finish = window.setTimeout(() => {
      setState((s) => ({
        ...s,
        files: s.files.map((f) => (f.status === "processing" || f.status === "scanning" ? { ...f, status: "ready" } : f)),
      }));
    }, 5000);
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) setState({ ...(JSON.parse(raw) as State), now: seed.now });
      } catch {
        /* private mode or corrupted data: keep the seed */
      }
      loaded.current = true;
    });
    return () => {
      window.clearInterval(t);
      window.clearTimeout(finish);
    };
  }, [seed.now]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the demo still works in memory */
    }
  }, [state]);

  const markFresh = (id: string) => setFresh((f) => new Set(f).add(id));

  const send = useCallback((sessionId: string, text: string) => {
    const at = new Date();
    const userMsg: Message = { id: `u${at.getTime()}`, role: "user", content: text, at: at.toISOString() };
    setState((s) => {
      // If this answers a follow-up, lock those chips and remember which one was picked.
      const thread = (s.messages[sessionId] ?? []).map((m) =>
        m.role !== "assistant" || !m.blocks
          ? m
          : { ...m, blocks: m.blocks.map((b) => (b.type === "followup" && !b.picked && b.chips.includes(text) ? { ...b, picked: text } : b)) },
      );
      return { ...s, messages: { ...s.messages, [sessionId]: [...thread, userMsg] } };
    });
    markFresh(userMsg.id);

    const s = stateRef.current;
    const session = s.sessions.find((x) => x.id === sessionId);
    const seen = new Set(s.seen);
    // "Try again" re-asks the last question that failed in this session.
    const question = text === "Try again" ? (failed.current[sessionId] ?? text) : text;
    let reply: Reply;
    try {
      reply = respond(question, {
        now: at,
        language: s.profile.language,
        sessionSubject: session?.subject || undefined,
        pending: s.pending[sessionId],
        files: s.files.filter((f) => f.sessionId === sessionId),
        seen,
      });
    } catch {
      reply = { servedFrom: "ml", pending: null, blocks: [{ type: "text", text: "Something went wrong reading that. Try saying it another way." }] };
    }
    const label = reply.open
      ? "Thinking it through"
      : reply.plan
        ? "Building your plan"
        : reply.servedFrom === "llm"
          ? "Writing your notes"
          : reply.servedFrom === "cache"
            ? "Found it in your saved answers"
            : "Reading your request";
    setThinking({ sessionId, label });

    const deliver = (final: Reply) => {
      const msgId = `a${Date.now()}`;
      startTransition(() => {
        setState((cur) => {
          let plans = cur.plans;
          let blocks = final.blocks;
          if (final.plan) {
            const plan: Plan = { id: `p${at.getTime()}`, sessionId, ...final.plan };
            plans = [...cur.plans.filter((p) => p.sessionId !== sessionId), plan];
            blocks = [...blocks, { type: "plan", planId: plan.id }];
          }
          const msg: Message = { id: msgId, role: "assistant", blocks, servedFrom: final.servedFrom, at: new Date().toISOString() };
          return {
            ...cur,
            plans,
            seen: [...seen],
            pending: { ...cur.pending, [sessionId]: final.pending ?? null },
            messages: { ...cur.messages, [sessionId]: [...(cur.messages[sessionId] ?? []), msg] },
            sessions: cur.sessions.map((x) => (x.id === sessionId ? { ...x, ...final.sessionPatch, updated: new Date().toISOString() } : x)),
          };
        });
        markFresh(msgId);
        setThinking(null);
      });
    };

    if (!reply.open) {
      window.setTimeout(() => deliver(reply), reply.servedFrom === "llm" ? 1400 : reply.plan ? 1100 : 650);
      return;
    }

    // Open question: ask the AI route. Off -> local fallback. Failure -> say what happened, offer a retry.
    const history = (s.messages[sessionId] ?? [])
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: (m.content ?? m.blocks?.map((b) => ("text" in b && typeof b.text === "string" ? b.text : "")).join(" ") ?? "").slice(0, 2000),
      }))
      .filter((m) => m.content);
    fetch("/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply.open.slice(0, 2000), language: s.profile.language, history }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { text?: string; configured?: boolean; error?: { message?: string } } | null;
        if (res.ok && body?.text) {
          delete failed.current[sessionId];
          deliver({ servedFrom: "llm", pending: null, blocks: [{ type: "text", text: body.text }] });
        } else if (res.ok && body?.configured === false) {
          deliver({ ...reply, servedFrom: "ml" });
        } else {
          failed.current[sessionId] = reply.open!;
          deliver({ servedFrom: "ml", pending: null, blocks: [{ type: "followup", text: body?.error?.message ?? "Couldn't get an answer just now.", chips: ["Try again"] }] });
        }
      })
      .catch(() => {
        failed.current[sessionId] = reply.open!;
        deliver({ servedFrom: "ml", pending: null, blocks: [{ type: "followup", text: "Couldn't reach the server. Check your connection, then try again.", chips: ["Try again"] }] });
      });
  }, []);

  const startSession = useCallback(
    (text: string) => {
      const id = `s${Date.now()}`;
      setState((s) => ({
        ...s,
        sessions: [{ id, title: "New study session", subject: "", deadline: "", mode: "crash", updated: new Date().toISOString() }, ...s.sessions],
        messages: { ...s.messages, [id]: [] },
      }));
      window.setTimeout(() => send(id, text), 0);
      return id;
    },
    [send],
  );

  const toggleStep = useCallback((planId: string, stepId: string) => {
    setState((s) => ({
      ...s,
      plans: s.plans.map((p) => (p.id !== planId ? p : { ...p, steps: p.steps.map((st) => (st.id === stepId ? { ...st, done: !st.done } : st)) })),
    }));
  }, []);

  const replan = useCallback((planId: string) => {
    startTransition(() => {
      setState((s) => ({
        ...s,
        plans: s.plans.map((p) => {
          if (p.id !== planId) return p;
          const done = p.steps.filter((x) => x.done);
          const fresh = buildPlan({ subject: p.subject, deadline: new Date(p.deadline), now: new Date(), mode: p.mode, hoursPerDay: p.hours, idPrefix: `r${Date.now()}` });
          const doneTitles = new Set(done.map((d) => d.title));
          return { ...p, steps: [...done, ...fresh.filter((f) => f.kind !== "block" || !doneTitles.has(f.title))] };
        }),
      }));
    });
  }, []);

  const addFiles = useCallback((sessionId: string, files: File[]) => {
    const errors: string[] = [];
    const added: StudyFile[] = [];
    for (const f of files) {
      if (!ALLOWED.test(f.name)) {
        errors.push(`${f.name}: this file type isn't supported. Upload PDF, Word, PowerPoint, text, code or images.`);
        continue;
      }
      const tooBig = f.size > MAX_MB * 1024 * 1024;
      added.push({
        id: `f${Date.now()}${added.length}`,
        sessionId,
        name: f.name.slice(0, 120),
        sizeBytes: f.size,
        status: tooBig ? "failed" : "uploading",
        progress: 0,
        error: tooBig ? `This file is over ${MAX_MB} MB. Split it into parts (for example by chapter) and upload each part.` : undefined,
        added: new Date().toISOString(),
      });
    }
    setState((s) => ({ ...s, files: [...added, ...s.files] }));
    // Simulated pipeline: uploading (real-looking %) -> scanning -> processing -> ready.
    for (const f of added.filter((x) => x.status === "uploading")) {
      const patch = (p: Partial<StudyFile>) => setState((s) => ({ ...s, files: s.files.map((x) => (x.id === f.id ? { ...x, ...p } : x)) }));
      let pct = 0;
      const tick = window.setInterval(() => {
        pct = Math.min(100, pct + 8 + Math.random() * 18);
        patch({ progress: Math.round(pct) });
        if (pct >= 100) {
          window.clearInterval(tick);
          patch({ status: "scanning" });
          window.setTimeout(() => patch({ status: "processing" }), 900);
          window.setTimeout(() => patch({ status: "ready", pages: Math.max(1, Math.round(f.sizeBytes / 140_000)) }), 2600);
        }
      }, 220);
    }
    return errors;
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    startTransition(() => {
      setState((s) => ({
        ...s,
        sessions: s.sessions.filter((x) => x.id !== sessionId),
        plans: s.plans.filter((p) => p.sessionId !== sessionId),
        files: s.files.filter((f) => f.sessionId !== sessionId),
      }));
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<Demo["profile"]>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setState({ ...seed, pending: {}, seen: [] });
  }, [seed]);

  const api = useMemo<Api>(
    () => ({ state, now, thinking, fresh, send, startSession, toggleStep, replan, addFiles, deleteSession, updateProfile, reset }),
    [state, now, thinking, fresh, send, startSession, toggleStep, replan, addFiles, deleteSession, updateProfile, reset],
  );
  return <Ctx value={api}>{children}</Ctx>;
}

export function useDemo(): Api {
  const v = use(Ctx);
  if (!v) throw new Error("useDemo must be used inside <DemoProvider>");
  return v;
}
