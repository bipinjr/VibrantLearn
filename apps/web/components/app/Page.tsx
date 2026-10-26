"use client";

import { usePathname } from "next/navigation";
import { useEffect, ViewTransition, type ReactNode } from "react";

/** Page-level route transition: directional for hierarchy, soft rise otherwise. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-enter" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-exit" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/** For layouts: a new key per URL so every route change runs the page enter/exit animation. */
export function RouteTransition({ children }: { children: ReactNode }) {
  return <PageTransition key={usePathname()}>{children}</PageTransition>;
}

/** Page title that receives focus after navigation so screen readers announce the new page. */
export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.getElementById("page-title")?.focus({ preventScroll: true });
  }, []);
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
          {title}
        </h1>
        {sub ? <p className="mt-1.5 text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Main({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className={`mx-auto w-full px-4 py-6 sm:px-8 sm:py-10 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
      {children}
    </main>
  );
}
