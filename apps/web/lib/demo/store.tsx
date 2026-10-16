"use client";

import { createContext, startTransition, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as persist from "@/lib/account/persist";
import { uploadFile } from "@/lib/account/upload";
import { streamMessage } from "@/lib/api/stream";
import type { Block, Demo, Lang, Message, Plan, Session, StudyFile } from "./data";
import { respond, type Pending, type Reply } from "./respond";
import { buildPlan } from "./scheduler";

type State = Demo & { pending: Record<string, Pending | null | undefined>; seen: string[] };
type Thinking = { sessionId: string; label: string } | null;
export type StoreMode = "demo" | "account";

type Api = {
  mode: StoreMode;
  state: State;
  now: Date;
  thinking: Thinking;
  fresh: Set<string>;
  syncError: string | null;
  clearSyncError: () => void;
  send: (sessionId: string, text: string) => void;
  startSession: (text: string) => string;
  toggleStep: (planId: string, stepId: string) => void;
  replan: (planId: string) => void;
  addFiles: (sessionId: string, files: File[]) => string[];
  deleteSession: (sessionId: string) => void;
  updateProfile: (patch: Partial<Demo["profile"]>) => void;
  reset: () => void;
  /** Adds a thread the server rendered (signed in) unless the store already has it. */
  hydrateThread: (sessionId: string, messages: Message[]) => void;
};

const KEY = "vl-demo-v1";
const Ctx = createContext<Api | null>(null);
const ALLOWED = /\.(pdf|docx|pptx|txt|md|csv|json|xml|html|css|js|ts|py|java|c|cpp|jpe?g|png|webp)$/i;
const MAX_MB = 50;
const uid = () => crypto.randomUUID();

/**
 * The app's data store. "demo": sample data kept in this browser. "account": a signed-in student's
 * real data, loaded on the server and saved to Supabase on every change (owner-only by RLS).
 */
export function DemoProvider({ seed, children, account }: { seed: Demo; children: ReactNode; account?: { userId: string } }) {
  const mode: StoreMode = account ? "account" : "demo";
  const [state, setState] = useState<State>({ ...seed, pending: {}, seen: [] });
  const [now, setNow] = useState(() => new Date(seed.now));
  const [thinking, setThinking] = useState<Thinking>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [syncError, setSyncError] = useState<string | null>(null);
  const loaded = useRef(false);
  const failed = useRef<Record<string, string>>({});
  const queues = useRef<Record<string, Promise<unknown>>>({});
  const profileTimer = useRef<number | undefined>(undefined);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  /** Runs saves for one session in order (session row before its messages and plan). */
  const save = useCallback(
    (key: string, job: () => Promise<{ error?: string }>) => {
      if (mode !== "account") return;
      const prev = queues.current[key] ?? Promise.resolve();
      queues.current[key] = prev.then(job).then(
        (r) => r.error && setSyncError("Couldn't save your last change. Check your connection; it will be lost if you reload."),
        () => setSyncError("Couldn't save your last change. Check your connection; it will be lost if you reload."),
      );
    },
    [mode],
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    if (mode === "account") {
      loaded.current = true;
      return () => window.clearInterval(t);
    }
    // Demo only: seeded files mid-pipeline finish shortly after opening; restore this browser's demo.
    const finish = window.setTimeout(() => {
      setState((s) => ({ ...s, files: s.files.map((f) => (f.status === "processing" || f.status === "scanning" ? { ...f, status: "ready" } : f)) }));
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
  }, [seed.now, mode]);

  useEffect(() => {
    if (!loaded.current || mode !== "demo") return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the demo still works in memory */
    }
  }, [state, mode]);

  const markFresh = (id: string) => setFresh((f) => new Set(f).add(id));

  const send = useCallback(
    (sessionId: string, text: string) => {
      const at = new Date();
      const userMsg: Message = { id: uid(), role: "user", content: text, at: at.toISOString() };
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

      // Signed in: the server parses, plans, answers and stores (BUILD_PLAN B2/B3). The browser
      // only shows what streams back. Queued behind the session's own create, so it exists first.
      if (mode === "account") {
        const question = text === "Try again" ? (failed.current[sessionId] ?? text) : text;
        const msgId = uid();
        let started = false;
        const upsertReply = (fn: (m: Message | undefined) => Message) =>
          setState((cur) => {
            const thread = cur.messages[sessionId] ?? [];
            const has = thread.some((m) => m.id === msgId);
            const next = has ? thread.map((m) => (m.id === msgId ? fn(m) : m)) : [...thread, fn(undefined)];
            return { ...cur, messages: { ...cur.messages, [sessionId]: next } };
          });
        setThinking({ sessionId, label: "Reading your request" });
        save(sessionId, async () => {
          await streamMessage(sessionId, { text: question, id: userMsg.id }, (e) => {
            if (e.event === "status") setThinking({ sessionId, label: e.data.label });
            else if (e.event === "plan") {
              const plan = e.data as unknown as Plan;
              setState((cur) => ({ ...cur, plans: [...cur.plans.filter((p) => p.sessionId !== sessionId), plan] }));
            } else if (e.event === "session") {
              const p = e.data as Partial<Session>;
              setState((cur) => ({ ...cur, sessions: cur.sessions.map((x) => (x.id === sessionId ? { ...x, ...p, updated: new Date().toISOString() } : x)) }));
            } else if (e.event === "block") {
              const block = e.data as unknown as Block;
              if (!started) {
                started = true;
                setThinking(null);
                markFresh(msgId);
              }
              upsertReply((m) => ({ id: msgId, role: "assistant", at: new Date().toISOString(), ...m, blocks: [...(m?.blocks ?? []), block] }));
            } else if (e.event === "done") {
              delete failed.current[sessionId];
              upsertReply((m) => ({ id: msgId, role: "assistant", at: new Date().toISOString(), blocks: [], ...m, servedFrom: e.data.servedFrom }));
            } else if (e.event === "error") {
              failed.current[sessionId] = question;
              setThinking(null);
              markFresh(msgId);
              upsertReply(() => ({ id: msgId, role: "assistant", at: new Date().toISOString(), servedFrom: "ml", blocks: [{ type: "followup", text: e.data.message, chips: ["Try again"] }] }));
            }
          });
          setThinking((t) => (t?.sessionId === sessionId ? null : t));
          return {};
        });
        return;
      }

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
        const msgId = uid();
        let plan: Plan | undefined;
        let blocks = final.blocks;
        if (final.plan) {
          plan = { id: uid(), sessionId, ...final.plan };
          blocks = [...blocks, { type: "plan", planId: plan.id }];
        }
        const msg: Message = { id: msgId, role: "assistant", blocks, servedFrom: final.servedFrom, at: new Date().toISOString() };
        startTransition(() => {
          setState((cur) => ({
            ...cur,
            plans: plan ? [...cur.plans.filter((p) => p.sessionId !== sessionId), plan] : cur.plans,
            seen: [...seen],
            pending: { ...cur.pending, [sessionId]: final.pending ?? null },
            messages: { ...cur.messages, [sessionId]: [...(cur.messages[sessionId] ?? []), msg] },
            sessions: cur.sessions.map((x) => (x.id === sessionId ? { ...x, ...final.sessionPatch, updated: new Date().toISOString() } : x)),
          }));
          markFresh(msgId);
          setThinking(null);
        });
      };

      if (reply.aiNotes) {
        // AI-written notes for this syllabus topic; any failure keeps the syllabus summary already in the reply.
        fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reply.aiNotes) })
          .then(async (res) => {
            const body = (await res.json().catch(() => null)) as { notes?: Record<Lang, string>; servedFrom?: "llm" | "cache" } | null;
            if (!res.ok || !body?.notes) return deliver(reply);
            const notes = body.notes;
            deliver({ ...reply, servedFrom: body.servedFrom ?? "llm", blocks: reply.blocks.map((b) => (b.type === "notes" ? { ...b, text: notes } : b)) });
          })
          .catch(() => deliver(reply));
        return;
      }
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
        body: JSON.stringify({ message: reply.open.slice(0, 2000), language: reply.lang ?? s.profile.language, history }),
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
    },
    [save, mode],
  );

  const startSession = useCallback(
    (text: string) => {
      const session = { id: uid(), title: "New study session", subject: "", deadline: "", mode: "crash" as const, updated: new Date().toISOString() };
      setState((s) => ({ ...s, sessions: [session, ...s.sessions], messages: { ...s.messages, [session.id]: [] } }));
      save(session.id, () => persist.createSession(session));
      window.setTimeout(() => send(session.id, text), 0);
      return session.id;
    },
    [send, save],
  );

  const changePlan = useCallback(
    (planId: string, change: (p: Plan) => Plan) => {
      const current = stateRef.current.plans.find((p) => p.id === planId);
      if (!current) return;
      const next = change(current);
      startTransition(() => setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === planId ? next : p)) })));
      save(next.sessionId, () => persist.updatePlanSteps(next));
    },
    [save],
  );

  const toggleStep = useCallback(
    (planId: string, stepId: string) => changePlan(planId, (p) => ({ ...p, steps: p.steps.map((st) => (st.id === stepId ? { ...st, done: !st.done } : st)) })),
    [changePlan],
  );

  const replan = useCallback(
    (planId: string) =>
      changePlan(planId, (p) => {
        const done = p.steps.filter((x) => x.done);
        const rebuilt = buildPlan({ subject: p.subject, deadline: new Date(p.deadline), now: new Date(), mode: p.mode, hoursPerDay: p.hours, idPrefix: `r${Date.now()}` });
        const doneTitles = new Set(done.map((d) => d.title));
        return { ...p, steps: [...done, ...rebuilt.filter((f) => f.kind !== "block" || !doneTitles.has(f.title))] };
      }),
    [changePlan],
  );

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
        id: uid(),
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
    if (mode === "account") {
      // Real pipeline (C3): signed URL -> PUT to Storage -> server verifies and indexes.
      added.forEach((f, i) => {
        if (f.status !== "uploading") return;
        let id = f.id; // becomes the server's file id once the API has made the row
        uploadFile(sessionId, files.filter((x) => ALLOWED.test(x.name))[i], ({ serverId, ...p }) => {
          const prev = id;
          if (serverId) id = serverId;
          setState((s) => {
            const next = s.files.map((x) => (x.id === prev ? { ...x, ...p, id } : x));
            // A duplicate upload resolves to the file already in the session: keep one row.
            return { ...s, files: next.filter((x, k) => next.findIndex((y) => y.id === x.id) === k) };
          });
        });
      });
      return errors;
    }
    // Demo mode: the same statuses, simulated, so the demo needs no server.
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
  }, [mode]);

  const deleteSession = useCallback(
    (sessionId: string) => {
      startTransition(() => {
        setState((s) => ({
          ...s,
          sessions: s.sessions.filter((x) => x.id !== sessionId),
          plans: s.plans.filter((p) => p.sessionId !== sessionId),
          files: s.files.filter((f) => f.sessionId !== sessionId),
        }));
      });
      save(sessionId, () => persist.deleteSession(sessionId));
    },
    [save],
  );

  const updateProfile = useCallback(
    (patch: Partial<Demo["profile"]>) => {
      setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
      if (!account) return;
      // Typing in a field shouldn't send a request per keystroke.
      window.clearTimeout(profileTimer.current);
      profileTimer.current = window.setTimeout(() => save("profile", () => persist.updateProfile(account.userId, stateRef.current.profile)), 600);
    },
    [account, save],
  );

  const reset = useCallback(() => {
    if (mode !== "demo") return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setState({ ...seed, pending: {}, seen: [] });
  }, [seed, mode]);

  const clearSyncError = useCallback(() => setSyncError(null), []);
  const hydrateThread = useCallback((sessionId: string, messages: Message[]) => {
    setState((s) => (s.messages[sessionId] ? s : { ...s, messages: { ...s.messages, [sessionId]: messages } }));
  }, []);

  const api = useMemo<Api>(
    () => ({ mode, state, now, thinking, fresh, syncError, clearSyncError, send, startSession, toggleStep, replan, addFiles, deleteSession, updateProfile, reset, hydrateThread }),
    [mode, state, now, thinking, fresh, syncError, clearSyncError, send, startSession, toggleStep, replan, addFiles, deleteSession, updateProfile, reset, hydrateThread],
  );
  return <Ctx value={api}>{children}</Ctx>;
}

export function useDemo(): Api {
  const v = use(Ctx);
  if (!v) throw new Error("useDemo must be used inside <DemoProvider>");
  return v;
}
