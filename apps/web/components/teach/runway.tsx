"use client";

import { Camera, Check, Mic, X } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { cancelClass, type LiveClass } from "@/lib/api/classes";
import { reschedule } from "@/lib/api/live";
import { useTeach } from "./data";

/** T4: an hour before, short of students? Say so plainly and offer the two honest options. */
export function ShortPrompt({ c, now }: { c: LiveClass; now: number }) {
  const { rules, reload } = useTeach();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const mins = Math.round((new Date(c.starts_at).getTime() - now) / 60_000);
  if (c.phase !== "upcoming" || mins > 60 || c.interested >= rules.min_students) return null;

  async function act(kind: "move" | "cancel") {
    setBusy(true);
    setProblem(null);
    try {
      if (kind === "move") await reschedule(c.id, new Date(new Date(c.starts_at).getTime() + 24 * 3_600_000).toISOString());
      else await cancelClass(c.id);
      reload();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Couldn't do that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="mt-3 rounded-[var(--radius-input)] bg-amber/15 px-4 py-3 text-sm">
      <p>
        <strong>{c.interested} of {rules.min_students} needed</strong> with {mins} min to go. If it stays short, it cancels itself at the start.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act("move")}>
          Move to tomorrow, same time
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act("cancel")}>
          Cancel room
        </button>
      </div>
      {problem ? <p role="alert" className="mt-2 text-danger">{problem}</p> : null}
    </div>
  );
}

type Check = "idle" | "testing" | "ok" | "blocked";

/** T4: five minutes before, make sure the camera and mic work, so the class doesn't start with "can you hear me?". */
export function PreflightCheck({ onDark = false }: { onDark?: boolean }) {
  const [state, setState] = useState<Check>("idle");
  const [level, setLevel] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => undefined);

  async function test() {
    setState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (video.current) video.current.srcObject = stream;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        an.getByteFrequencyData(buf);
        setLevel(Math.min(100, Math.round(buf.reduce((a, b) => a + b, 0) / buf.length)));
        raf = requestAnimationFrame(tick);
      };
      tick();
      stop.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      setState("ok");
    } catch {
      setState("blocked");
    }
  }

  function done() {
    stop.current();
    setState("idle");
    setLevel(0);
  }

  const tone = onDark ? "text-mist/80" : "text-muted";
  return (
    <div className="grid gap-2">
      {state === "idle" ? (
        <button type="button" className={`btn ${onDark ? "border border-mist/30 text-mist hover:bg-mist/10" : "btn-secondary"} w-fit`} onClick={test}>
          <Camera size={16} strokeWidth={1.75} aria-hidden="true" /> Check camera and mic
        </button>
      ) : null}
      {state === "testing" ? <p role="status" className={`text-sm ${tone}`}>Asking your browser for the camera and mic…</p> : null}
      {state === "blocked" ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <X size={16} aria-hidden="true" /> The browser blocked the camera or mic. Allow them from the lock icon in the address bar, then try again.
        </p>
      ) : null}
      <div className={state === "ok" ? "grid gap-2" : "hidden"}>
        <video ref={video} autoPlay muted playsInline className="aspect-video w-full max-w-xs rounded-[var(--radius-input)] bg-black object-cover" aria-label="Your camera preview" />
        <p className={`flex items-center gap-2 text-sm ${tone}`}>
          <Mic size={16} aria-hidden="true" /> Say something:
          <span className="h-2 w-28 overflow-hidden rounded-full bg-text/10" aria-hidden="true">
            <span className="block h-full rounded-full bg-leaf transition-[width] duration-75" style={{ width: `${level}%` }} />
          </span>
        </p>
        <p className={`flex items-center gap-2 text-sm font-medium ${onDark ? "text-mist" : "text-done"}`}>
          <Check size={16} aria-hidden="true" /> Camera and mic work.
        </p>
        <button type="button" className={`btn ${onDark ? "border border-mist/30 text-mist hover:bg-mist/10" : "btn-secondary"} w-fit`} onClick={done}>
          Done checking
        </button>
      </div>
    </div>
  );
}
