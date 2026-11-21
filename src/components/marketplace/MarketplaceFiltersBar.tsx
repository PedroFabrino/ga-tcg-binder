"use client";

import { Check, Search, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ALL_ELEMENTS, ELEMENT_COLORS, ELEMENT_LABELS } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import type {
  MarketplaceFilterCounts,
  PriceFilter,
  ShortageFilter,
} from "./filter";

export interface MarketplaceFiltersBarProps {
  query: string;
  onQueryChange: (nextQuery: string) => void;
  shortageFilter: ShortageFilter;
  onShortageFilterChange: (nextFilter: ShortageFilter) => void;
  priceFilter: PriceFilter;
  onPriceFilterChange: (nextFilter: PriceFilter) => void;
  selectedElements: string[];
  onToggleElement: (element: string) => void;
  onClearElements: () => void;
  selectedRarities: number[];
  onToggleRarity: (rarityId: number) => void;
  onClearRarities: () => void;
  selectedStoreName: string | null;
  counts: MarketplaceFilterCounts;
}

/**
 * Renders the marketplace priority tabs, card search input, element/rarity chips,
 * and TCGPlayer price fairness filters.
 */
export default function MarketplaceFiltersBar({
  query,
  onQueryChange,
  shortageFilter,
  onShortageFilterChange,
  priceFilter,
  onPriceFilterChange,
  selectedElements,
  onToggleElement,
  onClearElements,
  selectedRarities,
  onToggleRarity,
  onClearRarities,
  selectedStoreName,
  counts,
}: MarketplaceFiltersBarProps) {
  const { t } = useTranslation();

  const shortageTabs = [
    {
      id: "ALL_SHORTAGES" as const,
      label: t("marketplace.allDeckShortagesTab"),
      count: counts.hardCount + counts.sharedCount,
    },
    {
      id: "HARD_ONLY" as const,
      label: t("marketplace.hardShortagesTab"),
      count: counts.hardCount,
    },
    {
      id: "SHARED_ONLY" as const,
      label: t("marketplace.sharedShortagesTab"),
      count: counts.sharedCount,
    },
    {
      id: "ALL_MARKET" as const,
      label: selectedStoreName
        ? t("marketplace.allSpecificStoreListingsTab", { store: selectedStoreName })
        : t("marketplace.allStoreListingsTab"),
      count: counts.totalListings,
    },
  ];

  const priceOptions = [
    { id: "ALL" as const, label: t("marketplace.allPrices") },
    { id: "FAIR_ONLY" as const, label: t("marketplace.fairPricesOnly") },
    {
      id: "OVERPRICED_ONLY" as const,
      label: t("marketplace.overpriced"),
      count: counts.overpricedCount,
    },
    {
      id: "HEAVILY_OVERPRICED_ONLY" as const,
      label: t("marketplace.heavilyOverpriced"),
      count: counts.heavilyOverpricedCount,
      alert: true,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass"
          role="group"
          aria-label={t("marketplace.allDeckShortagesTab")}
        >
          {shortageTabs.map((tab) => {
            const active = shortageFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onShortageFilterChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-white/[0.12] text-white shadow-sm ring-1 ring-white/20"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
                <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 font-mono text-[10px]">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex flex-1 max-w-md items-center gap-2 rounded-2xl glass p-2 focus-within:border-cyan-400/30">
          <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("marketplace.searchPlaceholder")}
            aria-label={t("marketplace.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white placeholder:text-slate-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label={t("collection.clearFilterAria")}
              className="mr-2 text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl glass p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 mr-1">
            {t("sets.checklist.filterElement")}:
          </span>
          <button
            type="button"
            onClick={onClearElements}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedElements.length === 0
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
            }`}
          >
            {selectedElements.length === 0 && (
              <Check className="h-3 w-3 shrink-0 text-cyan-300" />
            )}
            {t("common.all")}
          </button>
          {ALL_ELEMENTS.map((el) => {
            const color = ELEMENT_COLORS[el] || "#94a3b8";
            const active = selectedElements.includes(el);
            return (
              <button
                type="button"
                key={el}
                onClick={() => onToggleElement(el)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                  active
                    ? "font-semibold ring-1 ring-white/20 text-white"
                    : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
                }`}
                style={
                  active
                    ? {
                        borderColor: color,
                        backgroundColor: `${color}28`,
                        boxShadow: `0 0 10px ${color}40`,
                      }
                    : undefined
                }
              >
                {active ? (
                  <Check className="h-3 w-3 shrink-0" style={{ color }} />
                ) : (
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                )}
                <span style={active ? { color } : undefined}>
                  {ELEMENT_LABELS[el] || el}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2">
          <span className="text-[11px] font-medium text-slate-500 mr-1">
            {t("sets.checklist.filterRarity")}:
          </span>
          <button
            type="button"
            onClick={onClearRarities}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
              selectedRarities.length === 0
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
            }`}
          >
            {selectedRarities.length === 0 && (
              <Check className="h-3 w-3 shrink-0 text-cyan-300" />
            )}
            {t("common.all")}
          </button>
          {RARITIES.map((r) => {
            const active = selectedRarities.includes(r.id);
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => onToggleRarity(r.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                  active
                    ? "font-semibold ring-1 ring-white/20 text-white"
                    : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
                }`}
                style={
                  active
                    ? {
                        borderColor: r.activeColor,
                        backgroundColor: `${r.activeColor}28`,
                        boxShadow: `0 0 10px ${r.activeColor}40`,
                      }
                    : undefined
                }
              >
                {active ? (
                  <Check
                    className="h-3 w-3 shrink-0"
                    style={{ color: r.activeColor }}
                  />
                ) : (
                  <span
                    className="h-2 w-2 rotate-45 rounded-[2px] shrink-0"
                    style={{ background: r.color }}
                  />
                )}
                <span style={active ? { color: r.activeColor } : undefined}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2">
          <span className="text-[11px] font-medium text-slate-500 mr-1">
            {t("marketplace.priceCheck")}
          </span>
          {priceOptions.map((p) => {
            const active = priceFilter === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onPriceFilterChange(p.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                  active
                    ? p.alert
                      ? "border-red-400 bg-red-500/20 text-red-200 font-semibold shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                      : "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                    : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
                }`}
              >
                {active && <Check className="h-3 w-3 shrink-0" />}
                <span>{p.label}</span>
                {typeof p.count === "number" && p.count > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
                      p.alert ? "bg-red-500/30 text-red-200" : "bg-white/10 text-white"
                    }`}
                  >
                    {p.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
