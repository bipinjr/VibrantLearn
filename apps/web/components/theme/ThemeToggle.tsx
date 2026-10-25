"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore, type MouseEvent } from "react";
import { THEME_COOKIE } from "@/lib/theme";

/** Light/dark switch. The choice lives in a cookie so the server renders the right theme first
 * (no flash, no inline script under our CSP). Until someone picks, the OS setting decides. */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", onChange);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

function isDark(): boolean {
  const set = document.documentElement.dataset.theme;
  return set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => null);

  function flip(e: MouseEvent<HTMLButtonElement>) {
    const theme = isDark() ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = theme;
      document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
    };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || still) return apply();
    // The new theme spreads out from the button (clip-path circle on the new snapshot).
    const r = e.currentTarget.getBoundingClientRect();
    const root = document.documentElement.style;
    root.setProperty("--theme-x", `${r.left + r.width / 2}px`);
    root.setProperty("--theme-y", `${r.top + r.height / 2}px`);
    document.documentElement.dataset.themeSwitch = "";
    const t = document.startViewTransition(apply);
    t.finished.finally(() => delete document.documentElement.dataset.themeSwitch);
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex size-10 items-center justify-center rounded-full border border-line text-text transition-colors hover:bg-text/5 ${className}`}
    >
      {dark === null ? (
        <span className="size-[18px]" />
      ) : (
        <span key={dark ? "sun" : "moon"} className="theme-icon inline-flex">
          {dark ? <Sun size={18} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.75} aria-hidden="true" />}
        </span>
      )}
    </button>
  );
}
