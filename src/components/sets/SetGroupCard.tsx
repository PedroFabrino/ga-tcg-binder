"use client";

import { ImageOff, Calendar, ExternalLink, EyeOff, Package, Layers } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { FeaturedSetSummary } from "@ga/contracts";

export default function SetGroupCard({
  group,
  onToggleHide,
}: {
  group: FeaturedSetSummary;
  onToggleHide: (groupUuid: string) => void;
}) {
  const { t } = useTranslation();

  const hasShortages = group.totalShortageCopies > 0;

  return (
    <div className="group relative flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-colors hover:border-white/[0.10]">
      {/* Banner */}
      <div className="relative h-36 bg-slate-900/40">
        {group.imageUrl ? (
          <img
            src={group.imageUrl}
            alt={group.groupName}
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800/60 to-slate-900/40">
            <ImageOff className="h-8 w-8 text-slate-600" />
          </div>
        )}
        {/* Shortage pill overlay */}
        {hasShortages && (
          <div className="absolute top-2 right-2">
            <div className="flex flex-col items-end gap-0.5">
              <Badge variant="destructive" className="text-xs font-bold">
                {t("sets.shortageBadge", { count: group.totalShortageCopies })}
              </Badge>
              <div className="flex gap-0.5">
                <span className="inline-flex items-center rounded-full bg-rose-700/80 px-1.5 py-0.5 text-[9px] leading-none text-white">
                  {t("sets.hardShortage")}: {group.hardShortageCopies}
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-700/80 px-1.5 py-0.5 text-[9px] leading-none text-white">
                  {t("sets.sharedShortage")}: {group.sharedShortageCopies}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3 gap-2">
        {/* Name + Category */}
        <div>
          <h3 className="text-sm font-semibold text-white truncate" title={group.groupName}>
            {group.groupName}
          </h3>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" />
            {t("sets.releaseDate")}
            {group.releaseDate ? (
              <>: {new Date(`${group.releaseDate}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</>
            ) : (
              <>: —</>
            )}
          </p>
        </div>

        {/* No shortage message */}
        {!hasShortages && (
          <p className="text-[11px] text-slate-600">{t("sets.noShortages")}</p>
        )}

        {/* Impacted decks */}
        {group.impactedDecks > 0 && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {t("sets.decksImpacted", { count: group.impactedDecks })}
          </p>
        )}

        {/* Completion bar */}
        <div className="mt-auto space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">
              {t("sets.cardsOwned", {
                owned: group.ownedCards,
                total: group.totalCards,
                percent: group.completionPercent,
              })}
            </span>
            <span className="text-slate-400 font-medium">
              {t("sets.completion", { percent: group.completionPercent })}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                group.completionPercent >= 80
                  ? "bg-emerald-500"
                  : group.completionPercent >= 40
                    ? "bg-cyan-500"
                    : "bg-amber-500",
              )}
              style={{ width: `${group.completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-white/[0.04] p-2">
        <Button variant="outline" size="sm" className="flex-1 text-[11px]" asChild>
          <Link href={`/sets/${group.slug}`}>
            <Package className="h-3.5 w-3.5" />
            {t("sets.browseSet")}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-slate-500 hover:text-slate-300"
          onClick={() => onToggleHide(group.groupUuid)}
          aria-label={t("sets.hideSet")}
          title={t("sets.hideSet")}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}