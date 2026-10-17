"use client";

import { useEffect } from "react";

/** Scroll reveal for browsers without CSS scroll-driven animations. Does nothing where CSS handles
 * it, or when the reader prefers reduced motion. */
export function ScrollReveal() {
  useEffect(() => {
    if (CSS.supports("animation-timeline: view()")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("js-reveal");
    const targets = document.querySelectorAll<HTMLElement>(".scroll-in, .stagger > *, .route-draw");
    targets.forEach((el) => {
      const parent = el.parentElement;
      if (parent?.classList.contains("stagger")) el.style.setProperty("--reveal-delay", `${Array.from(parent.children).indexOf(el) * 90}ms`);
    });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);
  return null;
}
