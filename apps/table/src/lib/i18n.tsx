"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  type SupportedLocale,
  DEFAULT_LOCALE,
  resolveLocale,
  createTranslator,
  type TranslationKey,
} from "@ga/contracts";

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: createTranslator(DEFAULT_LOCALE),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("gt_locale") : null;
    const initial = saved ? resolveLocale(saved) : resolveLocale(navigator.language);
    setLocaleState(initial);
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("gt_locale", newLocale);
    }
  };

  const t = createTranslator(locale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: createTranslator(DEFAULT_LOCALE),
    };
  }
  return context;
}
