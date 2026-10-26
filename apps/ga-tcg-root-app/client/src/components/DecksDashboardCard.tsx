import React, { useState } from "react";
import { Layers, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { DeckSummary } from "../types";

export interface DecksDashboardCardProps {
  isLinked: boolean;
  decks: DeckSummary[];
  loading?: boolean;
}

export const DecksDashboardCard: React.FC<DecksDashboardCardProps> = ({
  isLinked,
  decks,
  loading = false,
}) => {
  const [expandedDeckIds, setExpandedDeckIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm shadow-xl transition-all ${!isLinked ? "opacity-60" : ""}`}>
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
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] text-slate-300 border border-white/[0.08]">
            {decks.length} {decks.length === 1 ? "Deck" : "Decks"}
          </span>
        )}
      </div>

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
              const isComplete = deck.hardShortagesCount === 0 && deck.sharedShortagesCount === 0;

              return (
                <div
                  key={deck.id}
                  className="rounded-lg border border-white/[0.06] bg-black/20 hover:border-white/[0.12] transition overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(deck.id)}
                    className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm">{deck.name}</span>
                        {deck.champion && (
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {deck.champion}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.08]">
                          {deck.format}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Total Cards: <span className="text-slate-300">{deck.totalCards}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          100% Complete
                        </span>
                      ) : (
                        <>
                          {deck.hardShortagesCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              {deck.hardShortagesCount} Hard
                            </span>
                          )}
                          {deck.sharedShortagesCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {deck.sharedShortagesCount} Shared
                            </span>
                          )}
                        </>
                      )}

                      <div className="text-slate-400 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded shortages breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] bg-black/40 space-y-3">
                      {deck.hardShortages && deck.hardShortages.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
                            Hard Shortages (Compra Necessária)
                          </p>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300">
                            {deck.hardShortages.map((item, idx) => (
                              <li key={idx} className="flex items-center justify-between bg-white/[0.02] px-2.5 py-1 rounded border border-white/[0.04]">
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
                              <li key={idx} className="flex items-center justify-between bg-white/[0.02] px-2.5 py-1 rounded border border-white/[0.04]">
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
