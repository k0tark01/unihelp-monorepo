"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { en } from "@/lib/translations/en";
import { fr } from "@/lib/translations/fr";
import { ar } from "@/lib/translations/ar";

export type Locale = "en" | "fr" | "ar";

type TranslationTree = typeof en;

const TRANSLATIONS: Record<Locale, TranslationTree> = { en, fr, ar };
const LOCALE_KEY = "unihelp-locale";
const DEFAULT_LOCALE: Locale = "fr";

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Resolve a dot-separated key, e.g. t("hero.title") */
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
  dir: "ltr",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  /* ── Restore saved locale on mount ────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
      if (saved && (saved === "en" || saved === "fr" || saved === "ar")) {
        setLocaleState(saved);
      }
    } catch {
      /* localStorage unavailable (SSR guard) */
    }
  }, []);

  /* ── Sync <html lang + dir> ────────────────── */
  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  function setLocale(l: Locale) {
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* ignore */
    }
    setLocaleState(l);
  }

  function t(key: string): string {
    const parts = key.split(".");
    let node: unknown = TRANSLATIONS[locale];
    for (const part of parts) {
      if (node == null || typeof node !== "object") return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
  }

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
