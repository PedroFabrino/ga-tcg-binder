import React from "react";
import { Info } from "lucide-react";
import type { SupportedLocale } from "@ga/contracts";
import { useTranslator } from "../hooks/useTranslator";
import { useRootAppLocale } from "../context/RootAppLocaleContext";

export type NomenclatureTerm =
  | "shortages"
  | "hardShortages"
  | "sharedShortages"
  | "alertScope"
  | "wantlist"
  | "omnidexFormat";

export interface InfoTermBadgeProps {
  term: NomenclatureTerm;
  locale?: SupportedLocale;
  onNavigate?: (term: NomenclatureTerm) => void;
  className?: string;
}

export const InfoTermBadge: React.FC<InfoTermBadgeProps> = ({
  term,
  locale: propLocale,
  onNavigate: propOnNavigate,
  className = "",
}) => {
  const rootCtx = useRootAppLocale();
  const effectiveLocale = propLocale ?? rootCtx.locale;
  const effectiveOnNavigate = propOnNavigate ?? rootCtx.onNavigateTerm;
  const t = useTranslator(effectiveLocale);
  const tooltipText = t(`rootApp.nomenclature.terms.${term}.tooltip`);
  const termTitle = t(`rootApp.nomenclature.terms.${term}.title`);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (effectiveOnNavigate) {
      effectiveOnNavigate(term);
    } else {
      const el = document.getElementById(`nomenclature-term-${term}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <span className={`relative inline-flex items-center group ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center p-0.5 rounded-full text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer transition"
        aria-label={t("rootApp.nomenclature.infoBadgeAria", { term: termTitle })}
        title={tooltipText}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Accessible Hover / Focus Tooltip */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-[#0d1424] border border-white/[0.12] shadow-2xl text-[11px] leading-tight text-slate-200 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-30 text-center"
      >
        {tooltipText}
        <span className="block mt-1 text-[9px] text-indigo-400 font-medium">
          {t("rootApp.nomenclature.viewGuide")}
        </span>
      </span>
    </span>
  );
};
