"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  X,
  Plus,
  Minus,
  Sparkles,
  Layers,
  BookOpen,
  CheckCircle2,
  Check,
  AlertTriangle,
  Loader2,
  Flame,
  Gem,
  Store,
  ExternalLink,
  Shield,
  RefreshCw,
} from "lucide-react";
import { CardArt, ElementBadge, RarityGem } from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import WatchlistSecurityModal from "./WatchlistSecurityModal";
import { ELEMENT_COLORS, ALL_ELEMENTS, normalizeElement } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import type {
  AggregatedShortageCard,
  AggregatedShortageReport,
} from "@/services/shortage";

const ELEMENTS = ALL_ELEMENTS;

const ELEMENT_CONFIG: Record<string, { label: string; color: string; activeColor: string; bg: string; border: string; shadow: string }> = {
  NORM: { label: "Norm", color: "#94a3b8", activeColor: "#f8fafc", bg: "bg-slate-200/20", border: "border-slate-200", shadow: "shadow-[0_0_12px_rgba(248,250,252,0.4)]" },
  FIRE: { label: "Fire", color: "#f43f5e", activeColor: "#fb7185", bg: "bg-rose-500/20", border: "border-rose-400", shadow: "shadow-[0_0_12px_rgba(251,113,133,0.4)]" },
  WATER: { label: "Water", color: "#06b6d4", activeColor: "#22d3ee", bg: "bg-cyan-500/20", border: "border-cyan-400", shadow: "shadow-[0_0_12px_rgba(34,211,238,0.4)]" },
  WIND: { label: "Wind", color: "#10b981", activeColor: "#34d399", bg: "bg-emerald-500/20", border: "border-emerald-400", shadow: "shadow-[0_0_12px_rgba(52,211,153,0.4)]" },
  TERA: { label: "Tera", color: "#d97706", activeColor: "#fbbf24", bg: "bg-amber-500/20", border: "border-amber-400", shadow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]" },
  CRUX: { label: "Crux", color: "#ea580c", activeColor: "#fb923c", bg: "bg-orange-500/20", border: "border-orange-400", shadow: "shadow-[0_0_12px_rgba(251,146,60,0.4)]" },
  UMBRA: { label: "Umbra", color: "#8b5cf6", activeColor: "#a78bfa", bg: "bg-violet-500/20", border: "border-violet-400", shadow: "shadow-[0_0_12px_rgba(167,139,250,0.4)]" },
  LUXEM: { label: "Luxem", color: "#eab308", activeColor: "#fde047", bg: "bg-yellow-500/20", border: "border-yellow-400", shadow: "shadow-[0_0_12px_rgba(253,224,71,0.4)]" },
  EXALTED: { label: "Exalted", color: "#f59e0b", activeColor: "#fcd34d", bg: "bg-amber-500/20", border: "border-amber-400", shadow: "shadow-[0_0_12px_rgba(252,211,77,0.4)]" },
  ASTRA: { label: "Astra", color: "#6366f1", activeColor: "#818cf8", bg: "bg-indigo-500/20", border: "border-indigo-400", shadow: "shadow-[0_0_12px_rgba(129,140,248,0.4)]" },
  EXIA: { label: "Exia", color: "#ec4899", activeColor: "#f472b6", bg: "bg-pink-500/20", border: "border-pink-400", shadow: "shadow-[0_0_12px_rgba(244,114,182,0.4)]" },
  ARCANE: { label: "Arcane", color: "#a855f7", activeColor: "#c084fc", bg: "bg-purple-500/20", border: "border-purple-400", shadow: "shadow-[0_0_12px_rgba(192,132,252,0.4)]" },
  NEOS: { label: "Neos", color: "#0ea5e9", activeColor: "#38bdf8", bg: "bg-sky-500/20", border: "border-sky-400", shadow: "shadow-[0_0_12px_rgba(56,189,248,0.4)]" },
};

type GroupMode = "none" | "element" | "deck" | "rarity" | "vendor";

interface ShortageGroup {
  key: string;
  title: string;
  cards: AggregatedShortageCard[];
  color?: string;
  vendorUrl?: string | null;
  totalCostBrl?: number;
}

