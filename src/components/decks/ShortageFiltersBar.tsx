"use client";

import { Search, X, Layers, Flame, Store, Check } from "lucide-react";
import { ALL_ELEMENTS, ELEMENT_COLORS } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import { useTranslation } from "@/lib/i18n";

export type GroupMode = "none" | "element" | "deck" | "rarity" | "vendor";

interface ShortageFiltersBarProps {
  query: string;
  setQuery: (q: string) => void;
  groupMode: GroupMode;
  setGroupMode: (mode: GroupMode) => void;
  selectedElements: string[];
  toggleElement: (el: string) => void;
  clearElements: () => void;
  selectedRarities: number[];
  toggleRarity: (r: number) => void;
  clearRarities: () => void;
}

export default function ShortageFiltersBar({
  query,
  setQuery,
  groupMode,
  setGroupMode,
  selectedElements,
  toggleElement,
  clearElements,
  selectedRarities,
  toggleRarity,
  clearRarities,
}: ShortageFiltersBarProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex flex-1 items-center gap-2 rounded-2xl glass p-2">
          <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("shortages.searchPlaceholder")}
            aria-label={t("shortages.filterAriaSearch")}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder:text-slate-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("shortages.filterAriaClear")}
              className="mr-2 text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="inline-flex self-start rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          <button
            onClick={() => setGroupMode("none")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              groupMode === "none" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> {t("shortages.filterFlat")}
          </button>
          <button
            onClick={() => setGroupMode("element")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              groupMode === "element" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="h-3.5 w-3.5" /> {t("shortages.filterByElement")}
          </button>
          <button
            onClick={() => setGroupMode("vendor")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              groupMode === "vendor" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Store className="h-3.5 w-3.5" /> {t("shortages.filterByVendor")}
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-col gap-2 rounded-2xl glass p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 mr-1">{t("shortages.filterElements")}:</span>
          <button
            onClick={clearElements}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
              selectedElements.length === 0
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "border-white/[0.08] text-slate-400 hover:text-slate-200"
            }`}
          >
            {selectedElements.length === 0 && <Check className="h-3 w-3 shrink-0 text-cyan-300" />}
            {t("shortages.filterAll")}
          </button>
          {ALL_ELEMENTS.map((el) => {
            const active = selectedElements.includes(el);
            return (
              <button
                type="button"
                key={el}
                onClick={() => toggleElement(el)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all ${
                  active ? "border-cyan-400 bg-cyan-400/20 text-white font-semibold" : "border-white/[0.08] text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ELEMENT_COLORS[el] }} />
                {el}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2 sm:border-t-0 sm:pt-0">
          <span className="text-[11px] font-medium text-slate-500 mr-1">{t("shortages.filterRarities")}:</span>
          <button
            type="button"
            onClick={clearRarities}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
              selectedRarities.length === 0
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold"
                : "border-white/[0.08] text-slate-400 hover:text-slate-200"
            }`}
          >
            {t("common.all")}
          </button>
          {RARITIES.map((r) => {
            const active = selectedRarities.includes(r.id);
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => toggleRarity(r.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all ${
                  active ? "border-cyan-400 bg-cyan-400/20 text-white font-semibold" : "border-white/[0.08] text-slate-400 hover:text-slate-200"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
