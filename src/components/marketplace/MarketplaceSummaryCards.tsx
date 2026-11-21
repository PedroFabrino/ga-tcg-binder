"use client";

import { AlertTriangle, Sparkles, Store } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { GlobalMarketSummary } from "@/services/marketplace";
import type { MarketplaceFilterCounts, ShortageFilter } from "./filter";

export interface MarketplaceSummaryCardsProps {
  summary: GlobalMarketSummary;
  counts: MarketplaceFilterCounts;
  selectedStoreId: string | null;
  shortageFilter: ShortageFilter;
  onSelectStore: (storeId: string | null) => void;
  onChangeShortageFilter: (filter: ShortageFilter) => void;
}

/**
 * Renders the top marketplace KPI toggle cards and store provenance filter tabs
 * using reactive counts reflecting active search and attribute filters.
 */
export default function MarketplaceSummaryCards({
  summary,
  counts,
  selectedStoreId,
  shortageFilter,
  onSelectStore,
  onChangeShortageFilter,
}: MarketplaceSummaryCardsProps) {
  const { t } = useTranslation();

  const selectedStore =
    selectedStoreId && summary.stores
      ? summary.stores.find((s) => s.id === selectedStoreId) || null
      : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          onClick={() =>
            onChangeShortageFilter(shortageFilter === "HARD_ONLY" ? "ALL_MARKET" : "HARD_ONLY")
          }
          className={`cursor-pointer rounded-2xl p-4 transition-all ${
            shortageFilter === "HARD_ONLY"
              ? "border-2 border-rose-400 bg-rose-500/[0.12] shadow-[0_0_25px_-5px_rgba(244,63,94,0.4)]"
              : counts.hardCount > 0
              ? "glass border border-rose-400/40 bg-rose-500/[0.06] hover:border-rose-400/70"
              : "glass"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="label-caps text-rose-300 font-bold">
              {t("marketplace.hardShortagesTitle")}
            </div>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-rose-300">
            {counts.hardCount}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t("marketplace.hardShortagesDesc")}
          </p>
        </div>

        <div
          onClick={() =>
            onChangeShortageFilter(shortageFilter === "SHARED_ONLY" ? "ALL_MARKET" : "SHARED_ONLY")
          }
          className={`cursor-pointer rounded-2xl p-4 transition-all ${
            shortageFilter === "SHARED_ONLY"
              ? "border-2 border-amber-400 bg-amber-500/[0.12] shadow-[0_0_25px_-5px_rgba(251,191,36,0.4)]"
              : counts.sharedCount > 0
              ? "glass border border-amber-400/40 bg-amber-500/[0.06] hover:border-amber-400/70"
              : "glass"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="label-caps text-amber-300 font-bold">
              {t("marketplace.sharedShortagesTitle")}
            </div>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
            {counts.sharedCount}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t("marketplace.sharedShortagesDesc")}
          </p>
        </div>

        <div
          onClick={() => onChangeShortageFilter("ALL_MARKET")}
          className={`cursor-pointer rounded-2xl p-4 transition-all ${
            shortageFilter === "ALL_MARKET"
              ? "border-2 border-cyan-400 bg-cyan-500/[0.12] shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)]"
              : "glass hover:border-cyan-400/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="label-caps text-cyan-300">
              {t("marketplace.uniquePrintingsTitle")}
            </div>
            <Store className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">
            {counts.totalListings}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {selectedStore
              ? t("marketplace.inStockOn", { store: selectedStore.name })
              : t("marketplace.inStockAcrossStores")}
          </p>
        </div>

        <div className="rounded-2xl glass p-4">
          <div className="label-caps text-slate-400">
            {t("marketplace.totalMarketCopiesTitle")}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">
            {counts.totalMarketCopies}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {t("marketplace.totalMarketCopiesDesc")}
          </p>
        </div>
      </div>

      {summary.stores && summary.stores.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass"
          role="group"
          aria-label={t("marketplace.filterByStore")}
        >
          <button
            key="all-stores"
            type="button"
            onClick={() => onSelectStore(null)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedStoreId === null
                ? "bg-white/[0.12] text-white shadow-sm ring-1 ring-white/20"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <Store className="h-3 w-3 text-cyan-400" />
            {t("marketplace.allStoresTab")}
            <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 font-mono text-[10px]">
              {counts.allStoresCount}
            </span>
          </button>
          {summary.stores.map((s) => {
            const active = selectedStoreId === s.id;
            const storeCount = counts.storeCounts.get(s.id) ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStore(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-cyan-500/20 text-cyan-200 shadow-sm ring-1 ring-cyan-400/40"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Store className="h-3 w-3" />
                {s.name}
                <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 font-mono text-[10px]">
                  {storeCount}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
