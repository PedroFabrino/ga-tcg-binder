"use client";

import { useCardDetail, selectPrinting } from "@/lib/use-card-catalog";
import { useTranslation } from "@/lib/i18n";

export interface CardArtProps {
  cardSlug: string;
  printingSlug?: string;
  name?: string;
  className?: string;
  imageClassName?: string;
}

/**
 * Card art with a graceful placeholder. The canonical card and printing are
 * the only data the Table stores; the image is resolved from the public card
 * API, so a catalog outage never breaks a Pin.
 */
export function CardArt({
  cardSlug,
  printingSlug,
  name,
  className = "",
  imageClassName = "",
}: CardArtProps) {
  const { t } = useTranslation();
  const { detail, loading } = useCardDetail(cardSlug);
  const printing = selectPrinting(detail, printingSlug);
  const label = name ?? detail?.name ?? cardSlug;

  if (printing?.imageUrl) {
    return (
      <img
        src={printing.imageUrl}
        alt={label}
        className={`object-contain ${className} ${imageClassName}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-secondary/40 p-2 text-center ${className}`}
    >
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground">
        {loading ? t("table.pinLoading") : t("table.pinArtUnavailable")}
      </span>
    </div>
  );
}

export function PinCardLabel({
  cardSlug,
  fallback,
  className = "",
}: {
  cardSlug: string;
  fallback?: string;
  className?: string;
}) {
  const { detail } = useCardDetail(cardSlug);
  return <span className={className}>{detail?.name ?? fallback ?? cardSlug}</span>;
}
