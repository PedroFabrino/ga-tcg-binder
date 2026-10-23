"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Store,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  ExternalLink,
  Check,
  CheckCircle2,
  Loader2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import MarketplaceCardRow from "@/components/marketplace/MarketplaceCardRow";
import { ALL_ELEMENTS, ELEMENT_COLORS, ELEMENT_LABELS, normalizeElement } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import type {
  GlobalMarketplaceCardItem,
  GlobalMarketReport,
} from "@/services/marketplace";

type ShortageFilter = "ALL_SHORTAGES" | "HARD_ONLY" | "SHARED_ONLY" | "STAPLES_ONLY" | "ALL_MARKET";
type PriceFilter = "ALL" | "FAIR_ONLY" | "OVERPRICED_ONLY" | "HEAVILY_OVERPRICED_ONLY";

export default function MarketplacePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [report, setReport] = useState<GlobalMarketReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrichingTcg, setEnrichingTcg] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  // Filters
  const [query, setQuery] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [shortageFilter, setShortageFilter] = useState<ShortageFilter>("ALL_SHORTAGES");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("ALL");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);

  const userIdQuery = session?.user?.id ? `?userId=${session.user.id}` : "";

  const fetchMarket = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/market${userIdQuery}`);
      if (!res.ok) throw new Error("Failed to load global marketplace");
      const data: GlobalMarketReport = await res.json();
      setReport(data);

      // Default to ALL_MARKET if there are no shortages to display
      if (
        data.summary.hardShortagesCount === 0 &&
        data.summary.sharedShortagesCount === 0
      ) {
        setShortageFilter("ALL_MARKET");
      }
    } catch (err: any) {
      showToast(err.message || "Could not load MyP market", "error");
    } finally {
      setLoading(false);
    }
  }, [userIdQuery, showToast]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);


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
      await fetchMarket();
    } catch (err: any) {
      showToast(err.message || "Failed to check TCG prices", "error");
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

  const filteredCards = useMemo(() => {
    if (!report?.cards) return [];
    let list = report.cards;

    if (selectedStoreId) {
      list = list.filter((c) => c.storeId === selectedStoreId);
    }

    if (shortageFilter === "ALL_SHORTAGES") {
      list = list.filter((c) => c.shortageTier !== "NONE" && c.netExternalStock > 0);
    } else if (shortageFilter === "HARD_ONLY") {
      list = list.filter((c) => c.shortageTier === "HARD" && c.netExternalStock > 0);
    } else if (shortageFilter === "SHARED_ONLY") {
      list = list.filter((c) => c.shortageTier === "SHARED" && c.netExternalStock > 0);
    } else if (shortageFilter === "STAPLES_ONLY") {
      list = list.filter((c) => c.isMetaStaple && c.netExternalStock > 0);
    }

    if (selectedElements.length > 0) {
      list = list.filter((c) => {
        const el = normalizeElement(c.element);
        return selectedElements.some((sel) => normalizeElement(sel) === el);
      });
    }

    if (selectedRarities.length > 0) {
      list = list.filter((c) => selectedRarities.includes(c.rarity || 1));
    }

    if (priceFilter === "FAIR_ONLY") {
      list = list.filter(
        (c) =>
          c.priceFairness?.tier === "NORMAL" ||
          c.priceFairness?.tier === "BELOW_MARKET"
      );
    } else if (priceFilter === "OVERPRICED_ONLY") {
      list = list.filter(
        (c) =>
          c.priceFairness?.tier === "SLIGHTLY_OVERPRICED" ||
          c.priceFairness?.tier === "HEAVILY_OVERPRICED"
      );
    } else if (priceFilter === "HEAVILY_OVERPRICED_ONLY") {
      list = list.filter((c) => c.priceFairness?.tier === "HEAVILY_OVERPRICED");
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => {
        const nameMatch =
          c.cardName.toLowerCase().includes(q) || c.rawName.toLowerCase().includes(q);
        const setMatch = c.setPrefix.toLowerCase().includes(q);
        const deckMatch = c.deckNeeds.some((d) => d.deckName.toLowerCase().includes(q));
        const stapleMatch = c.stapleCategories?.some((cat) => cat.toLowerCase().includes(q));
        return nameMatch || setMatch || deckMatch || stapleMatch;
      });
    }

    return list;
  }, [report?.cards, selectedStoreId, shortageFilter, priceFilter, selectedElements, selectedRarities, query]);

  const summary = report?.summary;

  const selectedStore = useMemo(() => {
    if (!selectedStoreId || !summary?.stores) return null;
    return summary.stores.find((s) => s.id === selectedStoreId) || null;
  }, [selectedStoreId, summary?.stores]);

  const storeScopedCards = useMemo(() => {
    if (!report?.cards) return [];
    if (!selectedStoreId) return report.cards;
    return report.cards.filter((c) => c.storeId === selectedStoreId);
  }, [report?.cards, selectedStoreId]);

  const activeHardCount = useMemo(() => {
    if (!selectedStoreId) return summary?.hardShortagesCount || 0;
    return storeScopedCards.filter((c) => c.shortageTier === "HARD" && c.netExternalStock > 0).length;
  }, [selectedStoreId, summary?.hardShortagesCount, storeScopedCards]);

  const activeSharedCount = useMemo(() => {
    if (!selectedStoreId) return summary?.sharedShortagesCount || 0;
    return storeScopedCards.filter((c) => c.shortageTier === "SHARED" && c.netExternalStock > 0).length;
  }, [selectedStoreId, summary?.sharedShortagesCount, storeScopedCards]);

  const activeTotalListings = useMemo(() => {
    if (!selectedStoreId) return summary?.totalListings || 0;
    return storeScopedCards.length;
  }, [selectedStoreId, summary?.totalListings, storeScopedCards]);

  const handleSelectStore = (storeId: string | null) => {
    const next = selectedStoreId === storeId ? null : storeId;
    setSelectedStoreId(next);
    if (next) {
      const storeCards = report?.cards.filter((c) => c.storeId === next) || [];
      const matchesCurrentFilter = storeCards.some((c) => {
        if (shortageFilter === "ALL_MARKET") return true;
        if (shortageFilter === "HARD_ONLY") return c.shortageTier === "HARD" && c.netExternalStock > 0;
        if (shortageFilter === "SHARED_ONLY") return c.shortageTier === "SHARED" && c.netExternalStock > 0;
        if (shortageFilter === "STAPLES_ONLY") return c.isMetaStaple && c.netExternalStock > 0;
        return c.shortageTier !== "NONE" && c.netExternalStock > 0;
      });
      if (!matchesCurrentFilter) {
        setShortageFilter("ALL_MARKET");
      }
    }
  };

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
                Updated {new Date(summary.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

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

      {/* Summary Stats Cards with One-Click Filter Toggles */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Hard Shortages Card */}
          <div
            onClick={() =>
              setShortageFilter(shortageFilter === "HARD_ONLY" ? "ALL_MARKET" : "HARD_ONLY")
            }
            className={`cursor-pointer rounded-2xl p-4 transition-all ${
              shortageFilter === "HARD_ONLY"
                ? "border-2 border-rose-400 bg-rose-500/[0.12] shadow-[0_0_25px_-5px_rgba(244,63,94,0.4)]"
                : activeHardCount > 0
                ? "glass border border-rose-400/40 bg-rose-500/[0.06] hover:border-rose-400/70"
                : "glass"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-caps text-rose-300 font-bold">{t("marketplace.hardShortagesTitle")}</div>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-rose-300">
              {activeHardCount}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {t("marketplace.hardShortagesDesc")}
            </p>
          </div>

          {/* Shared Shortages Card */}
          <div
            onClick={() =>
              setShortageFilter(shortageFilter === "SHARED_ONLY" ? "ALL_MARKET" : "SHARED_ONLY")
            }
            className={`cursor-pointer rounded-2xl p-4 transition-all ${
              shortageFilter === "SHARED_ONLY"
                ? "border-2 border-amber-400 bg-amber-500/[0.12] shadow-[0_0_25px_-5px_rgba(251,191,36,0.4)]"
                : activeSharedCount > 0
                ? "glass border border-amber-400/40 bg-amber-500/[0.06] hover:border-amber-400/70"
                : "glass"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-caps text-amber-300 font-bold">{t("marketplace.sharedShortagesTitle")}</div>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
              {activeSharedCount}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {t("marketplace.sharedShortagesDesc")}
            </p>
          </div>

          {/* Unique Listings Card */}
          <div
            onClick={() => setShortageFilter("ALL_MARKET")}
            className={`cursor-pointer rounded-2xl p-4 transition-all ${
              shortageFilter === "ALL_MARKET"
                ? "border-2 border-cyan-400 bg-cyan-500/[0.12] shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)]"
                : "glass hover:border-cyan-400/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-caps text-cyan-300">{t("marketplace.uniquePrintingsTitle")}</div>
              <Store className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-white">
              {activeTotalListings}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {selectedStore
                ? t("marketplace.inStockOn", { store: selectedStore.name })
                : t("marketplace.inStockAcrossStores")}
            </p>
          </div>

          {/* Total Copies Card */}
          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">{t("marketplace.totalMarketCopiesTitle")}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">
              {summary.totalMarketCopies}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{t("marketplace.totalMarketCopiesDesc")}</p>
          </div>
        </div>
      )}

      {/* Store Filter Tabs */}
      {summary?.stores && summary.stores.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass" role="group" aria-label={t("marketplace.filterByStore")}>
          <button
            key="all-stores"
            type="button"
            onClick={() => handleSelectStore(null)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedStoreId === null
                ? "bg-white/[0.12] text-white shadow-sm ring-1 ring-white/20"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <Store className="h-3 w-3 text-cyan-400" />
            {t("marketplace.allStoresTab")}
            <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 font-mono text-[10px]">
              {summary.totalListings}
            </span>
          </button>
          {summary.stores.map((s) => {
            const active = selectedStoreId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectStore(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-cyan-500/20 text-cyan-200 shadow-sm ring-1 ring-cyan-400/40"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Store className="h-3 w-3" />
                {s.name}
                <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.2 font-mono text-[10px]">
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter and Priority Tabs Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Quick Filter Pill Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass" role="group" aria-label="Shortage Priority Filters">
            {[
              { id: "ALL_SHORTAGES" as const, label: t("marketplace.allDeckShortagesTab"), count: activeHardCount + activeSharedCount },
              { id: "HARD_ONLY" as const, label: t("marketplace.hardShortagesTab"), count: activeHardCount },
              { id: "SHARED_ONLY" as const, label: t("marketplace.sharedShortagesTab"), count: activeSharedCount },
              {
                id: "ALL_MARKET" as const,
                label: selectedStore
                  ? t("marketplace.allSpecificStoreListingsTab", { store: selectedStore.name })
                  : t("marketplace.allStoreListingsTab"),
                count: activeTotalListings,
              },
            ].map((tab) => {
              const active = shortageFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setShortageFilter(tab.id)}
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

          {/* Search bar */}
          <div className="relative flex flex-1 max-w-md items-center gap-2 rounded-2xl glass p-2 focus-within:border-cyan-400/30">
            <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("marketplace.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white placeholder:text-slate-500 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mr-2 text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Element & Rarity Multi-Select Chips */}
        <div className="flex flex-col gap-2.5 rounded-2xl glass p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 mr-1">Element:</span>
            <button
              type="button"
              onClick={() => setSelectedElements([])}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                selectedElements.length === 0
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                  : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
              }`}
            >
              {selectedElements.length === 0 && <Check className="h-3 w-3 shrink-0 text-cyan-300" />}
              All
            </button>
            {ALL_ELEMENTS.map((el) => {
              const color = ELEMENT_COLORS[el] || "#94a3b8";
              const active = selectedElements.includes(el);
              return (
                <button
                  type="button"
                  key={el}
                  onClick={() => toggleElement(el)}
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
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                  )}
                  <span style={active ? { color } : undefined}>{ELEMENT_LABELS[el] || el}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2">
            <span className="text-[11px] font-medium text-slate-500 mr-1">Rarity:</span>
            <button
              type="button"
              onClick={() => setSelectedRarities([])}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                selectedRarities.length === 0
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                  : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
              }`}
            >
              {selectedRarities.length === 0 && <Check className="h-3 w-3 shrink-0 text-cyan-300" />}
              All
            </button>
            {RARITIES.map((r) => {
              const active = selectedRarities.includes(r.id);
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => toggleRarity(r.id)}
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
                    <Check className="h-3 w-3 shrink-0" style={{ color: r.activeColor }} />
                  ) : (
                    <span
                      className="h-2 w-2 rotate-45 rounded-[2px] shrink-0"
                      style={{ background: r.color }}
                    />
                  )}
                  <span style={active ? { color: r.activeColor } : undefined}>{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Price Fairness Filter */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2">
            <span className="text-[11px] font-medium text-slate-500 mr-1">{t("marketplace.priceCheck")}</span>
            {[
              { id: "ALL" as const, label: t("marketplace.allPrices") },
              { id: "FAIR_ONLY" as const, label: t("marketplace.fairPricesOnly") },
              { id: "OVERPRICED_ONLY" as const, label: t("marketplace.overpriced"), count: summary?.overpricedCount },
              { id: "HEAVILY_OVERPRICED_ONLY" as const, label: t("marketplace.heavilyOverpriced"), count: summary?.heavilyOverpricedCount, alert: true },
            ].map((p) => {
              const active = priceFilter === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriceFilter(p.id)}
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

      {/* Main Listing View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass py-16">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm text-slate-400">{t("marketplace.loadingMarketListings")}</p>
        </div>
      ) : !report || report.cards.length === 0 ? (
        <div className="rounded-2xl glass p-12 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h3 className="text-base font-semibold text-white">{t("marketplace.noMarketDataAvailable")}</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            {t("marketplace.marketDataRefreshesAutomatically")}
          </p>

        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl glass p-10 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-cyan-400/80" />
          <p className="text-sm font-medium text-white">{t("marketplace.noListingsMatch")}</p>
          {selectedStoreId && shortageFilter !== "ALL_MARKET" && (
            <p className="mt-1 text-xs text-slate-400">
              {t("marketplace.storeNoShortagesHint", { store: selectedStore?.name || "Store" })}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setShortageFilter("ALL_MARKET");
              setSelectedElements([]);
              setSelectedRarities([]);
            }}
            className="mt-4"
          >
            {selectedStoreId && shortageFilter !== "ALL_MARKET"
              ? t("marketplace.viewAllStoreListings", { store: selectedStore?.name || "Store" })
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
