"use client";

import { getElementColor } from "@/lib/elements";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";

export interface DeckCard {
  id: string;
  cardSlug: string;
  zone: string;
  quantity: number;
  cardName: string | null;
  element: string | null;
  class: string | null;
  type: string | null;
  imageUrl?: string | null;
  costReserve?: number | null;
  costMemory?: number | null;
}

function ZoneList({ title, hint, cards, max }: { title: string; hint: string; cards: DeckCard[]; max?: number }) {
  const count = cards.reduce((s, c) => s + c.quantity, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between border-b border-white/[0.06] pb-2">
        <h3 className="text-xs font-semibold text-white">{title}</h3>
        <span className="font-mono text-[11px] text-slate-400">
          {count}{max ? <span className="text-slate-600"> / {max}</span> : null}
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="py-3 text-[11px] text-slate-600">{hint}</p>
      ) : (
        <ul className="space-y-0.5">
          {cards.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.03]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: getElementColor(c.element || "NORM") }} />
              <CardPreviewTrigger
                name={c.cardName || c.cardSlug}
                slug={c.cardSlug}
                imageUrl={c.imageUrl}
                element={c.element}
                className="flex-1 min-w-0"
              >
                <span className="block truncate text-slate-200 transition-colors hover:text-cyan-300 cursor-pointer">{c.cardName || c.cardSlug}</span>
              </CardPreviewTrigger>
              {c.costReserve != null && <span className="font-mono text-[10px] text-slate-500">{c.costReserve}</span>}
              <span className="w-6 text-right font-mono font-semibold text-slate-400">x{c.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CostCurve({ cards }: { cards: DeckCard[] }) {
  const buckets = Array.from({ length: 7 }, () => 0);
  cards.forEach((c) => {
    const cost = c.costReserve ?? c.costMemory;
    if (cost == null) return;
    buckets[Math.min(6, Math.max(0, cost))] += c.quantity;
  });
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold text-white">Cost Curve</h3>
        <span className="text-[10px] text-slate-500">Main deck by reserve cost</span>
      </div>
      {total === 0 ? (
        <p className="py-6 text-center text-[11px] text-slate-600">No cost data for this list yet.</p>
      ) : (
        <div className="flex h-28 items-end gap-2" role="img" aria-label="Cost curve chart">
          {buckets.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-slate-400">{n || ""}</span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-cyan-600/60 to-cyan-300/80 transition-all duration-700"
                style={{ height: `${(n / max) * 80}px`, minHeight: n ? 4 : 1, opacity: n ? 1 : 0.2 }}
              />
              <span className="font-mono text-[10px] text-slate-500">{i === 6 ? "6+" : i}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DeckList({ material, main, side }: { material: DeckCard[]; main: DeckCard[]; side: DeckCard[] }) {
  return (
    <div className="space-y-6">
      <CostCurve cards={main} />
      <ZoneList title="Material Deck" hint="Champions and regalia go here." cards={material} max={12} />
      <ZoneList title="Main Deck" hint="No main deck cards yet." cards={main} max={60} />
      <ZoneList title="Sideboard" hint="No sideboard cards." cards={side} />
    </div>
  );
}
