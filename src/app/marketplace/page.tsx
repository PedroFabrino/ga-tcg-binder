"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Store, RefreshCw, AlertTriangle, Loader2, Clock } from "lucide-react";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import MarketplaceCardRow from "@/components/marketplace/MarketplaceCardRow";
import MarketplaceSummaryCards from "@/components/marketplace/MarketplaceSummaryCards";
import MarketplaceFiltersBar from "@/components/marketplace/MarketplaceFiltersBar";
import {
  computeMarketplaceFilterCounts,
  filterGlobalMarketplaceCards,
  matchesShortageFilter,
  type PriceFilter,
  type ShortageFilter,
} from "@/components/marketplace/filter";
import { useMarketplaceReportQuery } from "@/hooks/queries/use-marketplace-queries";
import type { GlobalMarketReport } from "@/services/marketplace";

export default function MarketplacePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const {
    data: cachedReport,
    isLoading: isMarketLoading,
    isFetching,
    refetch: refetchMarket,
  } = useMarketplaceReportQuery(session?.user?.id);

  const [report, setReport] = useState<GlobalMarketReport | null>(null);
  const loading = isMarketLoading && !report;
  const [enrichingTcg, setEnrichingTcg] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [shortageFilter, setShortageFilter] = useState<ShortageFilter>("ALL_SHORTAGES");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("ALL");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);

  useEffect(() => {
    if (cachedReport) {
      setReport(cachedReport);
      if (
        cachedReport.summary.hardShortagesCount === 0 &&
        cachedReport.summary.sharedShortagesCount === 0
      ) {
        setShortageFilter("ALL_MARKET");
      }
    }
  }, [cachedReport]);

  const handleEnrichTcg = async (targetCardIds?: string[]) => {
    if (enrichingTcg) return;
    setEnrichingTcg(true);
    if (targetCardIds && targetCardIds.length > 0) {
      setEnrichingIds(new Set(targetCardIds));
    }
    try {
      const res = await fetch("/api/marketplace/enrich-tcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardIds: targetCardIds,
          limit: targetCardIds ? targetCardIds.length : 25,
          onlyShortages: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Price enrichment failed");

      showToast(
        `Checked TCG Player prices: ${data.enrichedCount || 0} listings updated!`,
        "success"
      );
      await refetchMarket();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to check TCG prices";
      showToast(message, "error");
    } finally {
      setEnrichingTcg(false);
      setEnrichingIds(new Set());
    }
  };

  const handleCardAddedToBinder = useCallback((cardId: string, quantityAdded: number) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map((c) => {
          if (c.id !== cardId) return c;
          const newOwned = (c.totalBinderOwned ?? 0) + quantityAdded;
          const newConcurrentMissing = Math.max(0, c.concurrentMissing - quantityAdded);
          const newPeakMissing = Math.max(0, c.peakMissing - quantityAdded);
          return {
            ...c,
            totalBinderOwned: newOwned,
            concurrentMissing: newConcurrentMissing,
            peakMissing: newPeakMissing,
            shortageTier: newConcurrentMissing === 0 ? "NONE" : c.shortageTier,
          };
        }),
      };
    });
  }, []);

  const toggleElement = (el: string) => {
    setSelectedElements((prev) =>
      prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]
    );
  };

  const toggleRarity = (rarityId: number) => {
    setSelectedRarities((prev) =>
      prev.includes(rarityId) ? prev.filter((r) => r !== rarityId) : [...prev, rarityId]
    );
  };

  const filterState = useMemo(
    () => ({
      selectedStoreId,
      shortageFilter,
      priceFilter,
      selectedElements,
      selectedRarities,
      query,
    }),
    [selectedStoreId, shortageFilter, priceFilter, selectedElements, selectedRarities, query]
  );

  const filteredCards = useMemo(() => {
    if (!report?.cards) return [];
    return filterGlobalMarketplaceCards(report.cards, filterState);
  }, [report?.cards, filterState]);

  const counts = useMemo(
    () => computeMarketplaceFilterCounts(report?.cards ?? [], filterState),
    [report?.cards, filterState]
  );

  const summary = report?.summary;

  const selectedStore = useMemo(() => {
    if (!selectedStoreId || !summary?.stores) return null;
    return summary.stores.find((s) => s.id === selectedStoreId) || null;
  }, [selectedStoreId, summary?.stores]);

  const handleSelectStore = (storeId: string | null) => {
    const next = selectedStoreId === storeId ? null : storeId;
    setSelectedStoreId(next);
    if (next) {
      const storeCards = report?.cards.filter((c) => c.storeId === next) || [];
      const matchesCurrentFilter = storeCards.some((c) =>
        matchesShortageFilter(c, shortageFilter)
      );
      if (!matchesCurrentFilter) {
        setShortageFilter("ALL_MARKET");
      }
    }
  };

  const canRevealInAllMarket = shortageFilter !== "ALL_MARKET" && counts.totalListings > 0;

  return (
    <div className="pb-14 space-y-6">
      <PageHeader
        eyebrow={t("common.marketplace")}
        title={t("marketplace.title")}
        description={t("marketplace.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {summary?.lastSyncedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
                <Clock className="h-3 w-3 text-cyan-400" />
                Updated{" "}
                {new Date(summary.lastSyncedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchMarket();
                showToast(t("common.refresh"), "info");
              }}
              className="gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              title={t("common.refresh")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={() => handleEnrichTcg()}
              disabled={enrichingTcg}
              variant="outline"
              className="gap-2 border-amber-400/40 text-amber-200 hover:bg-amber-400/10 font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${enrichingTcg ? "animate-spin" : ""}`} />
              {enrichingTcg ? t("marketplace.checkingTcg") : t("marketplace.checkTcgPrices")}
            </Button>
          </div>
        }
      />

      {summary && (
        <MarketplaceSummaryCards
          summary={summary}
          counts={counts}
          selectedStoreId={selectedStoreId}
          shortageFilter={shortageFilter}
          onSelectStore={handleSelectStore}
          onChangeShortageFilter={setShortageFilter}
        />
      )}

      <MarketplaceFiltersBar
        query={query}
        onQueryChange={setQuery}
        shortageFilter={shortageFilter}
        onShortageFilterChange={setShortageFilter}
        priceFilter={priceFilter}
        onPriceFilterChange={setPriceFilter}
        selectedElements={selectedElements}
        onToggleElement={toggleElement}
        onClearElements={() => setSelectedElements([])}
        selectedRarities={selectedRarities}
        onToggleRarity={toggleRarity}
        onClearRarities={() => setSelectedRarities([])}
        selectedStoreName={selectedStore?.name || null}
        counts={counts}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass py-16">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm text-slate-400">{t("marketplace.loadingMarketListings")}</p>
        </div>
      ) : !report || report.cards.length === 0 ? (
        <div className="rounded-2xl glass p-12 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h3 className="text-base font-semibold text-white">
            {t("marketplace.noMarketDataAvailable")}
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            {t("marketplace.marketDataRefreshesAutomatically")}
          </p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl glass p-10 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-cyan-400/80" />
          <p className="text-sm font-medium text-white">{t("marketplace.noListingsMatch")}</p>
          {selectedStoreId && shortageFilter !== "ALL_MARKET" && !query.trim() && (
            <p className="mt-1 text-xs text-slate-400">
              {t("marketplace.storeNoShortagesHint", {
                store: selectedStore?.name || t("common.store"),
              })}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (canRevealInAllMarket) {
                setShortageFilter("ALL_MARKET");
                return;
              }
              setQuery("");
              setShortageFilter("ALL_MARKET");
              setPriceFilter("ALL");
              setSelectedElements([]);
              setSelectedRarities([]);
            }}
            className="mt-4"
          >
            {canRevealInAllMarket
              ? selectedStore
                ? t("marketplace.viewAllStoreListings", { store: selectedStore.name })
                : t("marketplace.allStoreListingsTab")
              : t("marketplace.resetFilters")}
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05] rounded-2xl glass overflow-hidden">
          {filteredCards.map((card) => (
            <MarketplaceCardRow
              key={card.id}
              card={card}
              onAddedToBinder={handleCardAddedToBinder}
              onEnrichTcg={(id) => handleEnrichTcg([id])}
              isEnrichingTcg={enrichingIds.has(card.id) || enrichingTcg}
            />
          ))}
        </div>
      )}
    </div>
  );
}
