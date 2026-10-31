"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Search, X, Sparkles } from "lucide-react";
import { GRAND_ARCHIVE_KEYWORDS } from "@/lib/keywords";
import { useTranslation } from "@/lib/i18n";

export interface CatalogKeywordFilterProps {
  selectedKeywords: string[];
  onChangeKeywords: (keywords: string[]) => void;
  matchMode: "all" | "any";
  onChangeMatchMode: (mode: "all" | "any") => void;
  className?: string;
}

export default function CatalogKeywordFilter({
  selectedKeywords,
  onChangeKeywords,
  matchMode,
  onChangeMatchMode,
  className = "",
}: CatalogKeywordFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredKeywords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GRAND_ARCHIVE_KEYWORDS;
    return GRAND_ARCHIVE_KEYWORDS.filter((k) => k.toLowerCase().includes(q));
  }, [search]);

  const exactMatchExists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return GRAND_ARCHIVE_KEYWORDS.some((k) => k.toLowerCase() === q);
  }, [search]);

  const toggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      onChangeKeywords(selectedKeywords.filter((k) => k !== keyword));
    } else {
      onChangeKeywords([...selectedKeywords, keyword]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = search.trim();
    if (trimmed && !selectedKeywords.includes(trimmed)) {
      onChangeKeywords([...selectedKeywords, trimmed]);
      setSearch("");
    }
  };

  const clearAll = () => {
    onChangeKeywords([]);
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-1 text-left group"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400/80" />
          <span className="label-caps group-hover:text-white transition-colors">
            {t("catalog.filterKeywords")}
          </span>
        </span>
        <div className="flex items-center gap-1.5">
          {selectedKeywords.length > 0 && (
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
              {selectedKeywords.length}
            </span>
          )}
          <ChevronRight
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-90 text-white" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded Section */}
      {isOpen && (
        <div className="space-y-3 pt-1 animate-fade-in">
          {/* Match Mode Selector (AND / OR) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{t("catalog.keywordsMatchMode")}</span>
              {selectedKeywords.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] text-slate-500 hover:text-cyan-300 transition-colors"
                >
                  {t("catalog.clearKeywords")}
                </button>
              )}
            </div>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-black/40 p-1 border border-white/[0.06]"
              role="radiogroup"
              aria-label={t("catalog.keywordsMatchMode")}
            >
              <button
                type="button"
                role="radio"
                aria-checked={matchMode === "all"}
                onClick={() => onChangeMatchMode("all")}
                title={t("catalog.keywordsMatchAllHint")}
                className={`rounded-md py-1 text-center text-[11px] font-medium transition-all ${
                  matchMode === "all"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t("catalog.keywordsMatchAll")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={matchMode === "any"}
                onClick={() => onChangeMatchMode("any")}
                title={t("catalog.keywordsMatchAnyHint")}
                className={`rounded-md py-1 text-center text-[11px] font-medium transition-all ${
                  matchMode === "any"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t("catalog.keywordsMatchAny")}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {matchMode === "all"
                ? t("catalog.keywordsMatchAllHint")
                : t("catalog.keywordsMatchAnyHint")}
            </p>
          </div>

          {/* Keyword Search Input */}
          <div className="relative flex items-center rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1 focus-within:border-cyan-400/40">
            <Search className="h-3 w-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("catalog.searchKeywordsPlaceholder")}
              aria-label={t("catalog.searchKeywordsPlaceholder")}
              className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-white placeholder:text-slate-500 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("catalog.clearKeywords")}
                className="text-slate-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Custom keyword addition button */}
          {!exactMatchExists && search.trim().length > 0 && (
            <button
              type="button"
              onClick={handleAddCustom}
              className="w-full text-left rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
            >
              + {t("catalog.customKeywordAdd", { keyword: search.trim() })}
            </button>
          )}

          {/* Keywords Chips Container */}
          <div className="max-h-48 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
            {filteredKeywords.map((kw) => {
              const active = selectedKeywords.includes(kw);
              return (
                <button
                  key={kw}
                  type="button"
                  onClick={() => toggleKeyword(kw)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
                    active
                      ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-200 shadow-sm"
                      : "border-white/[0.06] text-slate-400 hover:border-white/[0.12] hover:text-slate-200"
                  }`}
                >
                  {kw}
                  {active && <X className="h-2.5 w-2.5 opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
