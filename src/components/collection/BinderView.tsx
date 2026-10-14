"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Gem, Lock } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import { CardArt, QuantityStepper } from "@/components/ui";
import { getElementClass } from "@/lib/elements";
import type { CollectionItem, CollectionActions } from "./types";

const PER_PAGE = 9;

export default function BinderView({ items, onQuantity, onToggleDedicated }: { items: CollectionItem[] } & CollectionActions) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));

  useEffect(() => {
    if (page >= pages) setPage(pages - 1);
  }, [page, pages]);

  const slots = Array.from({ length: PER_PAGE }, (_, i) => items[page * PER_PAGE + i] || null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative rounded-[28px] border border-[#3a2a1c] bg-gradient-to-br from-[#1d140d] via-[#140e09] to-[#0d0906] p-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:p-6">
        <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-dashed border-amber-200/10" />
        <div className="relative grid grid-cols-3 gap-2 rounded-2xl bg-black/30 p-2 sm:gap-4 sm:p-4">
          {slots.map((item, i) =>
            item ? (
              <BinderSlot key={item.id} item={item} onQuantity={onQuantity} onToggleDedicated={onToggleDedicated} />
            ) : (
              <div key={`empty-${i}`} className="pocket-slot flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-white/10">Empty</span>
              </div>
            )
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost !p-2" aria-label="Previous binder page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-slate-400">
          Page {page + 1} / {pages}
        </span>
        <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="btn-ghost !p-2" aria-label="Next binder page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BinderSlot({ item, onQuantity, onToggleDedicated }: { item: CollectionItem } & CollectionActions) {
  return (
    <div className={`${getElementClass(item.element)} group relative`}>
      <TiltCard maxTilt={8} className="rounded-[10px]">
        <div className={`pocket-slot ${item.foil ? "foil-static" : ""}`}>
          <CardArt src={item.imageUrl} alt={item.cardName} className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/70" />
          <div className="absolute left-1.5 top-1.5 z-[5] flex flex-col gap-1">
            <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur">x{item.quantity}</span>
            {item.isDedicated && (
              <span className="rounded-md bg-rose-500/80 p-1 text-white" title="Dedicated">
                <Lock className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
          {item.isLowPop && (
            <span className="gold-badge absolute right-1.5 top-1.5 z-[5] rounded-full p-1" title={`Low pop: ${item.population.toLocaleString()}`}>
              <Gem className="h-2.5 w-2.5" />
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 z-[5] p-2">
            <div className="truncate text-[11px] font-semibold text-white sm:text-xs">{item.cardName}</div>
            <div className="font-mono text-[9px] text-slate-300/80">
              {item.setPrefix} #{item.collectorNumber}{item.foil ? " · FOIL" : ""}
            </div>
          </div>
        </div>
      </TiltCard>
      <div className="absolute inset-x-1 bottom-12 z-10 flex flex-col items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="rounded-lg bg-black/80 backdrop-blur">
          <QuantityStepper value={item.quantity} label={item.cardName} onChange={(d) => onQuantity(item, d)} />
        </div>
        <button
          onClick={() => onToggleDedicated(item)}
          className="rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur hover:text-white"
        >
          {item.isDedicated ? "Make Shared" : "Dedicate"}
        </button>
      </div>
    </div>
  );
}
