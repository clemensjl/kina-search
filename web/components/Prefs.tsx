"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Lang } from "@/lib/i18n";
import type { Cur } from "@/lib/data";

export type Theme = "light" | "dark";
export type Prefs = { cur: Cur; lang: Lang; theme: Theme; agent: string };

const DEFAULTS: Prefs = { cur: "EUR", lang: "de", theme: "light", agent: "litbuy" };

const Ctx = createContext<{
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  needsOnboarding: boolean;
  finishOnboarding: () => void;
}>({ prefs: DEFAULTS, setPrefs: () => {}, needsOnboarding: false, finishOnboarding: () => {} });

export const usePrefs = () => useContext(Ctx);

function load(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("prefs") || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export default function PrefsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULTS);
  const [needsOnboarding, setNeeds] = useState(false);

  useEffect(() => {
    const p = load();
    setPrefsState(p);
    if (status !== "authenticated") return;
    (async () => {
      const r = await fetch("/api/prefs");
      if (!r.ok) return;
      const d = await r.json();
      if (d.currency) {
        const merged: Prefs = {
          cur: d.currency ?? p.cur, lang: d.language ?? p.lang,
          theme: d.theme ?? p.theme, agent: d.agent ?? p.agent,
        };
        setPrefsState(merged);
        localStorage.setItem("prefs", JSON.stringify(merged));
      } else if (!localStorage.getItem("prefs")) {
        setNeeds(true);
      }
    })();
  }, [status]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.lang = prefs.lang;
  }, [prefs.theme, prefs.lang]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((old) => {
      const next = { ...old, ...patch };
      localStorage.setItem("prefs", JSON.stringify(next));
      if (status === "authenticated") {
        fetch("/api/prefs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ currency: next.cur, language: next.lang, theme: next.theme, agent: next.agent }),
        });
      }
      return next;
    });
  }, [status]);

  const finishOnboarding = useCallback(() => setNeeds(false), []);

  return (
    <Ctx.Provider value={{ prefs, setPrefs, needsOnboarding, finishOnboarding }}>
      {children}
    </Ctx.Provider>
  );
}
