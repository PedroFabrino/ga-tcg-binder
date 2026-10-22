"use client";

import Link from "next/link";
import { Eye, EyeOff, Calendar, Layers, ImageOff, ArrowRight } from "lucide-react";
import { formatIsoDate } from "@/lib/dates";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeaturedSetSummary } from "@ga/contracts";

interface Props {
  group: FeaturedSetSummary;
  onToggleHide: (groupUuid: string) => void;
}

export default function SetGroupRow({ group, onToggleHide }: Props) {
  const { t } = useTranslation();
  const hasShortages = group.totalShortageCopies > 0;

  const categoryLabel =
    group.category === "both"
      ? t("sets.categoryBoth")
      : group.category === "decks"
      ? t("sets.categoryDecks")
      : t("sets.categoryBooster");

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.12] sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Thumbnail & Details */}
      <div className="flex items-center gap-3 min-w-0 sm:w-1/3">
        {/* Thumbnail */}
        <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-900/60">
          {group.imageUrl ? (
            <img
              src={group.imageUrl}
              alt={group.groupName}
              className="h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800/60 to-slate-900/40">
              <ImageOff className="h-5 w-5 text-slate-600" />
            </div>
          )}
        </div>

        {/* Name and Meta */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/sets/${group.slug}`}
            className="truncate text-sm font-semibold text-white hover:text-amber-400 transition-colors block"
            title={group.groupName}
          >
            {group.groupName}
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-500">
              <Calendar className="h-3 w-3" />
              {formatIsoDate(group.releaseDate) ?? t("sets.releaseDateUnknown")}
            </span>

            <span className="inline-flex items-center rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-400">
              {categoryLabel}
            </span>

            {group.impactedDecks > 0 && (
              <span className="flex items-center gap-1 text-slate-500">
                <Layers className="h-3 w-3" />
                {t("sets.decksImpacted", { count: group.impactedDecks })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Shortages */}
      <div className="flex flex-col sm:items-center sm:justify-center min-w-[200px]">
        {hasShortages ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="destructive"
              className="bg-slate-950/80 backdrop-blur-sm border-rose-500/30 text-rose-200 text-xs font-bold shadow-sm px-2 py-0.5"
            >
              {t("sets.shortageBadge", { count: group.totalShortageCopies })}
            </Badge>
            <span className="inline-flex items-center rounded-full bg-rose-700/90 border border-rose-500/30 px-1.5 py-0.5 text-[9px] leading-none text-white shadow-sm">
              {t("sets.hardShortage")}: {group.hardShortageCopies}
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-700/90 border border-amber-500/30 px-1.5 py-0.5 text-[9px] leading-none text-white shadow-sm">
              {t("sets.sharedShortage")}: {group.sharedShortageCopies}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">{t("sets.noShortages")}</span>
        )}
      </div>

      {/* Right: Completion bar and actions */}
      <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[220px]">
        {/* Completion */}
        <div className="w-28 space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{group.completionPercent}%</span>
            <span>{group.ownedCards}/{group.totalCards}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${Math.min(100, group.completionPercent)}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-slate-300 hover:text-white"
          >
            <Link href={`/sets/${group.slug}`}>
              {t("sets.browseSet")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={() => onToggleHide(group.groupUuid)}
            aria-label={group.isHidden ? t("sets.unhideSet") : t("sets.hideSet")}
            title={group.isHidden ? t("sets.unhideSet") : t("sets.hideSet")}
          >
            {group.isHidden ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
