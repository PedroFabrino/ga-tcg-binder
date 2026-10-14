"use client";

import { Lock, Unlock } from "lucide-react";
import { ElementBadge, FoilBadge, LowPopBadge, QuantityStepper, CardArt } from "@/components/ui";
import { formatPopulation } from "@/lib/elements";
import type { CollectionItem, CollectionActions } from "./types";

export default function CollectionTable({ items, onQuantity, onToggleDedicated }: { items: CollectionItem[] } & CollectionActions) {
  return (
    <div className="overflow-x-auto rounded-2xl glass">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Card</th>
            <th scope="col" className="px-4 py-3 font-semibold">Edition</th>
            <th scope="col" className="px-4 py-3 font-semibold">Finish</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Population</th>
            <th scope="col" className="px-4 py-3 font-semibold">Deck Usage</th>
            <th scope="col" className="px-4 py-3 font-semibold">Quantity</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Sharing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {items.map((item) => (
            <tr key={item.id} className="group transition-colors hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`relative h-12 w-9 shrink-0 overflow-hidden rounded-md border border-white/[0.08] ${item.foil ? "foil-static" : ""}`}>
                    <CardArt src={item.imageUrl} alt={item.cardName} className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{item.cardName}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <ElementBadge element={item.element} />
                      <span className="truncate text-[11px] text-slate-500">{item.class}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-mono font-semibold text-slate-200">{item.setPrefix} #{item.collectorNumber}</div>
                <div className="text-[10px] text-slate-500">{item.setName}</div>
              </td>
              <td className="px-4 py-3">
                {item.foil ? <FoilBadge /> : <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-slate-400">Non-Foil</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className={`font-mono font-semibold ${item.isLowPop ? "text-amber-200" : "text-slate-300"}`}>{formatPopulation(item.population)}</span>
                  {item.isLowPop && <LowPopBadge />}
                </div>
              </td>
              <td className="px-4 py-3">
                {item.activeDeckUsages > 0 ? (
                  <div className="font-medium text-cyan-300">{item.activeDeckUsages} deck{item.activeDeckUsages > 1 ? "s" : ""}</div>
                ) : (
                  <div className="text-slate-500">Unassigned</div>
                )}
                <div className="font-mono text-[10px] text-emerald-400">{item.idleQuantity} idle</div>
              </td>
              <td className="px-4 py-3">
                <QuantityStepper value={item.quantity} label={item.cardName} onChange={(d) => onQuantity(item, d)} />
              </td>
              <td className="px-4 py-3 text-right">
                <DedicatedToggle item={item} onToggle={() => onToggleDedicated(item)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DedicatedToggle({ item, onToggle }: { item: CollectionItem; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={item.isDedicated}
      title={item.isDedicated ? "Dedicated: reserved for a single deck" : "Shared: can fill multiple decks"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
        item.isDedicated
          ? "border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
          : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
      }`}
    >
      {item.isDedicated ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      {item.isDedicated ? "Dedicated" : "Shared"}
    </button>
  );
}
