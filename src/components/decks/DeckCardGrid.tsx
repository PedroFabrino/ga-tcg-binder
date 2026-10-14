"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Check, AlertTriangle, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getElementColor } from "@/lib/elements";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import type { DeckCard } from "./DeckList";
import type { ShortageItem } from "./ShortageTable";

interface DeckCardGridProps {
  cards: {
    material: DeckCard[];
    main: DeckCard[];
    side: DeckCard[];
  };
  shortageItems?: ShortageItem[];
  onAddOne?: (cardSlug: string) => Promise<void> | void;
  addingSlug?: string | null;
}

const ZONE_METADATA: { key: "material" | "main" | "side"; title: string; hint: string; max?: number }[] = [
  { key: "material", title: "Material Deck", hint: "Champions, weapons, regalia (up to 12 cards)", max: 12 },
  { key: "main", title: "Main Deck", hint: "60+ cards standard constructed", max: 60 },
  { key: "side", title: "Sideboard", hint: "Up to 12 situational cards", max: 12 },
];

export default function DeckCardGrid({
  cards,
  shortageItems = [],
  onAddOne,
  addingSlug,
}: DeckCardGridProps) {
  // Map cardSlug -> ShortageItem for quick access to Have, Need, Status
  const shortageMap = new Map<string, ShortageItem>();
  shortageItems.forEach((item) => {
    // If card appears in multiple zones, we can key by zone-slug or just slug
    shortageMap.set(`${item.zone}-${item.cardSlug}`, item);
    // fallback by slug
    if (!shortageMap.has(item.cardSlug)) {
      shortageMap.set(item.cardSlug, item);
    }
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {ZONE_METADATA.map(({ key, title, hint, max }) => {
        const zoneCards = cards[key] || [];
        const totalCount = zoneCards.reduce((acc, c) => acc + c.quantity, 0);

        return (
          <section key={key} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
                <span className="text-[11px] text-slate-500 font-normal">({hint})</span>
              </div>
              <span className="font-mono text-xs font-medium text-slate-400">
                {totalCount}
                {max ? <span className="text-slate-600"> / {max}</span> : null}
              </span>
            </div>

            {zoneCards.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500 rounded-xl border border-dashed border-white/[0.06]">
                No cards in {title.toLowerCase()}.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {zoneCards.map((card) => {
                  const item = shortageMap.get(`${card.zone}-${card.cardSlug}`) || shortageMap.get(card.cardSlug);
                  const need = card.quantity;
                  const have = item ? item.availableQuantity : card.quantity;
                  const missing = item ? item.missingQuantity : Math.max(0, need - have);
                  const isContended = item?.isContended ?? false;
                  const isAdding = addingSlug === card.cardSlug;

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                      <Check className="h-3 w-3" /> Ready
                    </span>
                  );

                  if (missing > 0) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="h-3 w-3" /> Short ({missing})
                      </span>
                    );
                  } else if (isContended) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">
                        <AlertTriangle className="h-3 w-3" /> Shared
                      </span>
                    );
                  }

                  return (
                    <div
                      key={card.id || `${card.zone}-${card.cardSlug}`}
                      className="group flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/80 transition-all hover:border-cyan-400/40 hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]"
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

                        {/* Top Overlay Badge for Quantity Needed */}
                        <div className="absolute top-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white shadow backdrop-blur-sm">
                          x{card.quantity}
                        </div>

                        {/* Element Dot Indicator */}
                        <div
                          className="absolute top-2 left-2 h-2.5 w-2.5 rounded-full shadow"
                          style={{ background: getElementColor(card.element || "NORM") }}
                        />
                      </CardPreviewTrigger>

                      {/* Card Details & Bottom Metrics Bar */}
                      <div className="flex flex-col p-2.5 gap-2 bg-slate-900/90 border-t border-white/[0.04]">
                        <div className="min-w-0">
                          <CardPreviewTrigger
                            name={card.cardName || card.cardSlug}
                            slug={card.cardSlug}
                            imageUrl={card.imageUrl}
                            element={card.element}
                          >
                            <h4 className="truncate text-xs font-semibold text-slate-200 transition-colors hover:text-cyan-300 cursor-pointer">
                              {card.cardName || card.cardSlug}
                            </h4>
                          </CardPreviewTrigger>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">
                              Need: <span className="font-mono font-semibold text-white">{need}</span>
                            </span>
                            <span className="text-slate-400">
                              Have: <span className="font-mono font-semibold text-cyan-200">{have}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                          {statusBadge}

                          {onAddOne && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onAddOne(card.cardSlug)}
                              disabled={isAdding}
                              className="h-6 px-1.5 text-[10px] gap-1 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                              title="Add 1 copy to Binder"
                            >
                              {isAdding ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              <span>+1</span>
                            </Button>
                          )}
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
