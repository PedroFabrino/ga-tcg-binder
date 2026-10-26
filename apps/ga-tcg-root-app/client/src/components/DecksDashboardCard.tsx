import React, { useState } from "react";
import {
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Plus,
  Pencil,
} from "lucide-react";
import type { DeckSummary } from "../types";
import { DeckImportForm } from "./DeckImportForm";
import { DeckEditForm } from "./DeckEditForm";

export interface DecksDashboardCardProps {
  isLinked: boolean;
  decks: DeckSummary[];
  loading?: boolean;
  onImportDeck?: (
    data: string | { url?: string; text?: string }
  ) => Promise<{ success: boolean; error?: string }>;
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
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async (data: { url?: string; text?: string }) => {
    if (!onImportDeck) return { success: false, error: "Not supported" };
    return onImportDeck(data);
  };

  const handleUpdate = async (
    deckId: string,
    data: { name?: string; url?: string; text?: string }
  ) => {
    if (!onUpdateDeck) return { success: false, error: "Not supported" };
    const res = await onUpdateDeck(deckId, data);
    if (res.success) {
      setEditingDeckId(null);
    }
    return res;
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
            <h2 className="text-base font-semibold text-slate-100">
              Constructed Decks & Shortages
            </h2>
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

      {showImport && isLinked && onImportDeck && (
        <DeckImportForm
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
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
              const totalShortages =
                deck.hardShortagesCount + deck.sharedShortagesCount;
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
                        Champion:{" "}
                        <strong className="text-slate-300">
                          {deck.champion || "None"}
                        </strong>{" "}
                        • Total: {deck.totalCards} cards
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
                            setEditingDeckId((prev) =>
                              prev === deck.id ? null : deck.id
                            );
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06] transition cursor-pointer"
                          aria-label={`Edit ${deck.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="text-slate-500 p-1">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {editingDeckId === deck.id && onUpdateDeck && (
                    <DeckEditForm
                      deck={deck}
                      onSave={handleUpdate}
                      onCancel={() => setEditingDeckId(null)}
                    />
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
                                <span className="font-mono text-rose-400 font-semibold">
                                  x{item.quantity}
                                </span>
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
                                <span className="font-mono text-amber-400 font-semibold">
                                  x{item.quantity}
                                </span>
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
