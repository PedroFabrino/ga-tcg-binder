"use client";

import React from "react";
import Link from "next/link";
import {
  Crown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  GripVertical,
  Flame,
  Smile,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { type DeckSection } from "@ga/contracts";
import { DeckActionsMenu } from "./DeckActionsMenu";

export interface DeckSummaryItem {
  id: string;
  name: string;
  champion: string;
  format: string;
  section: DeckSection;
  priority: number;
  mainCount: number;
  materialCount: number;
  sideCount: number;
  totalCards: number;
}

export interface DeckSummaryCardProps {
  deck: DeckSummaryItem;
  missing: number | null | undefined;
  index: number;
  isEditing?: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  onToggleSection?: (e: React.MouseEvent) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function DeckSummaryCard({
  deck,
  missing,
  index,
  isEditing = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleSection,
  canMoveUp = false,
  canMoveDown = false,
  dragHandleProps,
}: DeckSummaryCardProps) {
  const { t } = useTranslation();
  const isCompetitive = deck.section === "competitive";

  return (
    <Link
      href={`/decks/${deck.id}`}
      style={{ animationDelay: `${index * 50}ms` }}
      className="group relative flex flex-col overflow-hidden rounded-2xl glass p-5 hover-lift animate-fade-in hover:border-white/[0.12]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-200/10 to-transparent text-amber-200">
            <Crown className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-white">{deck.name}</h3>
            <p className="truncate text-xs text-slate-400">
              {deck.champion || t("decks.noChampionSet")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isCompetitive
              ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
              : "border-sky-400/30 bg-sky-500/10 text-sky-300"
          }`}
          title={isCompetitive ? t("decks.sectionCompetitiveDesc") : t("decks.section4FunDesc")}
        >
          {isCompetitive ? <Flame className="h-3 w-3" /> : <Smile className="h-3 w-3" />}
          {isCompetitive ? t("decks.sectionCompetitive") : t("decks.section4Fun")}
        </span>
        <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          {deck.format}
        </span>
        {missing === undefined ? (
          <span className="skeleton h-5 w-20 rounded-full" />
        ) : missing === null ? null : missing === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> {t("decks.feasibilityReady")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            <AlertTriangle className="h-3 w-3" /> {t("decks.missingBadge", { count: String(missing) })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t("decks.zoneMain"), value: deck.mainCount, max: 60 },
          { label: t("decks.zoneMaterial"), value: deck.materialCount, max: 12 },
          { label: t("decks.zoneSide"), value: deck.sideCount },
        ].map((z) => (
          <div
            key={z.label}
            className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-2 text-center"
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              {z.label}
            </div>
            <div className="font-mono text-sm font-semibold text-white">
              {z.value}
              {z.max && <span className="text-slate-500">/{z.max}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs font-medium text-slate-400 transition-colors group-hover:text-white">
        <span>{t("decks.deckDetailTitle")}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
