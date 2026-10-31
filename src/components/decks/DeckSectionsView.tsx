"use client";

import React from "react";
import { Crown, BookOpen } from "lucide-react";
import { SortableDeckGrid } from "./SortableDeckGrid";
import { DeckSummaryItem } from "./DeckSummaryCard";
import { useTranslation } from "@/lib/i18n";

interface DeckSectionsViewProps {
  decks: DeckSummaryItem[];
  shortages: Record<string, number | null>;
  loadingEditId: string | null;
  onReorder: (newDecks: DeckSummaryItem[]) => void;
  onMove: (deckId: string, direction: "up" | "down") => void;
  onToggleSection: (deckId: string) => void;
  onEdit: (deck: DeckSummaryItem, e: React.MouseEvent) => void;
  onDelete: (deck: DeckSummaryItem) => void;
}

export function DeckSectionsView({
  decks,
  shortages,
  loadingEditId,
  onReorder,
  onMove,
  onToggleSection,
  onEdit,
  onDelete,
}: DeckSectionsViewProps) {
  const { t } = useTranslation();
  const competitiveDecks = decks.filter((d) => d.section === "competitive");
  const fourFunDecks = decks.filter((d) => d.section !== "competitive");

  return (
    <div className="space-y-8">
      {/* Competitive Decks Section */}
      <div>
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
              <Crown className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
              {t("decks.sectionCompetitive")}
            </h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-400">
              {competitiveDecks.length}
            </span>
          </div>
          <p className="hidden text-xs text-slate-400 sm:block">
            {t("decks.sectionCompetitiveDesc")}
          </p>
        </div>
        {competitiveDecks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.08] py-6 text-center text-xs text-slate-500">
            No competitive decks yet. Use the arrow icon on any deck to promote it here.
          </p>
        ) : (
          <SortableDeckGrid
            decks={competitiveDecks}
            shortages={shortages}
            loadingEditId={loadingEditId}
            onReorder={(newComp) => onReorder([...newComp, ...fourFunDecks])}
            onMoveUp={(id) => onMove(id, "up")}
            onMoveDown={(id) => onMove(id, "down")}
            onToggleSection={onToggleSection}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>

      {/* 4Fun Decks Section */}
      <div>
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-300">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
              {t("decks.section4Fun")}
            </h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-400">
              {fourFunDecks.length}
            </span>
          </div>
          <p className="hidden text-xs text-slate-400 sm:block">
            {t("decks.section4FunDesc")}
          </p>
        </div>
        {fourFunDecks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.08] py-6 text-center text-xs text-slate-500">
            No casual decks found.
          </p>
        ) : (
          <SortableDeckGrid
            decks={fourFunDecks}
            shortages={shortages}
            loadingEditId={loadingEditId}
            onReorder={(newFun) => onReorder([...competitiveDecks, ...newFun])}
            onMoveUp={(id) => onMove(id, "up")}
            onMoveDown={(id) => onMove(id, "down")}
            onToggleSection={onToggleSection}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}
