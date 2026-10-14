"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  ArrowRight,
  TrendingUp,
  Percent,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Users,
} from "lucide-react";

interface MetaArchetype {
  id: string;
  name: string;
  tier: string;
  champion: string;
  shareRate: string;
  winRate: string;
  decklist: string;
  sourceUrl?: string | null;
}

interface ShortageItem {
  cardSlug: string;
  cardName: string;
  zone: string;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  isContended: boolean;
  friendsWithIdle: {
    friendId: string;
    friendName: string;
    friendCode: string;
    idleQuantity: number;
  }[];
}

interface ShortageReport {
  deckName: string;
  totalCardsRequired: number;
  totalCardsMissing: number;
  items: ShortageItem[];
}

export default function MetaExplorerPage() {
  const [archetypes, setArchetypes] = useState<MetaArchetype[]>([]);
  const [loading, setLoading] = useState(true);

  // Comparison state
  const [activeMeta, setActiveMeta] = useState<MetaArchetype | null>(null);
  const [customDeckText, setCustomDeckText] = useState("");
  const [comparing, setComparing] = useState(false);
  const [comparisonReport, setComparisonReport] = useState<ShortageReport | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const fetchMeta = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta");
      const data = await res.json();
      setArchetypes(data.archetypes || []);
    } catch (err) {
      console.error("Failed to load meta archetypes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  const handleCompare = async (metaId?: string, text?: string) => {
    setComparing(true);
    setShowCompareModal(true);
    setComparisonReport(null);
    try {
      const res = await fetch("/api/meta/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaId,
          deckText: text,
        }),
      });
      const data = await res.json();
      setComparisonReport(data);
    } catch (err) {
      console.error("Comparison error:", err);
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Tournament Meta Explorer</span>
            <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
              GrandArchiveStats
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track top competitive archetypes and compare winning decklists against your physical card collection.
          </p>
        </div>
      </div>

      {/* Custom Deck URL / Omnidex Importer Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Compare Any GrandArchiveStats Deck URL or Omnidex Text
        </span>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Paste GrandArchiveStats deck URL or Omnidex snippet..."
            value={customDeckText}
            onChange={(e) => setCustomDeckText(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => handleCompare(undefined, customDeckText)}
            disabled={!customDeckText.trim() || comparing}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            Compare Against My Collection
          </button>
        </div>
      </div>

      {/* Meta Tier List Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading tournament archetypes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {archetypes.map((meta) => (
            <div
              key={meta.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 transition-all shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-black border ${
                      meta.tier === "S"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    }`}
                  >
                    TIER {meta.tier}
                  </span>

                  {meta.sourceUrl && (
                    <a
                      href={meta.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-indigo-400 flex items-center space-x-1"
                    >
                      <span>Stats</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <h3 className="font-bold text-white text-lg">{meta.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Champion: <span className="text-slate-200 font-medium">{meta.champion}</span>
                </p>

                {/* Tournament Stats */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800 text-center">
                  <div className="rounded-lg bg-slate-950 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Meta Share
                    </div>
                    <div className="text-base font-bold text-indigo-400 font-mono mt-0.5">
                      {meta.shareRate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Win Rate
                    </div>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                      {meta.winRate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-slate-800">
                <button
                  onClick={() => handleCompare(meta.id)}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-slate-800 hover:bg-indigo-600 py-2.5 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Compare Against My Collection</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowCompareModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {comparisonReport?.deckName || "Meta Deck Comparison"}
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time shortage report against your registered collection items.
                </p>
              </div>
            </div>

            {comparing ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-sm text-slate-400">Running shortage gap analysis...</p>
              </div>
            ) : comparisonReport ? (
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Feasibility Summary */}
                <div
                  className={`rounded-xl border p-4 ${
                    comparisonReport.totalCardsMissing === 0
                      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                      : "border-amber-500/30 bg-amber-950/20 text-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">
                        {comparisonReport.totalCardsMissing === 0
                          ? "You own all cards required to build this meta archetype!"
                          : `Deficit: Missing ${comparisonReport.totalCardsMissing} card copies`}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        {comparisonReport.totalCardsRequired - comparisonReport.totalCardsMissing} of{" "}
                        {comparisonReport.totalCardsRequired} required cards available in binder
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shortage Breakdown */}
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                  {comparisonReport.items.map((item) => (
                    <div
                      key={item.cardSlug}
                      className="p-3 flex items-center justify-between hover:bg-slate-900/40 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{item.cardName}</div>
                        <div className="text-[11px] text-slate-400">
                          Zone: {item.zone} • Required: {item.requiredQuantity} • Available: {item.availableQuantity}
                        </div>
                        {item.missingQuantity > 0 && item.friendsWithIdle.length > 0 && (
                          <div className="mt-1 text-[11px] text-indigo-400 flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>
                              Available from Friend: {item.friendsWithIdle[0].friendName} ({item.friendsWithIdle[0].idleQuantity} idle copies)
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        {item.missingQuantity > 0 ? (
                          <span className="rounded bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 font-bold text-rose-300">
                            Missing -{item.missingQuantity}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Satisfied</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
