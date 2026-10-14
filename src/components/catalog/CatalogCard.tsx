"use client";

import { useState } from "react";
import { Plus, Check, Sparkles, Gem } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import { CardArt, ElementBadge, RarityGem } from "@/components/common";
import { formatPopulation, getElementClass } from "@/lib/elements";

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
export interface CatalogCardData {
  slug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  effect: string | null;
  hasLowPopEdition: boolean;
  editions: Edition[];
}

export default function CatalogCard({ card, onAdd }: { card: CatalogCardData; onAdd: (ed: Edition, foil: boolean) => Promise<boolean> }) {
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
        <div className="relative aspect-[5/4] overflow-hidden bg-black/40">
          <CardArt src={ed?.imageUrl} alt={card.name} className="h-full w-full object-top transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-transparent" />
          <div className="absolute left-2.5 top-2.5 z-[5]"><ElementBadge element={card.element} /></div>
          {card.hasLowPopEdition && (
            <span className="gold-badge absolute right-2.5 top-2.5 z-[5] inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <Gem className="h-2.5 w-2.5" /> Low Pop
            </span>
          )}
        </div>
      </TiltCard>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="truncate text-sm font-semibold text-white">{card.name}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{[card.type, card.class].filter(Boolean).join(" · ")}</p>
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
