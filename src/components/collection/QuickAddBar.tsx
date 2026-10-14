"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Sparkles, Loader2, Plus, Gem } from "lucide-react";
import { ElementBadge } from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";

export default function QuickAddBar({ onAdd }: { onAdd: (edition: any, cardName: string, foil: boolean) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [foil, setFoil] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/catalog?query=${encodeURIComponent(query.trim())}&limit=6`);
        const data = res.ok ? await res.json() : null;
        setResults(Array.isArray(data?.cards) ? data.cards : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative z-30">
      <div className="flex items-center gap-2 rounded-2xl glass p-2 focus-within:border-cyan-400/30">
        <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Quick-add a card: Fracturize, Rayne..."
          aria-label="Quick-add card search"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-slate-500 outline-none"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        <button
          onClick={() => setFoil((f) => !f)}
          aria-pressed={foil}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            foil ? "foil-chip shadow-[0_0_16px_-4px_rgba(56,189,248,0.6)]" : "border border-white/[0.08] text-slate-400 hover:text-white"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {foil ? "Foil" : "Non-Foil"}
        </button>
      </div>

      {open && query.trim() && !searching && (
        <div className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl glass-strong shadow-2xl animate-modal">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">No cards match &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-white/[0.04] overflow-y-auto">
              {results.map((card) => (
                <li key={card.slug} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <CardPreviewTrigger
                      name={card.name}
                      slug={card.slug}
                      imageUrl={card.editions?.[0]?.imageUrl}
                      element={card.element}
                      className="inline-block"
                    >
                      <div className="truncate text-sm font-semibold text-white transition-colors hover:text-cyan-300 cursor-pointer">{card.name}</div>
                    </CardPreviewTrigger>
                    <div className="mt-1 flex items-center gap-2">
                      <ElementBadge element={card.element} />
                      <span className="text-[11px] text-slate-500">{card.editions?.length || 0} printings</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(card.editions || []).slice(0, 3).map((ed: any) => (
                      <CardPreviewTrigger
                        key={ed.id}
                        name={card.name}
                        slug={card.slug}
                        imageUrl={ed.imageUrl}
                        element={card.element}
                      >
                        <button
                          onClick={async () => {
                            await onAdd(ed, card.name, foil);
                            setQuery("");
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] font-medium text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-95"
                        >
                          <Plus className="h-3 w-3" />
                          {ed.setPrefix} #{ed.collectorNumber}
                          {ed.isLowPop && <Gem className="h-2.5 w-2.5 text-amber-300" />}
                        </button>
                      </CardPreviewTrigger>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
