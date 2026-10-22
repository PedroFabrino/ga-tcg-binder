"use client";

import { ArrowLeft, Calendar, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { SetGroupStats } from "@ga/contracts";

interface Props {
  groupName: string;
  imageUrl: string | null;
  releaseDate: string | null;
  stats: SetGroupStats;
  childPrefixes: string[];
  selectedPrefix: string | null;
  onPrefixChange: (prefix: string | null) => void;
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
        <div className={cn("px-5 pb-5", imageUrl ? "-mt-12 relative z-10" : "pt-5")}>
          <h1 className="text-2xl font-bold text-white">{groupName}</h1>
          {releaseDate && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {t("sets.releaseDate")}:{" "}
              {new Date(releaseDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Completion */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {t("sets.completion", { percent: completionPercent })}
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {ownedCards} <span className="text-sm font-normal text-slate-400">/ {totalCards}</span>
          </p>
        </div>

        {/* Total shortages */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            <AlertTriangle className="inline h-3 w-3" />{" "}
            {t("sets.totalCards", { count: totalCards })}
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {totalCards}
          </p>
        </div>

        {/* Hard shortages */}
        <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-rose-400/70">
            {t("sets.hardShortage")}
          </p>
          <p className="mt-1 text-lg font-bold text-rose-300">{totalHard}</p>
        </div>

        {/* Shared shortages */}
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/70">
            {t("sets.sharedShortage")}
          </p>
          <p className="mt-1 text-lg font-bold text-amber-300">{totalShared}</p>
        </div>
      </div>

      {/* Prefix chips */}
      {childPrefixes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <PrefixChip
            label={t("sets.prefixAll")}
            active={selectedPrefix === null}
            onClick={() => onPrefixChange(null)}
          />
          {childPrefixes.map((prefix) => (
            <PrefixChip
              key={prefix}
              label={prefix}
              active={selectedPrefix === prefix}
              onClick={() => onPrefixChange(prefix)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrefixChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white",
      )}
    >
      {label}
    </button>
  );
}