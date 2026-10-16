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
  ArrowDownToLine,
  Check,
  Sparkles,
  CheckCircle2,
  Edit3,
  Loader2,
  Minus,
  Plus,
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
import type { MarketplaceCardItem, MarketplaceReport } from "@/services/marketplace";

const RARITIES = [
  { id: 1, label: "Common", color: "#94a3b8", activeColor: "#f8fafc" },
  { id: 2, label: "Uncommon", color: "#10b981", activeColor: "#34d399" },
  { id: 3, label: "Rare", color: "#06b6d4", activeColor: "#22d3ee" },
  { id: 4, label: "Super Rare", color: "#f59e0b", activeColor: "#fbbf24" },
  { id: 5, label: "Ultra Rare", color: "#f43f5e", activeColor: "#fb7185" },
  { id: 7, label: "Collector", color: "#e8c967", activeColor: "#fde047" },
];

export default function MarketplacePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const [report, setReport] = useState<MarketplaceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimQuantities, setClaimQuantities] = useState<Record<string, number>>({});

  // Username onboarding / editing state
  const [usernameInput, setUsernameInput] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [onlyShortages, setOnlyShortages] = useState(false);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);

  const userIdQuery = session?.user?.id ? `?userId=${session.user.id}` : "";

  const fetchMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace${userIdQuery}`);
      if (!res.ok) throw new Error("Failed to load marketplace data");
      const data: MarketplaceReport = await res.json();
      setReport(data);
      if (data.mypUsername) {
        setUsernameInput(data.mypUsername);
      }
    } catch (err: any) {
      showToast(err.message || "Could not load MyP listings", "error");
    } finally {
      setLoading(false);
    }
  }, [userIdQuery, showToast]);

  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  const handleSync = async (overrideUsername?: string) => {
    const targetUsername = (overrideUsername ?? usernameInput ?? report?.mypUsername ?? "").trim();
    if (!targetUsername) {
      showToast("Please enter your MyP Cards username first.", "error");
      setEditingUsername(true);
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/marketplace/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user?.id,
          username: targetUsername,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      setReport(data.report);
      setUsernameInput(data.report.mypUsername || targetUsername);
      setEditingUsername(false);
      showToast(
        `Synced ${data.stats.totalSynced} listings from MyP (@${data.stats.username})!`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to sync with MyP Cards", "error");
    } finally {
      setSyncing(false);
    }
  };

  const getClaimQuantity = (card: MarketplaceCardItem) => {
    return claimQuantities[card.id] ?? 1;
  };

  const setClaimQuantity = (cardId: string, max: number, qty: number) => {
    const clamped = Math.max(1, Math.min(max, qty));
    setClaimQuantities((prev) => ({
      ...prev,
      [cardId]: clamped,
    }));
  };

  const handleClaimCard = async (card: MarketplaceCardItem, qty?: number) => {
    const claimQty = qty ?? getClaimQuantity(card);
    setClaimingId(card.id);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          userId: session?.user?.id,
          mypCardId: card.id,
          quantity: claimQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");

      setReport(data.report);
      // Reset modified quantity for this card
      setClaimQuantities((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });

      showToast(
        `Added ${data.claimedQuantity}x ${card.cardName} to your Binder! Opening MyP listing to delist...`,
        "success"
      );

      const urlToOpen = data.mypProductUrl || card.mypProductUrl;
      if (urlToOpen) {
        window.open(urlToOpen, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      showToast(err.message || "Could not claim card to binder", "error");
    } finally {
      setClaimingId(null);
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

    if (onlyShortages) {
      list = list.filter((c) => c.isShortageOffset);
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
  }, [report?.cards, onlyShortages, selectedElements, selectedRarities, query]);

  const summary = report?.summary;
  const needsOnboarding = !loading && (!report?.mypUsername || editingUsername);

  return (
    <div className="pb-14 space-y-6">
      <PageHeader
        eyebrow="Marketplace Listings"
        title="MyP Cards Store"
        description="Maintain a separate snapshot of your MyP Cards listings, detect active deck shortages sitting in your store, and claim copies directly into your binder."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {report?.mypUsername && !editingUsername && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                <Store className="h-3.5 w-3.5 text-cyan-400" />
                <a
                  href={`https://mypcards.com/${encodeURIComponent(report.mypUsername)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-white hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                >
                  @{report.mypUsername}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
                <button
                  type="button"
                  onClick={() => setEditingUsername(true)}
                  className="ml-1 text-slate-500 hover:text-white transition-colors"
                  title="Change MyP username"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>
            )}

            <Button
              onClick={() => handleSync()}
              disabled={syncing}
              className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing MyP..." : "Sync MyP"}
            </Button>
          </div>
        }
      />

      {/* Onboarding / Username Setup Prompt */}
      {needsOnboarding && (
        <div className="rounded-2xl glass-strong border border-cyan-400/25 p-6 shadow-[0_0_30px_-10px_rgba(34,211,238,0.2)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
                <Store className="h-4 w-4" /> Connect MyP Cards Store
              </div>
              <h2 className="text-lg font-bold text-white">
                Enter your MyP Cards username or profile URL
              </h2>
              <p className="text-xs text-slate-400 max-w-xl">
                We will crawl your public Grand Archive listings on MyP Cards, store them in a dedicated table isolated from your binder, and alert you whenever a listed card is missing from your decks.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSync(usernameInput);
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-[300px]"
            >
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. Fabrino or https://mypcards.com/Fabrino"
                className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={syncing || !usernameInput.trim()}
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold whitespace-nowrap"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Syncing...
                    </>
                  ) : (
                    "Save & Sync"
                  )}
                </Button>
                {report?.mypUsername && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUsernameInput(report.mypUsername || "");
                      setEditingUsername(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {summary && summary.totalListings > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            onClick={() => setOnlyShortages(!onlyShortages)}
            className={`cursor-pointer rounded-2xl p-4 transition-all ${
              summary.shortageOffsetCount > 0
                ? "glass border border-amber-400/35 bg-amber-500/[0.07] shadow-[0_0_20px_-8px_rgba(251,191,36,0.35)]"
                : "glass"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-caps text-amber-300/90">Deck Shortage Alerts</div>
              <AlertTriangle
                className={`h-4 w-4 ${
                  summary.shortageOffsetCount > 0 ? "text-amber-400" : "text-slate-600"
                }`}
              />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
              {summary.shortageOffsetCount}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {summary.shortageOffsetCopies} copies needed in your decks
            </p>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Unique Listings</div>
            <div className="mt-1 font-mono text-2xl font-bold text-white">
              {summary.totalListings}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Active listings on MyP</p>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Total Copies</div>
            <div className="mt-1 font-mono text-2xl font-bold text-cyan-300">
              {summary.totalCopies}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Physical cards listed</p>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Total Listed Value</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">
              R${" "}
              {summary.totalValueBrl.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Based on MyP asking prices</p>
          </div>
        </div>
      )}

      {/* Shortage Offset Callout Banner */}
      {summary && summary.shortageOffsetCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">
                You have {summary.shortageOffsetCount} card(s) listed on MyP that are currently missing in your decks!
              </h3>
              <p className="text-xs text-amber-100/75 mt-0.5">
                Claiming a card moves it into your Binder and opens its MyP listing in a new tab so you can immediately update or remove it from sale.
              </p>
            </div>
          </div>
          <Button
            variant={onlyShortages ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyShortages(!onlyShortages)}
            className={
              onlyShortages
                ? "bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold shrink-0"
                : "border-amber-400/40 text-amber-200 hover:bg-amber-400/15 shrink-0"
            }
          >
            {onlyShortages ? "Showing Shortage Alerts Only" : "Filter Shortage Alerts"}
          </Button>
        </div>
      )}

      {/* Search & Additive Filters */}
      {report && report.cards.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex flex-1 items-center gap-2 rounded-2xl glass p-2 focus-within:border-cyan-400/30">
              <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by card name, edition (PTM, RDO...), or deck name..."
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder:text-slate-500 outline-none"
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

            <button
              type="button"
              onClick={() => setOnlyShortages(!onlyShortages)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                onlyShortages
                  ? "border-amber-400 bg-amber-400/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                  : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Shortage Alerts Only
              {onlyShortages && <Check className="h-3.5 w-3.5 text-amber-300" />}
            </button>
          </div>

          {/* Element & Rarity Multi-Select Chips */}
          <div className="flex flex-col gap-2.5 rounded-2xl glass p-3">
            {/* Element Chips */}
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

            {/* Rarity Chips */}
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
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass py-16">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm text-slate-400">Loading your MyP Marketplace listings...</p>
        </div>
      ) : !report || report.cards.length === 0 ? (
        <div className="rounded-2xl glass p-12 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h3 className="text-base font-semibold text-white">No MyP Cards synced yet</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            {report?.mypUsername
              ? `Click "Sync MyP" above to crawl your listings from mypcards.com/${report.mypUsername}.`
              : "Enter your MyP Cards username above to import your external listings."}
          </p>
          {report?.mypUsername && (
            <Button
              onClick={() => handleSync()}
              disabled={syncing}
              className="mt-4 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync MyP Now
            </Button>
          )}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl glass p-10 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400/80" />
          <p className="text-sm font-medium text-white">No listings match the current filters</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setOnlyShortages(false);
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
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className={`flex flex-col gap-4 p-4 transition-colors md:flex-row md:items-center md:justify-between ${
                card.isShortageOffset
                  ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.1]"
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

                    <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      {card.quality}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <ElementBadge element={card.element} />
                    <RarityGem rarity={card.rarity} />
                    <span className="text-[11px] text-slate-500">{card.class}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-400">
                      In Binder:{" "}
                      <span className="font-mono font-semibold text-slate-200">
                        {card.totalBinderOwned}
                      </span>
                    </span>
                  </div>

                  {/* Shortage / Deck Usage Alerts */}
                  {card.isShortageOffset ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                        <AlertTriangle className="h-3 w-3 text-amber-300" />
                        Missing {card.concurrentMissing} in Decks:
                      </span>
                      {card.deckNeeds.map((d, idx) => (
                        <a
                          key={idx}
                          href={`/decks/${d.deckId}`}
                          className="inline-flex items-center rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-100 hover:border-amber-300"
                        >
                          Needed in {d.deckName} <span className="ml-1 font-mono text-amber-300">x{d.quantity}</span>
                        </a>
                      ))}
                    </div>
                  ) : card.deckNeeds.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Covered in Binder for:
                      </span>
                      {card.deckNeeds.map((d, idx) => (
                        <a
                          key={idx}
                          href={`/decks/${d.deckId}`}
                          className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                        >
                          {d.deckName} <span className="ml-1 font-mono text-slate-300">x{d.quantity}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right: Quantity, Price & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                <div className="text-left md:text-right mr-2">
                  <div className="font-mono text-sm font-bold text-emerald-300">
                    {card.price}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Listed Qty: <span className="font-mono font-semibold text-white">{card.quantity}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {card.mypProductUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-white/10 text-slate-300 hover:text-white"
                    >
                      <a
                        href={card.mypProductUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open listing on MyP Cards"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        MyP Listing
                      </a>
                    </Button>
                  )}

                  {card.editionId && (
                    <div className="flex items-center gap-1.5">
                      {card.quantity > 1 && (
                        <div
                          className="inline-flex items-center rounded-lg border border-white/[0.1] bg-black/40 h-8 px-1"
                          role="group"
                          aria-label={`Claim quantity for ${card.cardName}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setClaimQuantity(card.id, card.quantity, getClaimQuantity(card) - 1)
                            }
                            disabled={claimingId === card.id || getClaimQuantity(card) <= 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={card.quantity}
                            value={getClaimQuantity(card)}
                            disabled={claimingId === card.id}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                setClaimQuantity(card.id, card.quantity, val);
                              }
                            }}
                            className="w-8 bg-transparent text-center font-mono text-xs font-semibold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Quantity to claim"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setClaimQuantity(card.id, card.quantity, getClaimQuantity(card) + 1)
                            }
                            disabled={claimingId === card.id || getClaimQuantity(card) >= card.quantity}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          {card.quantity > 2 && getClaimQuantity(card) < card.quantity && (
                            <button
                              type="button"
                              onClick={() => setClaimQuantity(card.id, card.quantity, card.quantity)}
                              disabled={claimingId === card.id}
                              className="ml-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                              title={`Set max quantity (${card.quantity})`}
                            >
                              ALL
                            </button>
                          )}
                        </div>
                      )}

                      <Button
                        size="sm"
                        disabled={claimingId === card.id}
                        onClick={() => handleClaimCard(card)}
                        className={`h-8 text-xs font-semibold ${
                          card.isShortageOffset
                            ? "bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                            : "bg-white/[0.08] text-white hover:bg-white/[0.15]"
                        }`}
                        title={`Move ${getClaimQuantity(card)} copy(ies) to your Binder and open the MyP listing in a new tab to delist`}
                      >
                        {claimingId === card.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {card.isShortageOffset
                          ? getClaimQuantity(card) > 1
                            ? `Claim ${getClaimQuantity(card)} for Deck`
                            : "Claim for Deck"
                          : getClaimQuantity(card) > 1
                          ? `Move ${getClaimQuantity(card)} to Binder`
                          : "Move to Binder"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
