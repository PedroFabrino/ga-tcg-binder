import React, { useState } from "react";
import {
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Plus,
  Loader2,
  Pencil,
  Save,
} from "lucide-react";
import type { DeckSummary } from "../types";

export interface DecksDashboardCardProps {
  isLinked: boolean;
  decks: DeckSummary[];
  loading?: boolean;
  onImportDeck?: (url: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateDeck?: (
    deckId: string,
    data: { name?: string; url?: string; text?: string }
  ) => Promise<{ success: boolean; error?: string }>;
}

export const DecksDashboardCard: React.FC<DecksDashboardCardProps> = ({
  isLinked,
  decks,
  loading = false,
  onImportDeck,
  onUpdateDeck,
}) => {
  const [expandedDeckIds, setExpandedDeckIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editUpdating, setEditUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onImportDeck || !importUrl.trim()) return;

    setImporting(true);
    setImportError(null);
    try {
      const res = await onImportDeck(importUrl.trim());
      if (res.success) {
        setImportUrl("");
        setShowImport(false);
      } else {
        setImportError(res.error || "Failed to import deck");
      }
    } catch {
      setImportError("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleUpdateSubmit = async (deckId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateDeck || !editName.trim()) return;

    setEditUpdating(true);
    setEditError(null);
    try {
      const res = await onUpdateDeck(deckId, {
        name: editName.trim(),
        url: editUrl.trim() || undefined,
      });
      if (res.success) {
        setEditingDeckId(null);
        setEditName("");
        setEditUrl("");
      } else {
        setEditError(res.error || "Failed to update deck");
      }
    } catch {
      setEditError("Update failed");
    } finally {
      setEditUpdating(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm shadow-xl transition-all ${
        !isLinked ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Constructed Decks & Shortages</h2>
            <p className="text-xs text-slate-400">
              Live inventory tracking across your active decks
            </p>
          </div>
        </div>

        {isLinked && (
          <div className="flex items-center gap-2">
            {onImportDeck && (
              <button
                type="button"
                onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-300 text-xs font-medium cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Import Deck
              </button>
            )}
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] text-slate-300 border border-white/[0.08]">
              {decks.length} {decks.length === 1 ? "Deck" : "Decks"}
            </span>
          </div>
        )}
      </div>

      {showImport && isLinked && (
        <form onSubmit={handleImportSubmit} className="mt-4 p-3.5 rounded-lg bg-black/30 border border-indigo-500/20 space-y-2">
          <p className="text-xs text-slate-300">Enter an Omnidex.gg or Silvie.gg deck URL:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://omnidex.gg/deck/..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200"
            />
            <button
              type="submit"
              disabled={importing || !importUrl.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs cursor-pointer"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Import"}
            </button>
          </div>
          {importError && <p className="text-xs text-rose-400">{importError}</p>}
        </form>
      )}

      <div className="pt-4">
        {!isLinked ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Link your GA Binder account above to view your decks and track card shortages.
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-slate-400 text-sm animate-pulse">
            Loading decks and shortages...
          </div>
        ) : decks.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No constructed decks found in your GA Binder account. Create or import a deck to start tracking shortages.
          </div>
        ) : (
          <div className="space-y-3">
            {decks.map((deck) => {
              const isExpanded = expandedDeckIds.has(deck.id);
              const totalShortages = deck.hardShortagesCount + deck.sharedShortagesCount;
              const isComplete = totalShortages === 0;

              return (
                <div
                  key={deck.id}
                  className="rounded-lg border border-white/[0.04] bg-black/20 overflow-hidden transition-colors hover:border-white/[0.08]"
                >
                  <div
                    onClick={() => toggleExpand(deck.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{deck.name}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400">
                          {deck.format}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Champion: <strong className="text-slate-300">{deck.champion || "None"}</strong> • Total:{" "}
                        {deck.totalCards} cards
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          100% Complete
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          {deck.hardShortagesCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                              <AlertCircle className="w-3 h-3" />
                              {deck.hardShortagesCount} Hard
                            </span>
                          )}
                          {deck.sharedShortagesCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              <ShieldAlert className="w-3 h-3" />
                              {deck.sharedShortagesCount} Shared
                            </span>
                          )}
                        </div>
                      )}

                      {onUpdateDeck && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editingDeckId === deck.id) {
                              setEditingDeckId(null);
                            } else {
                              setEditingDeckId(deck.id);
                              setEditName(deck.name);
                              setEditUrl("");
                              setEditError(null);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06] transition cursor-pointer"
                          aria-label={`Edit ${deck.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="text-slate-500 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {editingDeckId === deck.id && (
                    <form
                      onSubmit={(e) => handleUpdateSubmit(deck.id, e)}
                      className="p-4 bg-black/40 border-t border-cyan-500/30 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-cyan-300">Edit Deck: {deck.name}</span>
                        <button
                          type="button"
                          onClick={() => setEditingDeckId(null)}
                          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                            Deck Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Deck name..."
                            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                            Omnidex or Silvie URL (optional)
                          </label>
                          <input
                            type="text"
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            placeholder="https://omnidex.gg/deck/..."
                            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-slate-200"
                          />
                        </div>
                      </div>
                      {editError && <p className="text-xs text-rose-400">{editError}</p>}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={editUpdating || !editName.trim()}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs cursor-pointer"
                        >
                          {editUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] bg-black/10 space-y-3">
                      {deck.hardShortages && deck.hardShortages.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
                            Hard Shortages (Compra Necessária)
                          </p>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300">
                            {deck.hardShortages.map((item, idx) => (
                              <li
                                key={idx}
                                className="flex items-center justify-between bg-white/[0.02] px-2.5 py-1 rounded border border-white/[0.04]"
                              >
                                <span>{item.cardName}</span>
                                <span className="font-mono text-rose-400 font-semibold">x{item.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {deck.sharedShortages && deck.sharedShortages.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                            Shared Shortages (Revezamento entre Decks)
                          </p>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300">
                            {deck.sharedShortages.map((item, idx) => (
                              <li
                                key={idx}
                                className="flex items-center justify-between bg-white/[0.02] px-2.5 py-1 rounded border border-white/[0.04]"
                              >
                                <span>{item.cardName}</span>
                                <span className="font-mono text-amber-400 font-semibold">x{item.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isComplete && (
                        <p className="text-xs text-emerald-400">
                          All cards in this deck are owned with dedicated copies. Ready to play!
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
