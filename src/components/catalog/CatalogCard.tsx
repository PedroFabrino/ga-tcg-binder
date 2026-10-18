"use client";

import { useState } from "react";
import { Plus, Check, Sparkles, Gem, Layers, Flame } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import { CardArt, ElementBadge, RarityGem } from "@/components/common";
import { formatPopulation, getElementClass } from "@/lib/elements";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { useTranslation } from "@/lib/i18n";

export interface Circulation { id: string; kind: string; population: number; foil: boolean }
export interface Edition {
  id: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  lowestPopulation: number;
  isLowPop: boolean;
  circulations: Circulation[];
}
export interface DeckUsage {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
}
export interface CatalogCardData {
  slug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  effect: string | null;
  hasLowPopEdition: boolean;
  isMetaStaple?: boolean;
  stapleInclusionRate?: string | null;
  stapleRecommendedCopies?: number | null;
  stapleCategories?: string[];
  deckUsage?: DeckUsage[];
  editions: Edition[];
}

export default function CatalogCard({ card, onAdd }: { card: CatalogCardData; onAdd: (ed: Edition, foil: boolean) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const ed = card.editions[selected];

  const add = async (foil: boolean) => {
    if (!ed) return;
    const ok = await onAdd(ed, foil);
    if (ok) {
      setAdded(foil ? "foil" : "normal");
      setTimeout(() => setAdded(null), 1600);
    }
  };

  return (
    <article className={`${getElementClass(card.element)} group flex flex-col overflow-hidden rounded-2xl glass transition-colors hover:border-white/[0.12]`}>
      <TiltCard maxTilt={5} className="rounded-t-2xl">
        <CardPreviewTrigger
          name={card.name}
          slug={card.slug}
          imageUrl={ed?.imageUrl}
          element={card.element}
          as="div"
          className="relative aspect-[5/4] overflow-hidden bg-black/40 cursor-pointer"
        >
          <CardArt src={ed?.imageUrl} alt={card.name} className="h-full w-full object-top transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-transparent" />
          <div className="absolute left-2.5 top-2.5 z-[5]"><ElementBadge element={card.element} /></div>
          <div className="absolute right-2.5 top-2.5 z-[5] flex flex-col items-end gap-1">
            {card.hasLowPopEdition && (
              <span className="gold-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                <Gem className="h-2.5 w-2.5" /> Low Pop
              </span>
            )}
            {card.isMetaStaple && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow-sm"
                title={t("fulfillment.stapleTooltip", {
                  rate: card.stapleInclusionRate || "Meta",
                  copies: card.stapleRecommendedCopies || 4,
                })}
              >
                <Flame className="h-2.5 w-2.5 fill-current" />
                {t("fulfillment.stapleBadge")}
                {card.stapleInclusionRate ? ` · ${card.stapleInclusionRate}` : ""}
              </span>
            )}
          </div>
          {card.deckUsage && card.deckUsage.length > 0 && (
            <div className="absolute bottom-2 left-2.5 right-2.5 z-[5] flex flex-wrap gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-md bg-cyan-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 border border-cyan-500/30 backdrop-blur-md shadow-sm"
                title={card.deckUsage.map((u) => `${u.deckName} (${u.quantity}x ${u.zone})`).join(", ")}
              >
                <Layers className="h-3 w-3 text-cyan-400" />
                <span>
                  In {card.deckUsage.length} {card.deckUsage.length === 1 ? "Deck" : "Decks"}
                </span>
              </span>
            </div>
          )}
        </CardPreviewTrigger>
      </TiltCard>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <CardPreviewTrigger
            name={card.name}
            slug={card.slug}
            imageUrl={ed?.imageUrl}
            element={card.element}
            className="inline-block max-w-full"
          >
            <h3 className="truncate text-sm font-semibold text-white transition-colors hover:text-cyan-300 cursor-pointer">{card.name}</h3>
          </CardPreviewTrigger>
          <p className="mt-0.5 text-[11px] text-slate-500">{[card.type, card.class].filter(Boolean).join(" · ")}</p>

          {card.isMetaStaple && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <Flame className="h-3 w-3 text-amber-400" />
                <span>{t("fulfillment.stapleBadge")}</span>
                {card.stapleInclusionRate && <span>· {card.stapleInclusionRate}</span>}
                {card.stapleRecommendedCopies && (
                  <span className="font-mono text-amber-200">({card.stapleRecommendedCopies}x)</span>
                )}
              </span>
            </div>
          )}

          {card.deckUsage && card.deckUsage.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {card.deckUsage.map((u) => (
                <a
                  key={`${u.deckId}-${u.zone}`}
                  href={`/decks/${u.deckId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-400/20 bg-cyan-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15"
                  title={`Used in ${u.deckName} (${u.zone} deck)`}
                >
                  <span className="truncate max-w-[120px]">{u.deckName}</span>
                  <span className="font-mono text-cyan-300 font-semibold">x{u.quantity}</span>
                </a>
              ))}
            </div>
          )}
          {card.effect && <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{card.effect}</p>}
        </div>

        {card.editions.length > 0 && (
          <div className="mt-auto space-y-3">
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Printing">
              {card.editions.map((e, i) => (
                <button
                  key={e.id}
                  role="radio"
                  aria-checked={i === selected}
                  onClick={() => setSelected(i)}
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition-all ${
                    i === selected ? "el-border el-bg-soft el-text" : "border-white/[0.06] text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {e.setPrefix} #{e.collectorNumber}
                </button>
              ))}
            </div>

            {ed && (
              <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
                <RarityGem rarity={ed.rarity} />
                <span className="text-right">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-500">Population</span>
                  <span className={`font-mono text-xs font-semibold ${ed.isLowPop ? "text-amber-200" : "text-slate-200"}`}>{formatPopulation(ed.lowestPopulation)}</span>
                </span>
              </div>
            )}

            <div className="flex gap-1.5">
              <button
                onClick={() => add(false)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                  added === "normal" ? "bg-emerald-500 text-slate-950" : "bg-white text-slate-900 hover:bg-slate-200"
                }`}
              >
                {added === "normal" ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} Add to Binder
              </button>
              <button
                onClick={() => add(true)}
                aria-label={`Add foil ${card.name} to binder`}
                title="Add foil copy"
                className={`flex items-center justify-center rounded-lg px-2.5 py-1.5 transition-all active:scale-95 ${added === "foil" ? "bg-emerald-500 text-slate-950" : "foil-chip hover:brightness-110"}`}
              >
                {added === "foil" ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
