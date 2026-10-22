"use client";

import { ArrowLeft, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { SetGroupStats } from "@ga/contracts";
import FilterChip from "./FilterChip";

interface Props {
  groupName: string;
  imageUrl: string | null;
  releaseDate: string | null;
  stats: SetGroupStats;
  childPrefixes: string[];
  selectedPrefix: string | null;
  onPrefixChange: (prefix: string | null) => void;
}

/** Parse release date at T12:00:00 to avoid timezone shifts. */
function formatReleaseDate(iso: string | null): string | null {
  if (!iso) return null;
  // Parse as local noon to avoid UTC date drift
  const date = new Date(iso + "T12:00:00");
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SetChecklistHeader({
  groupName,
  imageUrl,
  releaseDate,
  stats,
  childPrefixes,
  selectedPrefix,
  onPrefixChange,
}: Props) {
  const { t } = useTranslation();
  const {
    totalHardShortageCopies: totalHard,
    totalSharedShortageCopies: totalShared,
    totalShortageCopies: totalShortages,
    totalCardsAcrossGroups: totalCards,
    totalOwnedCardsAcrossGroups: ownedCards,
    overallCompletionPercent: completionPercent,
  } = stats;

  const formattedDate = formatReleaseDate(releaseDate);

  return (
    <div className="space-y-4">
      {/* Back link */}
      <a
        href="/sets"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("sets.checklist.backToSets")}
      </a>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/50">
        {imageUrl ? (
          <div className="relative h-40 w-full sm:h-48">
            <img
              src={imageUrl}
              alt={groupName}
              className="h-full w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </div>
        ) : (
          <div className="h-28 bg-slate-900/50" />
        )}

        {/* Overlay text */}
        <div
          className={cn(
            "px-5 pb-5",
            imageUrl ? "-mt-12 relative z-10" : "pt-5",
          )}
        >
          <h1 className="text-2xl font-bold text-white">{groupName}</h1>
          {formattedDate && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {t("sets.releaseDate")}: {formattedDate}
            </p>
          )}
        </div>
      </div>

      {/* Stats row — use total shortages badge, not duplicate total-cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Shortage badge (total) */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{totalShortages}</p>
          <p className="text-[10px] text-amber-500/70">
            {t("sets.shortageBadge", { count: totalShortages })}
          </p>
        </div>

        {/* Completion */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-lg font-bold text-white">{completionPercent}%</p>
          <p className="text-[10px] text-slate-500">
            {t("sets.cardsOwned", { owned: ownedCards, total: totalCards, percent: completionPercent })}
          </p>
        </div>

        {/* Hard shortages */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-lg font-bold text-red-400">{totalHard}</p>
          <p className="text-[10px] text-slate-500">
            {t("sets.hardShortage")}
          </p>
        </div>

        {/* Shared shortages */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
          <p className="text-lg font-bold text-amber-300">{totalShared}</p>
          <p className="text-[10px] text-slate-500">
            {t("sets.sharedShortage")}
          </p>
        </div>
      </div>

      {/* Prefix chips — always shown when childPrefixes has items */}
      {childPrefixes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label={t("sets.prefixAll")}
            pressed={selectedPrefix === null}
            onClick={() => onPrefixChange(null)}
          />
          {childPrefixes.map((prefixValue) => (
            <FilterChip
              key={prefixValue}
              label={prefixValue}
              pressed={selectedPrefix === prefixValue}
              onClick={() => onPrefixChange(prefixValue)}
            />
          ))}
        </div>
      )}
    </div>
  );
}