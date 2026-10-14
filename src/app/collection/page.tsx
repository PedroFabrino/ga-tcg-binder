"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Plus,
  Minus,
  Upload,
  Search,
  Lock,
  Unlock,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface CollectionItem {
  id: string;
  editionId: string;
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  foil: boolean;
  quantity: number;
  isDedicated: boolean;
  population: number;
  isLowPop: boolean;
  activeDeckUsages: number;
  idleQuantity: number;
}

export default function CollectionPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "STAPLES" | "LOW_POP" | "IDLE">("ALL");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-Add state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [quickFoil, setQuickFoil] = useState(false);

  // Bulk Import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ addedCount: number; errors: string[] } | null>(null);

  const fetchCollection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collection?view=${activeTab}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load collection:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollection();
  }, [activeTab]);

  // Quick-Add Search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/catalog?query=${encodeURIComponent(searchQuery.trim())}&limit=6`);
        const data = await res.json();
        setSearchResults(data.cards || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleUpdateQuantity = async (editionId: string, foil: boolean, delta: number) => {
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
          foil,
          quantity: delta,
        }),
      });
      fetchCollection();
    } catch (err) {
      console.error("Failed to update item:", err);
    }
  };

  const handleToggleDedicated = async (item: CollectionItem) => {
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: item.editionId,
          foil: item.foil,
          quantity: 0, // update flags only
          isDedicated: !item.isDedicated,
        }),
      });
      fetchCollection();
    } catch (err) {
      console.error("Failed to toggle dedication:", err);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/collection/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulkText }),
      });
      const data = await res.json();
      setImportResult(data);
      fetchCollection();
    } catch (err: any) {
      setImportResult({ addedCount: 0, errors: [err.message] });
    } finally {
      setImporting(false);
    }
  };

  const tabs = [
    { key: "ALL", label: "All Cards", icon: Layers },
    { key: "STAPLES", label: "Multi-Deck Staples", icon: TrendingUp },
    { key: "LOW_POP", label: "Low Population", icon: ShieldAlert },
    { key: "IDLE", label: "Idle / Trade Binder", icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>My Physical Binder</span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
              {items.reduce((sum, i) => sum + i.quantity, 0)} Copies
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your card inventory with exact print populations, foil variants, and sharing rules.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Upload className="h-4 w-4 text-indigo-400" />
            <span>Bulk Text Paste Importer</span>
          </button>
        </div>
      </div>

      {/* Quick-Add Autocomplete Bar */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Quick-Add card to binder by name (e.g. Fracturize, Rayne)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setQuickFoil(!quickFoil)}
              className={`flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                quickFoil
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-sm"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{quickFoil ? "Foil Selected" : "Non-Foil"}</span>
            </button>
          </div>
        </div>

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-2 z-30 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden divide-y divide-slate-800">
            {searchResults.map((card) => (
              <div key={card.slug} className="p-3 hover:bg-slate-800/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-sm">{card.name}</div>
                  <div className="text-xs text-slate-400">
                    {card.element} • {card.class} • {card.editions.length} printings available
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {card.editions.slice(0, 2).map((ed: any) => (
                    <button
                      key={ed.id}
                      onClick={() => {
                        handleUpdateQuantity(ed.id, quickFoil, 1);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      +1 {ed.setPrefix} #{ed.collectorNumber}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart View Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Items Table / Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading collection...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Layers className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-slate-400 text-sm">No cards in this view.</p>
          <p className="text-xs text-slate-500 mt-1">
            Use the quick search above or the Bulk Importer to add physical cards.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Card</th>
                <th className="py-3 px-4">Printing</th>
                <th className="py-3 px-4">Finish</th>
                <th className="py-3 px-4">Population</th>
                <th className="py-3 px-4">Deck Status</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4 text-right">Rules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Card Name & Art */}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-8 rounded overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.cardName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[9px] text-slate-600">
                            GA
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{item.cardName}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.element} • {item.class}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Printing */}
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-200">
                      {item.setPrefix} #{item.collectorNumber}
                    </div>
                    <div className="text-[10px] text-slate-400">{item.setName}</div>
                  </td>

                  {/* Foil / Non-Foil */}
                  <td className="py-3 px-4">
                    {item.foil ? (
                      <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30 shadow-sm">
                        <Sparkles className="h-3 w-3" />
                        <span>FOIL</span>
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        Non-Foil
                      </span>
                    )}
                  </td>

                  {/* Population */}
                  <td className="py-3 px-4">
                    {item.population > 0 && item.population < 999999 ? (
                      <div className="flex items-center space-x-1.5">
                        <span className={`font-mono font-bold ${item.isLowPop ? "text-amber-400" : "text-slate-300"}`}>
                          {item.population.toLocaleString()}
                        </span>
                        {item.isLowPop && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300 border border-amber-500/30">
                            LOW POP
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">Standard</span>
                    )}
                  </td>

                  {/* Deck Usage & Idle */}
                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      {item.activeDeckUsages > 0 ? (
                        <div className="text-indigo-400 font-medium">
                          In {item.activeDeckUsages} active deck{item.activeDeckUsages > 1 ? "s" : ""}
                        </div>
                      ) : (
                        <div className="text-slate-500">Not in any deck</div>
                      )}
                      <div className="text-[10px] text-emerald-400">
                        {item.idleQuantity} idle {item.idleQuantity === 1 ? "copy" : "copies"}
                      </div>
                    </div>
                  </td>

                  {/* Quantity Controls */}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.editionId, item.foil, -1)}
                        className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-rose-950 hover:text-rose-400"
                        title="Decrement quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-white text-sm font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.editionId, item.foil, 1)}
                        className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-indigo-950 hover:text-indigo-400"
                        title="Increment quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Rules / Dedicated */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggleDedicated(item)}
                      className={`inline-flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                        item.isDedicated
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                      title={
                        item.isDedicated
                          ? "Dedicated: Cannot be shared across decks"
                          : "Shared: May be shared across multiple decks"
                      }
                    >
                      {item.isDedicated ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      <span>{item.isDedicated ? "Dedicated" : "Shared"}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Text Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => {
                setShowBulkModal(false);
                setImportResult(null);
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Bulk Collection Importer</h2>
                <p className="text-xs text-slate-400">Paste card lines to register batch inventory in seconds.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Card Lines (Supports count, card name, set code, and foil tags)
                </label>
                <textarea
                  rows={7}
                  placeholder={`4x Fracturize [DOA]
2 Arcane Disposition Foil
1 Apotheosis Rite [P24]`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full font-mono text-xs rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {importResult && (
                <div
                  className={`rounded-xl p-3 text-xs ${
                    importResult.errors.length > 0
                      ? "bg-amber-950/40 border border-amber-500/30 text-amber-300"
                      : "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                  }`}
                >
                  <div className="font-bold">
                    Successfully added {importResult.addedCount} physical copies!
                  </div>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-400">
                      {importResult.errors.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                onClick={handleBulkImport}
                disabled={importing || !bulkText.trim()}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>{importing ? "Importing Lines..." : "Import Cards into Binder"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
