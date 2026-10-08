"use client";

import { FileText, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { useDemo } from "@/lib/demo/store";
import { ago, fileSize } from "@/lib/format";
import { FileStatus } from "../s/[id]/SessionView";

const FILTERS = ["All", "Ready", "In progress", "Failed"] as const;

export default function FilesPage() {
  const { state, now, addFiles } = useDemo();
  const sessions = [...state.sessions].sort((a, b) => b.updated.localeCompare(a.updated));
  const [target, setTarget] = useState(sessions[0]?.id ?? "");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [errors, setErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const nowIso = now.toISOString();

  const files = state.files.filter((f) =>
    filter === "All" ? true : filter === "Ready" ? f.status === "ready" : filter === "Failed" ? f.status === "failed" : !["ready", "failed"].includes(f.status),
  );
  const sessionName = (id: string) => state.sessions.find((s) => s.id === id)?.title ?? "Deleted session";
  const upload = (list: File[]) => target && setErrors(addFiles(target, list));

  return (
    <PageTransition>
      <title>Files | VibrantLearn</title>
      <Main wide>
        <PageHeader title="Files" sub="Notes, slides and photos you've added, across all sessions. Only you can see them." />

        <div
          className={`rise mt-8 grid gap-4 rounded-[var(--radius-sheet)] border-2 border-dashed p-6 transition-colors sm:grid-cols-[1fr_auto] sm:items-center ${drag ? "border-link bg-link/5" : "border-line bg-surface"}`}
          style={{ "--i": 1 } as CSSProperties}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload([...e.dataTransfer.files]);
          }}
        >
          <div>
            <p className="font-semibold">{drag ? `Drop to add to ${sessionName(target)}` : "Drop files here or choose them"}</p>
            <p className="mt-1 text-sm text-muted">PDF, Word, PowerPoint, text, code and photos. Up to 50 MB each.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="target" className="sr-only">
              Add to session
            </label>
            <select id="target" className="field w-auto min-w-48" value={target} onChange={(e) => setTarget(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} disabled={!target}>
              <Upload size={16} strokeWidth={2} aria-hidden="true" /> Upload notes
            </button>
            <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) upload([...e.target.files]); e.target.value = ""; }} />
          </div>
        </div>
        {errors.length ? (
          <ul role="alert" className="pop-in mt-3 grid gap-1 rounded-[var(--radius-input)] bg-rose/10 px-4 py-3 text-sm">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <div role="tablist" aria-label="Filter files" className="mt-8 inline-flex rounded-full bg-text/[0.05] p-1">
          {FILTERS.map((f) => (
            <button key={f} role="tab" type="button" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${filter === f ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-text"}`}>
              {f}
            </button>
          ))}
        </div>

        {files.length === 0 ? (
          <p className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center text-muted">Nothing here. Upload your notes and they&rsquo;ll show up with their status.</p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Session</th>
                  <th className="px-5 py-3 font-medium">Size</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {files.map((f, i) => (
                  <tr key={f.id} className="rise transition-colors hover:bg-text/[0.02]" style={{ "--i": i } as CSSProperties}>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        <FileText size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                        <span className="max-w-[22rem] truncate">{f.name}</span>
                      </span>
                      {f.error ? <span className="mt-1 block text-xs text-danger">{f.error}</span> : null}
                      {f.status === "uploading" ? (
                        <span className="mt-2 block h-1 max-w-56 overflow-hidden rounded-full bg-line">
                          <span className="block h-full origin-left bg-link transition-transform duration-200" style={{ transform: `scaleX(${(f.progress ?? 0) / 100})` }} />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/app/s/${f.sessionId}`} className="no-underline hover:underline">
                        {sessionName(f.sessionId)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted">{fileSize(f.sizeBytes)}</td>
                    <td className="px-5 py-3">
                      <FileStatus f={f} />
                      <span className="sr-only">{f.status}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">{ago(f.added, nowIso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {files.map((f) => (
                <li key={f.id} className="p-4">
                  <p className="flex items-center gap-2 font-medium">
                    <FileText size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">{f.name}</span>
                  </p>
                  <p className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>
                      {sessionName(f.sessionId)}, {fileSize(f.sizeBytes)}
                    </span>
                    <FileStatus f={f} />
                  </p>
                  {f.error ? <p className="mt-1 text-xs text-danger">{f.error}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Main>
    </PageTransition>
  );
}
