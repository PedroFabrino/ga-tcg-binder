"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, Loader2, Plus, Gem } from "lucide-react";
import { Modal, ElementBadge } from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface QuickAddModalProps {
  onClose: () => void;
  onAdd: (edition: any, cardName: string, foil: boolean) => Promise<void>;
}

export default function QuickAddModal({ onClose, onAdd }: QuickAddModalProps) {
const { t } = useTranslation();
const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [foil, setFoil] = useState(false);
  const [addingEditionId, setAddingEditionId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/catalog?query=${encodeURIComponent(query.trim())}&limit=12`);
        const data = res.ok ? await res.json() : null;
        setResults(Array.isArray(data?.cards) ? data.cards : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = async (edition: any, cardName: string) => {
    setAddingEditionId(edition.id);
    try {
      await onAdd(edition, cardName, foil);
    } finally {
      setAddingEditionId(null);
    }
  };

  return (
    <Modal
    title={t("collection.quickAddTitle")}
    subtitle={t("collection.quickAddSubtitle")}
    onClose={onClose}
    size="lg"
    footer={
    <Button onClick={onClose} variant="outline">
    {t("collection.quickAddDone")}
    </Button>
    }
    >
      <div className="space-y-4">
        {/* Search & Foil control */}
        <div className="flex items-center gap-2 rounded-2xl glass p-2 focus-within:border-cyan-400/30">
          <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("collection.quickAddPlaceholder")}
            aria-label={t("collection.quickAddTitle")}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-slate-500 outline-none"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
          <button
            type="button"
            onClick={() => setFoil((f) => !f)}
            aria-pressed={foil}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              foil
                ? "foil-chip shadow-[0_0_16px_-4px_rgba(56,189,248,0.6)]"
                : "border border-white/[0.08] text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {foil ? t("collection.quickAddFoil") : t("collection.nonFoil")}
          </button>
        </div>

        {/* Results display */}
        <div className="min-h-[220px] max-h-[380px] overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20">
          {!query.trim() ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Search className="mb-2 h-8 w-8 stroke-1 text-slate-600" />
              <p className="text-xs">Type a card name above to search the Grand Archive catalog.</p>
            </div>
          ) : searching && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-cyan-400" />
              <p className="text-xs">Searching catalog...</p>
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-500">
              No cards found matching &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {results.map((card) => (
                <li
                  key={card.slug}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in"
                >
                  <div className="min-w-0">
                    <CardPreviewTrigger
                      name={card.name}
                      slug={card.slug}
                      imageUrl={card.editions?.[0]?.imageUrl}
                      element={card.element}
                      className="inline-block"
                    >
                      <div className="truncate text-sm font-semibold text-white transition-colors hover:text-cyan-300 cursor-pointer">
                        {card.name}
                      </div>
                    </CardPreviewTrigger>
                    <div className="mt-1 flex items-center gap-2">
                      <ElementBadge element={card.element} />
                      <span className="text-[11px] text-slate-500">
                        {card.editions?.length || 0} printing{card.editions?.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(card.editions || []).map((ed: any) => (
                      <CardPreviewTrigger
                        key={ed.id}
                        name={card.name}
                        slug={card.slug}
                        imageUrl={ed.imageUrl}
                        element={card.element}
                      >
                        <button
                          type="button"
                          disabled={addingEditionId === ed.id}
                          onClick={() => handleAdd(ed, card.name)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] font-medium text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-95 disabled:opacity-50"
                        >
                          {addingEditionId === ed.id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
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
      </div>
    </Modal>
  );
}
