import React from "react";
import { BookOpen } from "lucide-react";
import type { SupportedLocale } from "@ga/contracts";
import { useTranslator } from "../hooks/useTranslator";
import type { NomenclatureTerm } from "./InfoTermBadge";

export interface NomenclatureGuideCardProps {
  locale?: SupportedLocale;
  highlightedTerm?: NomenclatureTerm | null;
}

const ORDERED_TERMS: readonly NomenclatureTerm[] = [
  "shortages",
  "hardShortages",
  "sharedShortages",
  "alertScope",
  "wantlist",
  "omnidexFormat",
] as const;

export const NomenclatureGuideCard: React.FC<NomenclatureGuideCardProps> = ({
  locale,
  highlightedTerm,
}) => {
  const t = useTranslator(locale);

  return (
    <section
      aria-labelledby="nomenclature-guide-heading"
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm shadow-xl transition-all space-y-5"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2
            id="nomenclature-guide-heading"
            className="text-base font-semibold text-slate-100"
          >
            {t("rootApp.nomenclature.guideTitle")}
          </h2>
          <p className="text-xs text-slate-400">
            {t("rootApp.nomenclature.guideSubtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ORDERED_TERMS.map((term) => {
          const isHighlighted = highlightedTerm === term;
          const title = t(`rootApp.nomenclature.terms.${term}.title`);
          const desc = t(`rootApp.nomenclature.terms.${term}.desc`);
          const example = t(`rootApp.nomenclature.terms.${term}.example`);

          return (
            <article
              key={term}
              id={`nomenclature-term-${term}`}
              tabIndex={-1}
              className={`p-4 rounded-lg border transition-all duration-300 space-y-2.5 ${
                isHighlighted
                  ? "border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
                  : "border-white/[0.04] bg-black/20 hover:border-white/[0.08]"
              }`}
            >
              <h3 className="text-sm font-semibold text-slate-200">
                {title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {desc}
              </p>
              <div className="mt-2 p-2.5 rounded bg-black/40 border border-white/[0.04] text-[11px] font-mono text-slate-400 whitespace-pre-line leading-relaxed">
                {example}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
