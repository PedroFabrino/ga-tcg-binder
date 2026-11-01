"use client";

import { ArrowLeft, Calendar, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { formatIsoDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
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
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function SetChecklistHeader({
  groupName,
  imageUrl,
  releaseDate,
  stats,
  childPrefixes,
  selectedPrefix,
  onPrefixChange,
  onRefresh,
  isRefreshing = false,
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

  const formattedDate = formatIsoDate(releaseDate);

  return (
    <div className="space-y-4">
      {/* Back link & Refresh */}
      <div className="flex items-center justify-between">
        <a
          href="/sets"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("sets.checklist.backToSets")}
        </a>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-slate-400 hover:text-white"
            aria-label={t("common.refresh")}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          </Button>
        )}
      </div>

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

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {groupName}
              </h1>
              {formattedDate && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {t("sets.releaseDate", { date: formattedDate })}
                  </span>
                </div>
              )}
            </div>

            {/* Stats chips in banner */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg bg-black/40 px-2.5 py-1 font-mono text-slate-200 border border-white/10">
                {ownedCards} / {totalCards} {t("sets.cardsCount", { count: totalCards })}
              </span>
              <span
                className={cn(
                  "rounded-lg px-2.5 py-1 font-mono font-semibold border",
                  completionPercent === 100
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-white/5 text-slate-300 border-white/10",
                )}
              >
                {completionPercent}%
              </span>
              {totalShortages > 0 && (
                <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 font-mono font-semibold text-rose-300 border border-rose-500/30">
                  {t("sets.shortagesSummary", {
                    hard: totalHard,
                    shared: totalShared,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Child set prefix sub-tabs */}
      {childPrefixes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <FilterChip
            label={t("sets.checklist.allPrefixes")}
            pressed={selectedPrefix === null}
            onClick={() => onPrefixChange(null)}
          />
          {childPrefixes.map((prefix) => (
            <FilterChip
              key={prefix}
              label={prefix}
              pressed={selectedPrefix === prefix}
              onClick={() => onPrefixChange(prefix)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
