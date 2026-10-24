"use client";

import { useMemo } from "react";
import { Plus, Check, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getElementColor } from "@/lib/elements";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { useTranslation } from "@/lib/i18n";
import type { DeckCard } from "./DeckList";
import type { ShortageItem } from "./ShortageTable";

interface DeckCardGridProps {
  cards: {
    material: DeckCard[];
    main: DeckCard[];
    side: DeckCard[];
  };
  shortageItems?: ShortageItem[];
  onlyMissing?: boolean;
  onAddOne?: (cardSlug: string, cardName?: string | null, assignedEditionId?: string | null) => Promise<void> | void;
  onAddMissing?: (item: ShortageItem) => Promise<void> | void;
  addingSlug?: string | null;
}

const ZONE_SECTIONS = [
  {
    key: "material" as const,
    titleKey: "decks.zoneMaterial" as const,
    hintKey: "decks.zoneMaterialHint" as const,
    max: 12,
  },
  {
    key: "main" as const,
    titleKey: "decks.zoneMain" as const,
    hintKey: "decks.zoneMainHint" as const,
    max: 60,
  },
  {
    key: "side" as const,
    titleKey: "decks.zoneSide" as const,
    hintKey: "decks.zoneSideHint" as const,
    max: 12,
  },
];

export default function DeckCardGrid({
  cards,
  shortageItems = [],
  onlyMissing = false,
  onAddOne,
  onAddMissing,
  addingSlug,
}: DeckCardGridProps) {
  const { t } = useTranslation();

  const shortageMap = useMemo(() => {
    const map = new Map<string, ShortageItem>();
    shortageItems.forEach((item) => {
      map.set(`${item.zone}-${item.cardSlug}`, item);
      if (!map.has(item.cardSlug)) {
        map.set(item.cardSlug, item);
      }
    });
    return map;
  }, [shortageItems]);

  return (
    <div className="space-y-8 animate-fade-in">
      {ZONE_SECTIONS.map(({ key, titleKey, hintKey, max }) => {
        const zoneCards = cards[key] || [];
        const totalCount = zoneCards.reduce((acc, c) => acc + c.quantity, 0);

        const zoneMissingCount = zoneCards.reduce((acc, c) => {
          const item = shortageMap.get(`${c.zone}-${c.cardSlug}`) || shortageMap.get(c.cardSlug);
          const need = c.quantity;
          const have = item ? item.availableQuantity : c.quantity;
          const missing = item ? item.missingQuantity : Math.max(0, need - have);
          return acc + missing;
        }, 0);

        const displayedCards = onlyMissing
          ? zoneCards.filter((card) => {
              const item = shortageMap.get(`${card.zone}-${card.cardSlug}`) || shortageMap.get(card.cardSlug);
              const need = card.quantity;
              const have = item ? item.availableQuantity : card.quantity;
              const missing = item ? item.missingQuantity : Math.max(0, need - have);
              return missing > 0;
            })
          : zoneCards;

        const zoneTitle = t(titleKey);
        const zoneHint = t(hintKey);

        return (
          <section key={key} className="space-y-3" aria-label={zoneTitle}>
            <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">{zoneTitle}</h3>
                <span className="text-[11px] text-slate-500 font-normal">({zoneHint})</span>
              </div>
              <div className="flex items-center gap-2">
                {onlyMissing ? (
                  zoneMissingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-rose-300">
                      <AlertTriangle className="h-3 w-3" />
                      {t("decks.shortagesCountBadge", { count: zoneMissingCount })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                      <Check className="h-3 w-3" />
                      {t("decks.ready")}
                    </span>
                  )
                ) : (
                  <span className="font-mono text-xs font-medium text-slate-400">
                    {totalCount}
                    {max ? <span className="text-slate-600"> / {max}</span> : null}
                  </span>
                )}
              </div>
            </div>

            {displayedCards.length === 0 ? (
              onlyMissing && zoneCards.length > 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-emerald-300 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>{t("decks.noShortagesInZone", { zone: zoneTitle })} ✨</span>
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-500 rounded-xl border border-dashed border-white/[0.06]">
                  {t("decks.noCardsInZoneNamed", { zone: zoneTitle })}
                </p>
              )
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {displayedCards.map((card) => {
                  const item = shortageMap.get(`${card.zone}-${card.cardSlug}`) || shortageMap.get(card.cardSlug);
                  const need = card.quantity;
                  const have = item ? item.availableQuantity : card.quantity;
                  const missing = item ? item.missingQuantity : Math.max(0, need - have);
                  const isContended = item?.isContended ?? false;
                  const isAdding = addingSlug === card.cardSlug;

                  return (
                    <div
                      key={card.id || `${card.zone}-${card.cardSlug}`}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/90 shadow-md transition-all duration-200 hover:border-cyan-400/40 hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.2)]"
                    >
                      {/* Card Artwork Image Container */}
                      <CardPreviewTrigger
                        name={card.cardName || card.cardSlug}
                        slug={card.cardSlug}
                        imageUrl={card.imageUrl}
                        element={card.element}
                        className="relative aspect-[2.5/3.5] w-full overflow-hidden bg-slate-950 block"
                      >
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.cardName || card.cardSlug}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
                            <span
                              className="h-3 w-3 rounded-full mb-2"
                              style={{ background: getElementColor(card.element || "NORM") }}
                            />
                            <span className="text-[11px] font-medium text-slate-300 line-clamp-3">
                              {card.cardName || card.cardSlug}
                            </span>
                          </div>
                        )}

                        {/* Top-Left: Element Dot */}
                        <div
                          className="absolute top-2 left-2 h-2.5 w-2.5 rounded-full shadow ring-1 ring-black/40"
                          style={{ background: getElementColor(card.element || "NORM") }}
                        />

                        {/* Top-Right: Shortage or Quantity Badge */}
                        <div className="absolute top-2 right-2">
                          {missing > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-950/85 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-200 shadow-md backdrop-blur-md">
                              <AlertTriangle className="h-3 w-3 text-rose-400" />
                              {t("decks.missingBadge", { count: missing })}
                            </span>
                          ) : isContended ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/85 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200 shadow-md backdrop-blur-md">
                              <AlertTriangle className="h-3 w-3 text-amber-400" />
                              {t("decks.shared")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/85 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 shadow-md backdrop-blur-md">
                              <Check className="h-3 w-3 text-emerald-400" />
                              x{card.quantity}
                            </span>
                          )}
                        </div>

                        {/* Floating Artwork HUD: Have & Need */}
                        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between rounded-lg border border-white/[0.12] bg-slate-950/85 px-2.5 py-1 text-xs shadow-lg backdrop-blur-md">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {t("decks.have")}
                            </span>
                            <span
                              className={`font-mono text-xs font-bold ${
                                have >= need ? "text-emerald-400" : have > 0 ? "text-cyan-300" : "text-rose-400"
                              }`}
                            >
                              {have}
                            </span>
                          </div>
                          <span className="text-slate-600 font-mono text-xs">/</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {t("decks.need")}
                            </span>
                            <span className="font-mono text-xs font-bold text-white">{need}</span>
                          </div>
                        </div>
                      </CardPreviewTrigger>

                      {/* Card Details & Bottom Metrics Bar */}
                      <div className="flex flex-col p-2.5 gap-2 bg-slate-900/90 border-t border-white/[0.04]">
                        <CardPreviewTrigger
                          name={card.cardName || card.cardSlug}
                          slug={card.cardSlug}
                          imageUrl={card.imageUrl}
                          element={card.element}
                        >
                          <h4
                            className="truncate text-xs font-semibold text-slate-200 transition-colors hover:text-cyan-300 cursor-pointer"
                            title={card.cardName || card.cardSlug}
                          >
                            {card.cardName || card.cardSlug}
                          </h4>
                        </CardPreviewTrigger>

                        {/* Visual Progress Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              have >= need
                                ? "bg-emerald-400"
                                : have > 0
                                ? "bg-gradient-to-r from-cyan-500 to-amber-400"
                                : "bg-rose-500/50"
                            }`}
                            style={{ width: `${Math.min(100, Math.round((have / Math.max(1, need)) * 100))}%` }}
                          />
                        </div>

                        {/* Actions and Status Row */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] gap-1">
                          {missing > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
                              <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                              <span className="truncate">{t("decks.shortCount", { count: missing })}</span>
                            </span>
                          ) : isContended ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="truncate">{t("decks.shared")}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                              <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{t("decks.ready")}</span>
                            </span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {onAddOne && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAddOne(card.cardSlug, card.cardName, card.assignedEditionId)}
                                disabled={isAdding}
                                className="h-6 px-1.5 text-[10px] gap-1 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                                title={t("decks.addOneTitle")}
                              >
                                {isAdding ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Plus className="h-3 w-3" />
                                )}
                                <span>{t("decks.addOne")}</span>
                              </Button>
                            )}

                            {missing > 1 && onAddMissing && item && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAddMissing(item)}
                                disabled={isAdding}
                                className="h-6 px-1.5 text-[10px] border-rose-400/30 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                                title={t("decks.addAllMissingTitle", {
                                  count: missing,
                                  cardName: card.cardName || card.cardSlug,
                                })}
                              >
                                {isAdding ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Plus className="h-3 w-3" />
                                )}
                                <span>{t("decks.addAllMissing", { count: missing })}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
