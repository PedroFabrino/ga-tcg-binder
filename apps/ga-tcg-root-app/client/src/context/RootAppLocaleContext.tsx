import React, { createContext, useContext } from "react";
import type { SupportedLocale } from "@ga/contracts";
import type { NomenclatureTerm } from "../components/InfoTermBadge";

export interface RootAppLocaleContextValue {
  locale: SupportedLocale;
  onNavigateTerm?: (term: NomenclatureTerm) => void;
}

const RootAppLocaleContext = createContext<RootAppLocaleContextValue | null>(null);

export const RootAppLocaleProvider: React.FC<{
  value: RootAppLocaleContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <RootAppLocaleContext.Provider value={value}>
      {children}
    </RootAppLocaleContext.Provider>
  );
};

export function useRootAppLocale(): RootAppLocaleContextValue {
  const ctx = useContext(RootAppLocaleContext);
  return ctx ?? { locale: "en" };
}
