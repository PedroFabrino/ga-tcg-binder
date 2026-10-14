"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Search,
  Filter,
  Sparkles,
  ShieldAlert,
  Plus,
  Check,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface Circulation {
  id: string;
  kind: string;
  population: number;
  foil: boolean;
}

interface Edition {
  id: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  lowestPopulation: number;
  isLowPop: boolean;
  circulations: Circulation[];
}

interface Card {
  slug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  effect: string | null;
  hasLowPopEdition: boolean;
  editions: Edition[];
}

export default function CatalogPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [element, setElement] = useState("ALL");
  const [cardClass, setCardClass] = useState("ALL");
  const [setPrefix, setSetPrefix] = useState("ALL");
  const [lowPopOnly, setLowPopOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [addedEditions, setAddedEditions] = useState<{ [editionId: string]: boolean }>({});

  const elements = ["ALL", "NORM", "FIRE", "WATER", "WIND", "EARTH"];
  const classes = ["ALL", "WARRIOR", "MAGE", "TANK", "CLERIC", "ASSASSIN", "RANGER", "TAMER"];
  const sets = ["ALL", "DOA", "FTC", "ALC", "MRC", "P24", "P23"];

  const fetchCards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "48",
      });
      if (query.trim()) params.set("query", query.trim());
      if (element !== "ALL") params.set("element", element);
      if (cardClass !== "ALL") params.set("class", cardClass);
      if (setPrefix !== "ALL") params.set("setPrefix", setPrefix);
      if (lowPopOnly) params.set("lowPopOnly", "true");

      const res = await fetch(`/api/catalog?${params.toString()}`);
      const data = await res.json();
      setCards(data.cards || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCards();
    }, 250);
    return () => clearTimeout(timer);
  }, [query, element, cardClass, setPrefix, lowPopOnly]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("Syncing live catalog from api.gatcg.com...");
    try {
      const res = await fetch("/api/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 5 }), // Sync latest pages
      });
      const data = await res.json();
      if (data.success) {
        setSyncMsg(`Synced ${data.stats.cardsSynced} cards successfully!`);
        fetchCards();
      } else {
        setSyncMsg("Sync failed: " + data.error);
      }
    } catch (err: any) {
      setSyncMsg("Sync error: " + err.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  };

  const handleQuickAdd = async (editionId: string, foil: boolean) => {
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
          foil,
          quantity: 1,
        }),
      });
      setAddedEditions((prev) => ({ ...prev, [editionId]: true }));
      setTimeout(() => {
        setAddedEditions((prev) => ({ ...prev, [editionId]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to add to collection:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Grand Archive Card Catalog</span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
              {total.toLocaleString()} Cards
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse official printings, foil finishes, and publisher circulation populations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {syncMsg && <span className="text-xs text-indigo-400 animate-pulse">{syncMsg}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-indigo-400" : ""}`} />
            <span>Incremental Sync</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by card name (e.g. Fracturize, Apotheosis Rite, Lorraine)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Set Dropdown */}
            <select
              value={setPrefix}
              onChange={(e) => setSetPrefix(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Sets</option>
              {sets.filter((s) => s !== "ALL").map((s) => (
                <option key={s} value={s}>
                  Set: {s}
                </option>
              ))}
            </select>

            {/* Class Dropdown */}
            <select
              value={cardClass}
              onChange={(e) => setCardClass(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Classes</option>
              {classes.filter((c) => c !== "ALL").map((c) => (
                <option key={c} value={c}>
                  Class: {c}
                </option>
              ))}
            </select>

            {/* Low Pop Toggle Button */}
            <button
              onClick={() => setLowPopOnly(!lowPopOnly)}
              className={`flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                lowPopOnly
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Low Pop Only (≤ 1,000)</span>
            </button>
          </div>
        </div>

        {/* Element Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-2">
            Element:
          </span>
          {elements.map((elem) => (
            <button
              key={elem}
              onClick={() => setElement(elem)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                element === elem
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {elem}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading catalog cards...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-slate-400 text-sm">No cards match the active search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.slug}
              className="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden hover:border-slate-700 transition-all shadow-md"
            >
              {/* Card Thumbnail Art */}
              <div className="relative aspect-[7/5] bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
                {card.editions.length > 0 && card.editions[0].imageUrl ? (
                  <img
                    src={card.editions[0].imageUrl}
                    alt={card.name}
                    className="h-full w-full object-cover object-top hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-xs text-slate-600">No Artwork</div>
                )}

                {/* Element & Class Badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="rounded bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                    {card.element}
                  </span>
                  <span className="rounded bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700">
                    {card.class}
                  </span>
                </div>

                {card.hasLowPopEdition && (
                  <div className="absolute top-2 right-2">
                    <span className="flex items-center space-x-1 rounded bg-amber-500/90 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950 shadow-md">
                      <ShieldAlert className="h-3 w-3" />
                      <span>LOW POP</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Card Meta & Print Editions */}
              <div className="flex-1 p-3.5 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-white text-sm line-clamp-1">{card.name}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                    {card.effect || `${card.type} • ${card.class}`}
                  </p>
                </div>

                {/* Editions Breakdown */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Available Printings ({card.editions.length})
                  </span>

                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {card.editions.map((ed) => {
                      const isAdded = addedEditions[ed.id];
                      return (
                        <div
                          key={ed.id}
                          className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800/70 p-1.5 text-[11px]"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200">
                              {ed.setPrefix} #{ed.collectorNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {ed.lowestPopulation > 0 && ed.lowestPopulation < 999999 ? (
                                <span className={ed.isLowPop ? "text-amber-400 font-bold" : ""}>
                                  Pop: {ed.lowestPopulation.toLocaleString()}
                                </span>
                              ) : (
                                "Standard Run"
                              )}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1">
                            {ed.isLowPop && (
                              <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/30">
                                Rare
                              </span>
                            )}
                            <button
                              onClick={() => handleQuickAdd(ed.id, false)}
                              title="Add non-foil copy to collection"
                              className={`rounded p-1 transition-colors ${
                                isAdded
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white"
                              }`}
                            >
                              {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
