"use client";

import React from "react";
import Link from "next/link";
import {
  GripVertical,
  Crown,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { type DeckSummaryItem } from "./DeckSummaryCard";
import { DeckActionsMenu } from "./DeckActionsMenu";

export interface DeckSummaryRowProps {
  deck: DeckSummaryItem;
  missing: number | null | undefined;
  index: number;
  isEditing?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  onToggleSection?: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function DeckSummaryRow({
  deck,
  missing,
  index,
  canMoveUp = false,
  canMoveDown = false,
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  onToggleSection,
  onEdit,
  onDelete,
}: DeckSummaryRowProps) {
  const { t } = useTranslation();
  const isCompetitive = deck.section === "competitive";

  return (
    <div className="group relative flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]">
      <div className="flex min-w-0 items-center gap-3">
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="cursor-grab touch-none p-1 text-slate-500 hover:text-slate-300"
            aria-label={t("decks.dragHandle")}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] font-mono text-xs font-semibold text-slate-400">
          #{index + 1}
        </span>

        <div className="min-w-0">
          <Link
            href={`/decks/${deck.id}`}
            className="flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-400"
          >
            <span className="truncate">{deck.name}</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{deck.champion || t("decks.noChampionSet")}</span>
            <span>•</span>
            <span>
              {deck.totalCards} cards ({deck.mainCount}M / {deck.materialCount}Mat / {deck.sideCount}S)
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isCompetitive
              ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
              : "border-sky-400/30 bg-sky-500/10 text-sky-300"
          }`}
          title={isCompetitive ? t("decks.sectionCompetitiveDesc") : t("decks.section4FunDesc")}
        >
          {isCompetitive ? <Crown className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
          <span className="hidden sm:inline">
            {isCompetitive ? t("decks.sectionCompetitive") : t("decks.section4Fun")}
          </span>
        </span>

        {missing !== undefined && missing !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              missing === 0
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {missing === 0 ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            <span>
              {missing === 0 ? t("decks.feasibilityReady") : `${missing} ${t("decks.missingCards")}`}
            </span>
          </span>
        )}

        <DeckActionsMenu
          deckName={deck.name}
          isCompetitive={isCompetitive}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onToggleSection={onToggleSection}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
