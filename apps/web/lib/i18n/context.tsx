"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/demo/notes-i18n";
import { translate, UI_LANG_COOKIE, type T } from "./ui";

type Ui = { lang: Lang; t: T; setLang: (l: Lang) => void };

// Outside the provider (landing page, tests) everything is English.
const Ctx = createContext<Ui>({ lang: "en", t: (k, v) => translate("en", k, v), setLang: () => undefined });

/** App interface language. Starts from the cookie the server read, so the first paint is already right. */
export function UiLangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${UI_LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<Ui>(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang, setLang]);
  return <Ctx value={value}>{children}</Ctx>;
}

export const useUi = () => use(Ctx);
export const useT = () => use(Ctx).t;
