"use client";

import { FolderOpen, Home, LogOut, Menu, Plus, Route, Settings2, Video, X } from "lucide-react";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { timeLeft } from "@/lib/format";
import { useDemo } from "@/lib/demo/store";

const NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/plans", label: "Plans", icon: Route },
  { href: "/app/files", label: "Files", icon: FolderOpen },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
] as const;

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path === href || path.startsWith(`${href}/`);
}

function urgency(deadline: string, now: Date): "now" | "soon" | "later" {
  const h = (new Date(deadline).getTime() - now.getTime()) / 3_600_000;
  return h <= 24 ? "now" : h <= 72 ? "soon" : "later";
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { state, now } = useDemo();
  const sessions = [...state.sessions].sort((a, b) => b.updated.localeCompare(a.updated));

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1">
        <Wordmark height={24} href="/app" />
      </div>

      <Link href="/app/new" onClick={onNavigate} className="btn btn-primary w-full justify-start gap-2" transitionTypes={["nav-forward"]}>
        <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
        New study session
      </Link>

      <nav aria-label="Main">
        <ul className="grid gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href} className="relative">
                {active ? (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-[10px] bg-text/[0.07]" transition={{ type: "spring", stiffness: 520, damping: 40 }} />
                ) : null}
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[0.95rem] no-underline transition-colors duration-150 ${active ? "font-semibold text-text" : "text-muted hover:text-text"}`}
                >
                  <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <span className="flex cursor-default items-center gap-3 rounded-[10px] px-3 py-2 text-[0.95rem] text-muted/70" aria-disabled="true">
              <Video size={19} strokeWidth={1.75} aria-hidden="true" />
              Live classes
              <span className="ml-auto rounded-full bg-text/[0.06] px-2 py-0.5 text-[0.7rem] font-medium">Soon</span>
            </span>
          </li>
        </ul>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className="px-3 font-sans text-xs font-medium tracking-normal text-muted">Study sessions</h2>
        <ul className="mt-2 grid max-h-full gap-0.5 overflow-x-hidden overflow-y-auto pr-1 [scrollbar-width:thin]">
          {sessions.map((s, i) => {
            const active = path === `/app/s/${s.id}`;
            const u = s.deadline ? urgency(s.deadline, now) : "later";
            return (
              <li key={s.id} className="rise min-w-0" style={{ "--i": i } as React.CSSProperties}>
                <Link
                  href={`/app/s/${s.id}`}
                  onClick={onNavigate}
                  transitionTypes={["nav-forward"]}
                  aria-current={active ? "page" : undefined}
                  className={`group grid min-w-0 gap-0.5 rounded-[10px] px-3 py-2 no-underline transition-colors duration-150 ${active ? "bg-text/[0.07]" : "hover:bg-text/[0.04]"}`}
                >
                  <span className={`truncate text-sm ${active ? "font-semibold text-text" : "font-medium text-text"}`}>{s.title}</span>
                  <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
                    <span className="min-w-0 truncate">{s.subject.replace(" Programming", "").replace("Database Management Systems", "DBMS") || "No subject yet"}</span>
                    {s.deadline ? (
                      <span
                        className={`ml-auto shrink-0 rounded-full px-1.5 py-px text-[0.68rem] font-semibold tabular-nums ${
                          u === "now" ? "bg-ember/20 text-text" : u === "soon" ? "bg-amber/20 text-text" : "bg-text/[0.06]"
                        }`}
                      >
                        {timeLeft(s.deadline, now.toISOString())}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-3 rounded-[12px] border border-line bg-bg px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-bold text-mist" aria-hidden="true">
          {state.profile.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{state.profile.username}</span>
          <span className="block truncate text-xs text-muted">
            {state.profile.course}, semester {state.profile.semester}
          </span>
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="grid size-9 place-items-center rounded-[10px] text-muted transition-colors hover:bg-text/[0.06] hover:text-text" aria-label="Sign out">
            <LogOut size={17} strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </div>
  );
}

function SyncBanner() {
  const { syncError, clearSyncError } = useDemo();
  if (!syncError) return null;
  return (
    <p role="alert" className="pop-in m-4 flex items-center justify-between gap-3 rounded-[var(--radius-input)] bg-amber/15 px-4 py-2 text-sm">
      {syncError}
      <button type="button" className="font-medium underline" onClick={clearSyncError}>
        Dismiss
      </button>
    </p>
  );
}

const TABS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/plans", label: "Plans", icon: Route },
  { href: "/app/new", label: "New", icon: Plus },
  { href: "/app/files", label: "Files", icon: FolderOpen },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);

  // Theme chosen in Settings (per-browser). System theme is the default.
  useEffect(() => {
    try {
      const t = localStorage.getItem("vl-theme");
      if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    } catch {
      /* storage blocked: follow the system */
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside
            className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block"
            style={{ viewTransitionName: "app-sidebar" }}
            aria-label="App navigation"
          >
            <SidebarBody />
          </aside>

          <header
            className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md lg:hidden"
            style={{ viewTransitionName: "app-topbar" }}
          >
            <Wordmark height={22} href="/app" />
            <button
              type="button"
              className="grid size-10 place-items-center rounded-[10px] hover:bg-text/[0.06]"
              aria-label="Open menu"
              onClick={() => sheet.current?.showModal()}
            >
              <Menu size={22} strokeWidth={1.75} />
            </button>
          </header>

          <div className="min-w-0 pb-24 lg:pb-0">
            <SyncBanner />
            {children}
          </div>
        </div>

        <dialog ref={sheet} className="sheet" aria-label="Menu" onClick={(e) => e.target === sheet.current && sheet.current?.close()}>
          <div className="relative h-full w-[min(20rem,86vw)] bg-surface">
            <button type="button" className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-[10px] hover:bg-text/[0.06]" aria-label="Close menu" onClick={() => sheet.current?.close()}>
              <X size={20} strokeWidth={1.75} />
            </button>
            <SidebarBody onNavigate={() => sheet.current?.close()} />
          </div>
        </dialog>

        <nav aria-label="Quick" className="fixed inset-x-3 bottom-3 z-30 rounded-[18px] border border-line bg-surface/90 shadow-[var(--shadow-float)] backdrop-blur-md lg:hidden">
          <ul className="grid grid-cols-5">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = isActive(path, href);
              const isNew = href === "/app/new";
              return (
                <li key={href} className="relative">
                  {active && !isNew ? (
                    <motion.span layoutId="tab-pill" className="absolute inset-1.5 rounded-[12px] bg-text/[0.07]" transition={{ type: "spring", stiffness: 520, damping: 40 }} />
                  ) : null}
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium no-underline ${active ? "text-text" : "text-muted"}`}
                  >
                    {isNew ? (
                      <span className="grid size-9 place-items-center rounded-full bg-ember text-ink">
                        <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                      </span>
                    ) : (
                      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <span className={isNew ? "sr-only" : undefined}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </LayoutGroup>
    </MotionConfig>
  );
}
