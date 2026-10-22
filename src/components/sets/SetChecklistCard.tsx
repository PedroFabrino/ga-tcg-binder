"use client";

import { Minus, Plus, AlertTriangle, Users } from "lucide-react";
import { RARITIES, getRarityLabel } from "@/lib/rarities";
import { ELEMENT_COLORS } from "@/lib/elements";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SetChecklistReportCard } from "@/services/set-shortage";

interface Props {
  card: SetChecklistReportCard;
  onQuantityChange: (card: SetChecklistReportCard, delta: number) => void;
  quantityLoading?: boolean;
}

export default function SetChecklistCard({ card, onQuantityChange, quantityLoading }: Props) {
  const { t } = useTranslation();
  const rarityLabel = getRarityLabel(card.rarity);
  const rarityColor = RARITIES.find((r) => r.id === card.rarity)?.color ?? "#94a3b8";
  const elementColor = ELEMENT_COLORS[card.element?.toUpperCase()] ?? ELEMENT_COLORS.NORM;

  const firstPrinting = card.printings?.[0];
  const collectorNumber = firstPrinting?.collectorNumber ?? "";
  const prefix = firstPrinting?.setPrefix ?? "";

  const hasShortage = card.shortage !== "none";
  const isHardShortage = card.shortage === "hard";
  const shortageKey = isHardShortage ? "sets.checklist.shortageHard" : "sets.checklist.shortageShared";
  const deckCount = card.deckRequirements?.length ?? 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-white/[0.12]",
        hasShortage && "border-amber-500/20 bg-amber-500/[0.03]",
      )}
    >
      {/* Card image */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl bg-slate-900/50">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.cardName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-700">
            <span className="text-xs">{t("common.loading")}</span>
          </div>
        )}

        {/* Shortage badge */}
        {hasShortage && (
          <div
            className={cn(
              "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
              isHardShortage
                ? "bg-rose-500/20 text-rose-300"
                : "bg-amber-500/20 text-amber-300",
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{t(shortageKey)}</span>
          </div>
        )}
      </div>

      {/* Card details */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Collector number + prefix */}
        {(collectorNumber || prefix) && (
          <p className="font-mono text-[10px] text-slate-500">
            {collectorNumber}
            {prefix && <span className="ml-1 text-slate-600">{prefix}</span>}
          </p>
        )}

        {/* Card name */}
        <p className="text-sm font-semibold text-white leading-tight line-clamp-1">
          {card.cardName}
        </p>

        {/* Element + rarity */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: elementColor }}
            title={card.element}
          />
          <span className="text-[11px] font-medium text-slate-400">{card.element}</span>
          {rarityLabel && (
            <span
              className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: rarityColor, backgroundColor: `${rarityColor}15` }}
            >
              {rarityLabel}
            </span>
          )}
        </div>

        {/* Owned counts */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>{t("sets.checklist.ownedCopies", { count: card.ownedQuantity })}</span>
          {card.ownedNormal > 0 && (
            <span className="text-slate-500">({card.ownedNormal}N)</span>
          )}
          {card.ownedFoil > 0 && (
            <span className="text-slate-500">({card.ownedFoil}F)</span>
          )}
        </div>

        {/* Shortage detail: deck names */}
        {hasShortage && deckCount > 0 && (
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {t("sets.checklist.requiredBy", { count: deckCount })}
            </p>
            <div className="flex flex-wrap gap-1">
              {card.deckRequirements.map((dr) => (
                <Badge
                  key={dr.deckId}
                  className="border-amber-500/20 bg-amber-500/[0.06] text-[10px] text-amber-300/70"
                >
                  {dr.deckName} ({dr.quantity})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Quantity stepper */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onQuantityChange(card, -1)}
            disabled={quantityLoading || card.ownedQuantity <= 0}
            aria-label={t("sets.checklist.decrease")}
            className="stepper-btn h-7 w-7 rounded-lg hover:bg-rose-500/15 hover:text-rose-300"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-mono text-sm font-semibold text-white tabular-nums">
            {card.ownedQuantity}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onQuantityChange(card, 1)}
            disabled={quantityLoading}
            aria-label={t("sets.checklist.increase")}
            className="stepper-btn h-7 w-7 rounded-lg hover:bg-emerald-500/15 hover:text-emerald-300"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}