export default function AllShortagesView({
  report,
  onRefresh,
  loading = false,
}: {
  report: AggregatedShortageReport | null;
  onRefresh: () => void;
  loading?: boolean;
}) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [syncingAutomated, setSyncingAutomated] = useState(false);
  const [policyUpdating, setPolicyUpdating] = useState(false);

  const pendingAdds = useMemo(() => {
    const list: any[] = [];
    report?.cards.forEach((c) => {
      c.watchlistItems?.forEach((w) => {
        if (w.status === "pending_add") {
          list.push({ ...w, cardName: c.cardName });
        }
      });
    });
    return list;
  }, [report]);

  const pendingUpdates = useMemo(() => {
    const list: any[] = [];
    report?.cards.forEach((c) => {
      c.watchlistItems?.forEach((w) => {
        if (w.status === "pending_update") {
          list.push({ ...w, cardName: c.cardName });
        }
      });
    });
    return list;
  }, [report]);

  const pendingRemoves = useMemo(() => {
    const list: any[] = [];
    report?.cards.forEach((c) => {
      c.watchlistItems?.forEach((w) => {
        if (w.status === "pending_remove") {
          list.push({ ...w, cardName: c.cardName });
        }
      });
    });
    return list;
  }, [report]);

  const handlePolicyChange = async (policy: "hard" | "shared" | "staples") => {
    setPolicyUpdating(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_policy", policy }),
      });
      if (!res.ok) throw new Error();
      showToast(`Watchlist Quota Policy updated to ${policy.toUpperCase()}`, "success");
      onRefresh();
    } catch {
      showToast("Failed to update policy", "error");
    } finally {
      setPolicyUpdating(false);
    }
  };

  const handleAutomatedSync = async () => {
    setSyncingAutomated(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_now" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      showToast("Watchlist synchronized automatically with MyP Cards!", "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Automated sync failed", "error");
    } finally {
      setSyncingAutomated(false);
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

  // Filtering
  const filteredCards = useMemo(() => {
    if (!report?.cards) return [];
    let list = report.cards;

    if (selectedElements.length > 0) {
      list = list.filter((c) => {
        const cardEl = normalizeElement(c.element);
        return selectedElements.some((el) => normalizeElement(el) === cardEl);
      });
    }

    if (selectedRarities.length > 0) {
      list = list.filter((c) => selectedRarities.includes(c.rarity || 1));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => {
        const nameMatch = c.cardName.toLowerCase().includes(q);
        const slugMatch = c.cardSlug.toLowerCase().includes(q);
        const deckMatch = c.deckRequirements.some((d) =>
          d.deckName.toLowerCase().includes(q)
        );
        const editionMatch = c.editions.some(
          (e) =>
            e.setPrefix.toLowerCase().includes(q) ||
            e.collectorNumber.toLowerCase().includes(q) ||
            `${e.setPrefix} #${e.collectorNumber}`.toLowerCase().includes(q)
        );
        return nameMatch || slugMatch || deckMatch || editionMatch;
      });
    }

    return list;
  }, [report?.cards, query, selectedElements, selectedRarities]);

  // Grouping
  const groupedData = useMemo<ShortageGroup[]>(() => {
    if (groupMode === "none") {
      return [{ key: "all", title: "All Shortage Cards", cards: filteredCards }];
    }

    if (groupMode === "element") {
      const groups: Record<string, AggregatedShortageCard[]> = {};
      ELEMENTS.forEach((el) => {
        groups[el] = [];
      });
      filteredCards.forEach((c) => {
        const el = normalizeElement(c.element);
        if (!groups[el]) groups[el] = [];
        groups[el].push(c);
      });

      return Object.entries(groups)
        .filter(([_, cards]) => cards.length > 0)
        .map(([el, cards]) => ({
          key: el,
          title: `${ELEMENT_CONFIG[el]?.label || el} Element (${cards.length})`,
          cards,
          color: ELEMENT_COLORS[el],
        }));
    }

    if (groupMode === "deck") {
      const deckMap: Record<string, { title: string; cards: AggregatedShortageCard[] }> = {};

      filteredCards.forEach((c) => {
        c.deckRequirements.forEach((req) => {
          if (!deckMap[req.deckId]) {
            deckMap[req.deckId] = { title: req.deckName, cards: [] };
          }
          if (!deckMap[req.deckId].cards.some((existing) => existing.cardSlug === c.cardSlug)) {
            deckMap[req.deckId].cards.push(c);
          }
        });
      });

      return Object.entries(deckMap).map(([deckId, data]) => ({
        key: deckId,
        title: `${data.title} (${data.cards.length} shortages)`,
        cards: data.cards,
      }));
    }

    if (groupMode === "rarity") {
      const groups: Record<number, AggregatedShortageCard[]> = {};
      RARITIES.forEach((r) => {
        groups[r.id] = [];
      });
      filteredCards.forEach((c) => {
        const r = c.rarity || 1;
        if (!groups[r]) groups[r] = [];
        groups[r].push(c);
      });

      return RARITIES.map((r) => ({
        key: `rarity-${r.id}`,
        title: `${r.label} (${groups[r.id]?.length || 0})`,
        cards: groups[r.id] || [],
        color: r.color,
      })).filter((g) => g.cards.length > 0);
    }

    if (groupMode === "vendor") {
      const vendorMap: Record<
        string,
        {
          title: string;
          cards: AggregatedShortageCard[];
          vendorUrl: string | null;
          totalCostBrl: number;
        }
      > = {};

      filteredCards.forEach((c) => {
        const vendorKey = c.marketVendorName ? `vendor-${c.marketVendorName}` : "unlisted";
        const vendorTitle = c.marketVendorName ? `Vendor: ${c.marketVendorName}` : "Other / Unlisted Vendors";
        const vendorUrl = c.marketVendorUrl || null;

        if (!vendorMap[vendorKey]) {
          vendorMap[vendorKey] = {
            title: vendorTitle,
            cards: [],
            vendorUrl,
            totalCostBrl: 0,
          };
        }

        vendorMap[vendorKey].cards.push(c);
        const cardPrice = c.marketLowestPriceBrl || 0;
        const qtyNeeded = c.concurrentMissing || 1;
        vendorMap[vendorKey].totalCostBrl += cardPrice * qtyNeeded;
      });

      return Object.entries(vendorMap)
        .sort(([keyA, dataA], [keyB, dataB]) => {
          if (keyA === "unlisted") return 1;
          if (keyB === "unlisted") return -1;
          if (dataB.cards.length !== dataA.cards.length) {
            return dataB.cards.length - dataA.cards.length;
          }
          return dataB.totalCostBrl - dataA.totalCostBrl;
        })
        .map(([key, data]) => ({
          key,
          title: `${data.title} (${data.cards.length} shortage card${data.cards.length > 1 ? "s" : ""})`,
          cards: data.cards,
          vendorUrl: data.vendorUrl,
          totalCostBrl: data.totalCostBrl,
          color: key === "unlisted" ? "#94a3b8" : "#38bdf8",
        }));
    }

    return [];
  }, [filteredCards, groupMode]);

  const summary = report?.summary;
  const isAllCovered = summary && summary.totalShortageCopies === 0 && summary.deckCount > 0;

  return (
    <div className="space-y-6">
      {/* Watchlist Quota Policy & Action Bar */}
      {summary && summary.deckCount > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-semibold text-slate-300">Quota Policy:</span>
            <div className="inline-flex rounded-xl border border-white/[0.08] bg-slate-900/60 p-1">
              <button
                type="button"
                disabled={policyUpdating}
                onClick={() => handlePolicyChange("hard")}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  (summary.activePolicy || "hard") === "hard"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Hard Shortage (Compra Necessária): Peak demand in any single deck (ensure at least 1 deck is playable)"
              >
                Hard (Peak Deck)
              </button>
              <button
                type="button"
                disabled={policyUpdating}
                onClick={() => handlePolicyChange("shared")}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  summary.activePolicy === "shared"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Shared Shortage (Revezamento entre Decks): Concurrent demand across all decks"
              >
                Shared (All Decks)
              </button>
              <button
                type="button"
                disabled={policyUpdating}
                onClick={() => handlePolicyChange("staples")}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  summary.activePolicy === "staples"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Staples Policy: Meta staples recommendations & playset cap"
              >
                Staples
              </button>
            </div>
          </div>

          {/* Watchlist Ledger Badges & Sync Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                Watching: {summary.watchingCount ?? 0}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                +{summary.pendingAdds ?? pendingAdds.length} to Watch
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium">
                ~{summary.pendingUpdates ?? pendingUpdates.length} Qty Updates
              </span>
              {(summary.pendingRemoves || pendingRemoves.length) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
                  -{summary.pendingRemoves ?? pendingRemoves.length} Quota Filled
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSecurityModal(true)}
                className="gap-1.5 text-xs border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-white"
              >
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                Sincronizar via Browser Bridge
              </Button>

              {summary.hasSavedMypCredentials && (
                <Button
                  size="sm"
                  disabled={syncingAutomated}
                  onClick={handleAutomatedSync}
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 font-medium"
                >
                  {syncingAutomated ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Auto-Sync Agora
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shortage Summary Cards */}
      {summary && summary.deckCount > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Concurrent Missing</div>
            <div className="mt-1 font-mono text-2xl font-bold text-rose-300">
              {summary.totalShortageCopies}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">To sleeve all decks at once</p>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Peak Missing</div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
              {summary.totalPeakShortageCopies}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">For any single deck</p>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Unique Cards</div>
            <div className="mt-1 font-mono text-2xl font-bold text-cyan-300">
              {summary.uniqueShortageCards}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Cards needing copies</p>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="label-caps text-slate-400">Decks Evaluated</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-200">
              {summary.deckCount}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Active user decks</p>
          </div>
        </div>
      )}

      {/* Filter and Grouping Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative flex flex-1 items-center gap-2 rounded-2xl glass p-2 focus-within:border-cyan-400/30">
            <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by card name, deck, or set..."
              aria-label="Filter shortage cards"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder:text-slate-500 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear filter"
                className="mr-2 text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Group mode toggle buttons */}
          <div className="inline-flex self-start rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
            <button
              onClick={() => setGroupMode("none")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                groupMode === "none" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Flat
            </button>
            <button
              onClick={() => setGroupMode("element")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                groupMode === "element" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Flame className="h-3.5 w-3.5" /> By Element
            </button>
            <button
              onClick={() => setGroupMode("rarity")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                groupMode === "rarity" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Gem className="h-3.5 w-3.5" /> By Rarity
            </button>
            <button
              onClick={() => setGroupMode("deck")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                groupMode === "deck" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> By Deck
            </button>
            <button
              onClick={() => setGroupMode("vendor")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                groupMode === "vendor" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Store className="h-3.5 w-3.5" /> By Vendor
            </button>
          </div>
        </div>

        {/* Filter Chips: Element & Rarity */}
        <div className="flex flex-col gap-2 rounded-2xl glass p-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Element Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 mr-1">Element:</span>
            <button
              onClick={() => setSelectedElements([])}
              aria-pressed={selectedElements.length === 0}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                selectedElements.length === 0
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                  : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
              }`}
            >
              {selectedElements.length === 0 && <Check className="h-3 w-3 shrink-0 text-cyan-300" />}
              All
            </button>
            {ELEMENTS.map((el) => {
              const cfg = ELEMENT_CONFIG[el] || {
                label: el,
                color: ELEMENT_COLORS[el],
                activeColor: ELEMENT_COLORS[el],
                bg: "bg-white/10",
                border: "border-white/30",
                shadow: "",
              };
              const active = selectedElements.includes(el);
              return (
                <button
                  type="button"
                  key={el}
                  onClick={() => toggleElement(el)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                    active
                      ? `${cfg.border} ${cfg.bg} ${cfg.shadow} font-semibold ring-1 ring-white/20 text-white`
                      : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
                  }`}
                  style={
                    active
                      ? {
                          borderColor: cfg.activeColor,
                          backgroundColor: `${cfg.activeColor}25`,
                          boxShadow: `0 0 10px ${cfg.activeColor}40`,
                        }
                      : undefined
                  }
                >
                  {active ? (
                    <Check className="h-3 w-3 shrink-0" style={{ color: cfg.activeColor }} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                  )}
                  <span style={active ? { color: cfg.activeColor } : undefined}>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Rarity Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.04] pt-2 sm:border-t-0 sm:pt-0">
            <span className="text-[11px] font-medium text-slate-500 mr-1">Rarity:</span>
            <button
              type="button"
              onClick={() => setSelectedRarities([])}
              aria-pressed={selectedRarities.length === 0}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                selectedRarities.length === 0
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/30"
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
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                    active
                      ? `${r.border} ${r.bg} ${r.shadow} font-semibold ring-1 ring-white/20 text-white`
                      : "border-white/[0.08] text-slate-400 hover:border-white/[0.18] hover:text-slate-200"
                  }`}
                  style={
                    active
                      ? {
                          borderColor: r.activeColor,
                          backgroundColor: `${r.activeColor}25`,
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

      {/* Main Content / Empty States */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-xs">Analyzing deck shortages across your binder...</p>
        </div>
      ) : isAllCovered ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-8 text-center animate-fade-in">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          <h3 className="text-base font-semibold text-white">All Decks Tournament Ready!</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            You own enough copies to sleeve all your active constructed decks without moving cards between them.
          </p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl glass p-8 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400/80" />
          <p className="text-sm font-medium text-white">No shortage cards found</p>
          <p className="mt-1 text-xs text-slate-400">
            {query || selectedElements.length > 0 || selectedRarities.length > 0
              ? "No cards match the active filters."
              : "Your decks have no shortages."}
          </p>
          {(query || selectedElements.length > 0 || selectedRarities.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setSelectedElements([]);
                setSelectedRarities([]);
              }}
              className="mt-4"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedData.map((group) => (
            <div key={group.key} className="space-y-3">
              {groupMode !== "none" && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-white" style={group.color ? { color: group.color } : undefined}>
                      {group.title}
                    </h3>
                    {group.totalCostBrl !== undefined && group.totalCostBrl > 0 && (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                        Total ~R$ {group.totalCostBrl.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </div>
                  {group.vendorUrl && (
                    <a
                      href={group.vendorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20 hover:text-cyan-200"
                    >
                      <Store className="h-3.5 w-3.5" />
                      <span>Visit Store</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="divide-y divide-white/[0.04] rounded-2xl glass overflow-hidden">
                {group.cards.map((card) => (
                  <ShortageCardRow
                    key={`${group.key}-${card.cardSlug}`}
                    card={card}
                    onCardUpdated={onRefresh}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSecurityModal && (
        <WatchlistSecurityModal
          onClose={() => setShowSecurityModal(false)}
          userId={session?.user?.id || "user_default"}
          pendingAdds={pendingAdds}
          pendingUpdates={pendingUpdates}
          pendingRemoves={pendingRemoves}
        />
      )}
    </div>
  );
}

function ShortageCardRow({
  card,
  onCardUpdated,
}: {
  card: AggregatedShortageCard;
  onCardUpdated: () => void;
}) {
  const { showToast } = useToast();
  const [selectedEditionId, setSelectedEditionId] = useState(card.editions[0]?.id || "");
  const [foil, setFoil] = useState(false);
  const [quantityToAdd, setQuantityToAdd] = useState(Math.max(1, card.concurrentMissing));
  const [adding, setAdding] = useState(false);

  const selectedEdition = card.editions.find((e) => e.id === selectedEditionId) || card.editions[0];
  const displayImage = selectedEdition?.imageUrl || card.imageUrl;

  const handleAddCopies = async () => {
    if (!selectedEdition?.id) {
      showToast("No edition available for this card", "error");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: selectedEdition.id,
          foil,
          quantity: quantityToAdd,
        }),
      });

      if (!res.ok) throw new Error();

      showToast(
        `Added ${quantityToAdd}x ${foil ? "Foil " : ""}${card.cardName} to Binder`,
        "success"
      );
      onCardUpdated();
    } catch {
      showToast(`Couldn't add ${card.cardName}`, "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 transition-colors hover:bg-white/[0.015] md:flex-row md:items-center md:justify-between">
      {/* Left: Card Thumbnail & Name */}
      <div className="flex items-center gap-3 min-w-0">
        <CardPreviewTrigger
          name={card.cardName}
          slug={card.cardSlug}
          imageUrl={displayImage || undefined}
          element={card.element}
          className="shrink-0 cursor-pointer"
        >
          <div
            className={`relative h-14 w-10 overflow-hidden rounded-md border border-white/[0.08] hover:border-cyan-400/50 transition-colors ${
              foil ? "foil-static" : ""
            }`}
          >
            <CardArt src={displayImage || undefined} alt={card.cardName} className="h-full w-full" />
          </div>
        </CardPreviewTrigger>

        <div className="min-w-0">
          <CardPreviewTrigger
            name={card.cardName}
            slug={card.cardSlug}
            imageUrl={displayImage || undefined}
            element={card.element}
            className="inline-block"
          >
            <div className="truncate text-sm font-semibold text-white hover:text-cyan-300 transition-colors cursor-pointer">
              {card.cardName}
            </div>
          </CardPreviewTrigger>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ElementBadge element={card.element} />
            <RarityGem rarity={card.rarity} />
            <span className="truncate text-[11px] text-slate-500">{card.class}</span>
            <span className="text-[11px] text-slate-600">·</span>
            <span className="text-[11px] text-slate-400">
              Owned: <span className="font-mono font-medium text-slate-200">{card.totalOwned}</span>
            </span>
            {card.mypAvailableCopies && card.mypAvailableCopies > 0 ? (
              <a
                href="/collection?view=MYP_STORE"
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/25 transition-colors"
                title="You have copies listed in your MyP Store that can cover this shortage"
              >
                <Store className="h-2.5 w-2.5 text-amber-300" />
                {card.mypAvailableCopies} in MyP Store
              </a>
            ) : null}
            {card.marketAvailableCopies && card.marketAvailableCopies > 0 ? (
              <a
                href={card.marketProductUrl || `/marketplace?query=${encodeURIComponent(card.cardName)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  card.marketPriceFairness?.tier === "HEAVILY_OVERPRICED"
                    ? "border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                    : card.marketPriceFairness?.tier === "SLIGHTLY_OVERPRICED"
                    ? "border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-400/25"
                    : "border-cyan-400/40 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25"
                }`}
                title={
                  card.marketPriceFairness?.tier === "HEAVILY_OVERPRICED"
                    ? `⚠️ HEAVILY OVERPRICED on MyP: ${card.marketLowestPriceStr} vs TCG Player ${card.marketTcgPrice} (${(card.marketPriceFairness.ratio ?? 0).toFixed(1)}x)`
                    : card.marketPriceFairness?.tier === "SLIGHTLY_OVERPRICED"
                    ? `Slightly Overpriced on MyP: ${card.marketLowestPriceStr} vs TCG Player ${card.marketTcgPrice} (+${card.marketPriceFairness.markupPercent}%)`
                    : `Buy on MyP Cards starting from ${card.marketLowestPriceStr || "R$ --"}`
                }
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Buy on MyP · {card.marketLowestPriceStr || "Market"} ({card.marketAvailableCopies} avail)
                {card.marketPriceFairness?.tier === "HEAVILY_OVERPRICED" && (
                  <span className="font-bold text-red-300">· 🚨 {(card.marketPriceFairness.ratio ?? 0).toFixed(1)}x TCG</span>
                )}
                {card.marketPriceFairness?.tier === "SLIGHTLY_OVERPRICED" && (
                  <span className="text-amber-300">· +{card.marketPriceFairness.markupPercent}%</span>
                )}
              </a>
            ) : null}
            {card.marketVendorName && (
              <a
                href={card.marketVendorUrl || `https://mypcards.com/${encodeURIComponent(card.marketVendorName)}/grandarchive`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-200 hover:bg-sky-400/20 transition-colors"
                title={`Offered on MyP Cards by vendor ${card.marketVendorName}`}
              >
                <Store className="h-2.5 w-2.5 text-sky-300" />
                Vendor: <strong className="font-semibold text-white">{card.marketVendorName}</strong>
              </a>
            )}
          </div>

          {/* Decks needing this card */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Decks:</span>
            {card.deckRequirements.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300 font-medium"
              >
                {d.deckName} <span className="ml-1 text-cyan-300 font-mono">x{d.quantity}</span>
              </span>
            ))}
          </div>

          {/* Watchlist managed printings */}
          {card.watchlistItems && card.watchlistItems.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Watchlist:</span>
              {card.watchlistItems.map((wl) => (
                <span
                  key={wl.id}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${
                    wl.status === "watching"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : wl.status === "pending_add"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : wl.status === "pending_update"
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                      : wl.status === "pending_remove"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                  }`}
                >
                  <span className="font-semibold">{wl.editionSlug} #{wl.collectorNumber}:</span>
                  {wl.status === "watching" && <span>Watching ({wl.targetQuantity}x)</span>}
                  {wl.status === "pending_add" && <span>Queued Add ({wl.targetQuantity}x)</span>}
                  {wl.status === "pending_update" && <span>Queued Update ({wl.targetQuantity}x)</span>}
                  {wl.status === "pending_remove" && <span>Queued Remove</span>}
                  {wl.status === "ignored" && (
                    <span className="inline-flex items-center gap-1">
                      <span>Ignored on MyP</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await fetch("/api/watchlist", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "re_enable", watchlistId: wl.id }),
                            });
                            showToast("Watch reativado", "success");
                            onCardUpdated();
                          } catch {
                            showToast("Falha ao reativar", "error");
                          }
                        }}
                        className="underline hover:text-white ml-0.5 cursor-pointer font-bold"
                        title="Re-enable Watchlist tracking for this printing"
                      >
                        Reativar
                      </button>
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Middle: Shortage Quantities */}
      <div className="flex flex-wrap items-center gap-4 text-xs md:text-right">
        <div>
          <div className="flex items-center gap-1.5 md:justify-end">
            <span className="text-slate-400">Missing (all decks):</span>
            <span className="font-mono font-bold text-rose-300">{card.concurrentMissing}</span>
          </div>
          <div className="flex items-center gap-1.5 md:justify-end mt-0.5">
            <span className="text-slate-500 text-[11px]">Peak single-deck:</span>
            <span className="font-mono text-amber-300 text-[11px]">{card.peakMissing}</span>
          </div>
        </div>

        {/* Right: Quick Add Stepper & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edition Picker */}
          {card.editions.length > 1 ? (
            <select
              value={selectedEditionId}
              onChange={(e) => setSelectedEditionId(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-black/40 px-2 py-1 text-[11px] font-mono text-slate-200 outline-none hover:border-white/[0.15]"
            >
              {card.editions.map((ed) => (
                <option key={ed.id} value={ed.id} className="bg-slate-900 text-white">
                  {ed.setPrefix} #{ed.collectorNumber}
                </option>
              ))}
            </select>
          ) : card.editions[0] ? (
            <span className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1 text-[11px] font-mono text-slate-400">
              {card.editions[0].setPrefix} #{card.editions[0].collectorNumber}
            </span>
          ) : null}

          {/* Foil toggle */}
          <button
            type="button"
            onClick={() => setFoil((f) => !f)}
            aria-pressed={foil}
            title={foil ? "Foil printing" : "Non-foil printing"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
              foil
                ? "foil-chip text-white shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                : "border-white/[0.08] text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>

          {/* Quantity Stepper */}
          <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/20">
            <button
              type="button"
              onClick={() => setQuantityToAdd((q) => Math.max(1, q - 1))}
              disabled={quantityToAdd <= 1}
              className="px-2 py-1 text-slate-400 hover:text-white disabled:opacity-40"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center font-mono text-xs font-semibold text-white">
              {quantityToAdd}
            </span>
            <button
              type="button"
              onClick={() => setQuantityToAdd((q) => q + 1)}
              className="px-2 py-1 text-slate-400 hover:text-white"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Add Button */}
          <Button
            size="sm"
            onClick={handleAddCopies}
            disabled={adding}
            className="h-8 gap-1 text-xs"
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add {quantityToAdd}x
          </Button>
        </div>
      </div>
    </div>
  );
}
