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
import {
  PageHeader,
  CardArt,
  ElementBadge,
  RarityGem,
  FoilBadge,
} from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { ALL_ELEMENTS, ELEMENT_COLORS, ELEMENT_LABELS, normalizeElement } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import type {
  GlobalMarketplaceCardItem,
  GlobalMarketReport,
} from "@/services/marketplace";

type ShortageFilter = "ALL_SHORTAGES" | "HARD_ONLY" | "SHARED_ONLY" | "ALL_MARKET";

export default function MarketplacePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const [report, setReport] = useState<GlobalMarketReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [shortageFilter, setShortageFilter] = useState<ShortageFilter>("ALL_SHORTAGES");
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

  const handleSyncMarket = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/marketplace/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Market sync failed");

      setReport(data.report);
      showToast(
        `Scanned ${data.stats.totalSynced} items across MyP Cards Grand Archive market!`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to scan MyP Cards market", "error");
    } finally {
      setSyncing(false);
    }
  };

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

    if (shortageFilter === "ALL_SHORTAGES") {
      list = list.filter((c) => c.shortageTier !== "NONE" && c.netExternalStock > 0);
    } else if (shortageFilter === "HARD_ONLY") {
      list = list.filter((c) => c.shortageTier === "HARD" && c.netExternalStock > 0);
    } else if (shortageFilter === "SHARED_ONLY") {
      list = list.filter((c) => c.shortageTier === "SHARED" && c.netExternalStock > 0);
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

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => {
        const nameMatch =
          c.cardName.toLowerCase().includes(q) || c.rawName.toLowerCase().includes(q);
        const setMatch = c.setPrefix.toLowerCase().includes(q);
        const deckMatch = c.deckNeeds.some((d) => d.deckName.toLowerCase().includes(q));
        return nameMatch || setMatch || deckMatch;
      });
    }

    return list;
  }, [report?.cards, shortageFilter, selectedElements, selectedRarities, query]);

  const summary = report?.summary;

  return (
    <div className="pb-14 space-y-6">
      <PageHeader
        eyebrow="External Marketplace"
        title="MyP Market Scanner"
        description="Scans the entire public Grand Archive catalog on MyP Cards for active in-stock listings, prioritized by your deck shortages."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {summary?.lastSyncedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
                <Clock className="h-3 w-3 text-cyan-400" />
                Updated {new Date(summary.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <Button
              onClick={() => handleSyncMarket()}
              disabled={syncing}
              className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold shadow-[0_0_20px_-5px_rgba(34,211,238,0.4)]"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Scanning MyP..." : "Sync MyP Market"}
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
                : summary.hardShortagesCount > 0
                ? "glass border border-rose-400/40 bg-rose-500/[0.06] hover:border-rose-400/70"
                : "glass"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-caps text-rose-300 font-bold">Hard Shortages</div>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-rose-300">
              {summary.hardShortagesCount}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Single-deck shortages available on market
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
                : summary.sharedShortagesCount > 0
                ? "glass border border-amber-400/40 bg-amber-500/[0.06] hover:border-amber-400/70"
                : "glass"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-caps text-amber-300 font-bold">Shared Shortages</div>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
              {summary.sharedShortagesCount}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Extra copies to eliminate swapping
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
              <div className="label-caps text-cyan-300">Unique Printings</div>
              <Store className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-white">
              {summary.totalListings}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">In stock on MyP Cards</p>
          </div>

          {/* Total Copies Card */}
          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Total Market Copies</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">
              {summary.totalMarketCopies}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Combined stock across sellers</p>
          </div>
        </div>
      )}

      {/* Filter and Priority Tabs Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Quick Filter Pill Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass" role="group" aria-label="Shortage Priority Filters">
            {[
              { id: "ALL_SHORTAGES" as const, label: "All Deck Shortages (🔴 + 🟡)", count: (summary?.hardShortagesCount || 0) + (summary?.sharedShortagesCount || 0) },
              { id: "HARD_ONLY" as const, label: "Hard Shortages (🔴)", count: summary?.hardShortagesCount || 0 },
              { id: "SHARED_ONLY" as const, label: "Shared Shortages (🟡)", count: summary?.sharedShortagesCount || 0 },
              { id: "ALL_MARKET" as const, label: "All MyP Listings (🌐)", count: summary?.totalListings || 0 },
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
              placeholder="Search by card name, set prefix, or deck..."
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
        </div>
      </div>

      {/* Main Listing View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass py-16">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm text-slate-400">Loading Grand Archive market listings...</p>
        </div>
      ) : !report || report.cards.length === 0 ? (
        <div className="rounded-2xl glass p-12 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h3 className="text-base font-semibold text-white">No market data available</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Click "Sync MyP Market" to crawl the active Grand Archive catalog from MyP Cards.
          </p>
          <Button
            onClick={() => handleSyncMarket()}
            disabled={syncing}
            className="mt-4 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync MyP Market Now
          </Button>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl glass p-10 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-cyan-400/80" />
          <p className="text-sm font-medium text-white">No listings match the current filters</p>
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
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05] rounded-2xl glass overflow-hidden">
          {filteredCards.map((card) => {
            const isBuyable = card.netExternalStock > 0;
            const isHard = card.shortageTier === "HARD" && isBuyable;
            const isShared = card.shortageTier === "SHARED" && isBuyable;
            const isSelfCollision = card.personalStoreQuantity > 0 && card.netExternalStock === 0;

            return (
              <div
                key={card.id}
                className={`flex flex-col gap-4 p-4 transition-colors md:flex-row md:items-center md:justify-between ${
                  isHard
                    ? "bg-rose-500/[0.06] hover:bg-rose-500/[0.1]"
                    : isShared
                    ? "bg-amber-500/[0.05] hover:bg-amber-500/[0.09]"
                    : "hover:bg-white/[0.015]"
                }`}
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <CardPreviewTrigger
                    name={card.cardName}
                    slug={card.cardSlug || undefined}
                    imageUrl={card.imageUrl || undefined}
                    element={card.element}
                    className="shrink-0 cursor-pointer"
                  >
                    <div
                      className={`relative h-14 w-10 overflow-hidden rounded-md border border-white/[0.1] hover:border-cyan-400/50 transition-colors ${
                        card.isFoil ? "foil-shine" : ""
                      }`}
                    >
                      <CardArt
                        src={card.imageUrl || undefined}
                        alt={card.cardName}
                        className="h-full w-full"
                      />
                    </div>
                  </CardPreviewTrigger>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardPreviewTrigger
                        name={card.cardName}
                        slug={card.cardSlug || undefined}
                        imageUrl={card.imageUrl || undefined}
                        element={card.element}
                        className="inline-block"
                      >
                        <span className="truncate text-sm font-semibold text-white hover:text-cyan-300 transition-colors cursor-pointer">
                          {card.rawName}
                        </span>
                      </CardPreviewTrigger>

                      <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                        {card.setPrefix}
                      </span>

                      {card.isFoil && <FoilBadge />}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <ElementBadge element={card.element} />
                      <RarityGem rarity={card.rarity} />
                      <span className="text-[11px] text-slate-500">{card.class}</span>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400">
                        Type: <span className="text-slate-300">{card.type}</span>
                      </span>
                    </div>

                    {/* Shortage Badges */}
                    {isHard ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                          <AlertTriangle className="h-3 w-3 text-rose-300" />
                          Hard Shortage: Need {card.peakMissing} for {card.peakDeckName || card.deckNeeds[0]?.deckName || "Deck"}
                        </span>
                        {card.deckNeeds.map((d, idx) => (
                          <a
                            key={idx}
                            href={`/decks/${d.deckId}`}
                            className="inline-flex items-center rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-100 hover:border-rose-300"
                          >
                            {d.deckName} <span className="ml-1 font-mono text-rose-300">x{d.quantity}</span>
                          </a>
                        ))}
                      </div>
                    ) : isShared ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          <Sparkles className="h-3 w-3 text-amber-300" />
                          Shared Shortage: Need {card.concurrentMissing} to sleeve all decks
                        </span>
                        {card.deckNeeds.map((d, idx) => (
                          <a
                            key={idx}
                            href={`/decks/${d.deckId}`}
                            className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100 hover:border-amber-300"
                          >
                            {d.deckName} <span className="ml-1 font-mono text-amber-300">x{d.quantity}</span>
                          </a>
                        ))}
                      </div>
                    ) : isSelfCollision && card.shortageTier !== "NONE" ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          <Store className="h-3 w-3 text-amber-300" />
                          Store Offset: All {card.personalStoreQuantity} listed copies are in your MyP Store
                        </span>
                        <a
                          href="/collection?view=MYP_STORE"
                          className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:border-amber-400 hover:bg-amber-400/20"
                        >
                          Claim to Binder
                        </a>
                      </div>
                    ) : card.deckNeeds.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Fully Covered for:
                        </span>
                        {card.deckNeeds.map((d, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400"
                          >
                            {d.deckName} <span className="ml-1 font-mono text-slate-300">x{d.quantity}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* Self-listing collision badge */}
                    {card.personalStoreQuantity > 0 && !isSelfCollision && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <a
                          href="/collection?view=MYP_STORE"
                          className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/20"
                          title="You already own copies of this card listed in your MyP Store"
                        >
                          <Store className="h-2.5 w-2.5 text-amber-400" />
                          You have {card.personalStoreQuantity} listed in your MyP Store
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Quantity, Price & Buy on MyP Link */}
                <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                  <div className="text-left md:text-right mr-2">
                    <div className="font-mono text-base font-bold text-emerald-300">
                      {card.price}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {card.personalStoreQuantity > 0 ? (
                        <>
                          <span className="font-mono font-semibold text-white">{card.netExternalStock}</span> from other sellers
                          <span className="text-slate-500"> ({card.quantity} total)</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono font-semibold text-white">{card.quantity}</span> available
                        </>
                      )}
                    </div>
                  </div>

                  {card.mypProductUrl && (
                    isSelfCollision ? (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 border-amber-400/40 text-amber-200 hover:bg-amber-400/10 text-xs font-semibold"
                      >
                        <a href="/collection?view=MYP_STORE" title="Manage your listings in your MyP Store">
                          <Store className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                          In Your Store
                        </a>
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        className={`h-9 font-semibold text-xs ${
                          isHard
                            ? "bg-rose-500 text-white hover:bg-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]"
                            : isShared
                            ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-[0_0_15px_-3px_rgba(251,191,36,0.3)]"
                            : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                        }`}
                      >
                        <a
                          href={card.mypProductUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open product on MyP Cards to buy"
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Buy on MyP
                        </a>
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
