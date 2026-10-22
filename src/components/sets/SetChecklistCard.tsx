"use client";

import { Minus, Plus, AlertTriangle, Users } from "lucide-react";
import { RARITIES, getRarityLabel } from "@/lib/rarities";
import { ELEMENT_COLORS } from "@/lib/elements";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SetChecklistReportCard } from "@ga/contracts";

interface Props {
  card: SetChecklistReportCard;
  onQuantityChange: (card: SetChecklistReportCard, delta: number) => void;
  quantityLoading?: boolean;
}

export default function SetChecklistCard({
  card,
  onQuantityChange,
  quantityLoading,
}: Props) {
  const { t } = useTranslation();
  const rarityLabel = getRarityLabel(card.rarity);
  const rarityColor =
    RARITIES.find((r) => r.id === card.rarity)?.color ?? "#94a3b8";
  const elementColor =
    ELEMENT_COLORS[card.element?.toUpperCase()] ?? ELEMENT_COLORS.NORM;

  const hasShortage = card.shortage !== "none";
  const isHardShortage = card.shortage === "hard";
  const shortageKey = isHardShortage
    ? "sets.checklist.shortageHard"
    : "sets.checklist.shortageShared";
  const deckCount = card.deckRequirements?.length ?? 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-white/[0.12]",
        hasShortage && "border-amber-500/20 bg-amber-500/[0.03]",
      )}
    >
      {/* Card image */}
      <div className="relative aspect-[2.5/3.5] w-full overflow-hidden rounded-t-xl bg-slate-900/60">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.cardName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PackageIcon className="h-8 w-8 text-slate-600" />
          </div>
        )}

        {/* Shortage badge (top-left) */}
        {hasShortage && (
          <div className="absolute left-2 top-2">
            <Badge
              variant="destructive"
              className="text-[10px] font-bold"
              aria-label={`${t(shortageKey)}: ${card.missingQuantity}`}
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              {t(shortageKey)} ({card.missingQuantity})
            </Badge>
          </div>
        )}

        {/* Deck count badge (top-right when no shortage) */}
        {deckCount > 0 && !hasShortage && (
          <div className="absolute right-2 top-2">
            <Badge
              variant="default"
              className="text-[10px]"
              aria-label={t("sets.checklist.requiredBy", { count: deckCount })}
            >
              <Users className="mr-1 h-3 w-3" />
              {deckCount}
            </Badge>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Name + element + rarity */}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">
            {card.cardName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {/* Element dot */}
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: elementColor }}
              title={card.element}
            />
            <span className="text-[11px] text-slate-400">
              {t("sets.checklist.normalCopies", { count: card.ownedNormal })}
            </span>
            <span className="text-[11px] text-slate-500">·</span>
            <span className="text-[11px] text-slate-400">
              {t("sets.checklist.foilCopies", { count: card.ownedFoil })}
            </span>
          </div>
        </div>

        {/* All printings */}
        {card.printings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.printings.map((p) => (
              <span
                key={p.editionId}
                className="inline-flex items-center gap-1 rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                {p.setPrefix} #{p.collectorNumber}
              </span>
            ))}
          </div>
        )}

        {/* Deck requirements (expandable hint) */}
        {card.deckRequirements.length > 0 && (
          <details className="mt-0.5">
            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-400">
              {t("sets.checklist.requiredBy", { count: deckCount })}
            </summary>
            <ul className="mt-1 space-y-0.5 pl-3">
              {card.deckRequirements.map((dr) => (
                <li
                  key={dr.deckId}
                  className="text-[10px] text-slate-500"
                >
                  {dr.deckName}: ×{dr.quantity}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Stepper (bottom) */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          disabled={
            quantityLoading || card.ownedNormal <= 0
          }
          onClick={() => onQuantityChange(card, -1)}
          aria-label={t("sets.checklist.decrease")}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>

        <span className="text-xs font-medium tabular-nums text-slate-300">
          {card.ownedQuantity}
          <span className="ml-1 text-[10px] text-slate-500">
            / {card.requiredQuantity}
          </span>
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          disabled={quantityLoading || !card.preferredEditionId}
          onClick={() => onQuantityChange(card, 1)}
          aria-label={t("sets.checklist.increase")}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Neutral icon used when no image URL is available. */
function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}