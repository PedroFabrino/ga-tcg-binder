"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Search, Sparkles, Gem, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/common";
import { SkeletonGrid, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import CatalogCard, { type CatalogCardData, type Edition } from "@/components/catalog/CatalogCard";
import { getElementColor } from "@/lib/elements";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const ELEMENTS = ["NORM", "FIRE", "WATER", "WIND", "EARTH"];
const CLASSES = ["WARRIOR", "MAGE", "TANK", "CLERIC", "ASSASSIN", "RANGER", "TAMER"];
const SETS = ["DOA", "FTC", "ALC", "MRC", "P24", "P23"];

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
        active ? "border-white/20 bg-white/[0.1] text-white" : "border-white/[0.06] text-slate-400 hover:border-white/[0.12] hover:text-slate-200"
      }`}
      style={active && color ? { borderColor: `${color}66`, background: `${color}1f`, color } : undefined}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }}/>}
      {children}
    </button>
  );
}

export default function CatalogPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [cards, setCards] = useState<CatalogCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<string | null>(null);
  const [cardClass, setCardClass] = useState<string | null>(null);
  const [setPrefix, setSetPrefix] = useState<string | null>(null);
  const [lowPopOnly, setLowPopOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "48" });
      if (session?.user?.id) params.set("userId", session.user.id);
      if (query.trim()) params.set("query", query.trim());
      if (element) params.set("element", element);
      if (cardClass) params.set("class", cardClass);
      if (setPrefix) params.set("setPrefix", setPrefix);
      if (lowPopOnly) params.set("lowPopOnly", "true");
      const res = await fetch(`/api/catalog?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCards(Array.isArray(data.cards) ? data.cards : []);
      setTotal(data.total || 0);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, query, element, cardClass, setPrefix, lowPopOnly]);

  useEffect(() => {
    const t = setTimeout(fetchCards, 250);
    return () => clearTimeout(t);
  }, [fetchCards]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 5 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Catalog synced: ${data.stats?.cardsSynced ?? 0} cards updated`, "success");
      fetchCards();
    } catch {
      showToast("Catalog sync failed. Try again in a moment.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = async (ed: Edition, foil: boolean, name: string) => {
    try {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: ed.id, foil, quantity: 1 }),
      });
      if (!res.ok) throw new Error();
      showToast(`Added 1x ${foil ? "Foil " : ""}${name} to Binder`, "success");
      return true;
    } catch {
      showToast(`Couldn't add ${name}`, "error");
      return false;
    }
  };

  const activeCount = [element, cardClass, setPrefix].filter(Boolean).length + (lowPopOnly ? 1 : 0);
  const clearAll = () => {
    setElement(null);
    setCardClass(null);
    setSetPrefix(null);
    setLowPopOnly(false);
  };

  const filters = (
    <div className="space-y-5">
      <div>
        <p className="label-caps mb-2">Element</p>
        <div className="flex flex-wrap gap-1.5">
          {ELEMENTS.map((e) => (
            <Chip key={e} active={element === e} onClick={() => setElement(element === e ? null : e)} color={getElementColor(e)}>{e}</Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="label-caps mb-2">Class</p>
        <div className="flex flex-wrap gap-1.5">
          {CLASSES.map((c) => (
            <Chip key={c} active={cardClass === c} onClick={() => setCardClass(cardClass === c ? null : c)}>{c.charAt(0) + c.slice(1).toLowerCase()}</Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="label-caps mb-2">Set</p>
        <div className="flex flex-wrap gap-1.5">
          {SETS.map((s) => (
            <Chip key={s} active={setPrefix === s} onClick={() => setSetPrefix(setPrefix === s ? null : s)}><span className="font-mono">{s}</span></Chip>
          ))}
        </div>
      </div>
      <label
        htmlFor="lowpop-switch"
        className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
          lowPopOnly ? "border-amber-300/30 bg-amber-300/10 text-amber-200 shadow-[0_0_20px_-8px_rgba(232,201,103,0.6)]" : "border-white/[0.06] text-slate-400 hover:text-slate-200"
        }`}
      >
        <span className="flex items-center gap-2"><Gem className="h-3.5 w-3.5" /> Low population only</span>
        <Switch id="lowpop-switch" tone="gold" checked={lowPopOnly} onCheckedChange={setLowPopOnly} />
      </label>
      {activeCount > 0 && (
        <Button variant="link" size="sm" onClick={clearAll} className="px-0 text-slate-400 hover:text-white">Clear all filters</Button>
      )}
    </div>
  );

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Card Catalog"
        title="Every Grand Archive Printing"
        description="Browse cards across DOA, FTC, ALC, MRC and promo sets with rarity, edition and exact circulation counts."
        actions={
          <>
            <span className="rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-xs text-slate-300">{total.toLocaleString()} cards</span>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="relative overflow-hidden">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin text-cyan-300" : ""}`}/>
              {syncing ? "Syncing..." : "Sync Catalog"}
              {syncing && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/5">
                  <span className="sync-slide block h-full w-1/3 bg-cyan-400" />
                </span>
              )}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl glass p-5">{filters}</div>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl glass px-3 focus-within:border-cyan-400/30">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Fracturize, Rayne, Beseech the Winds..."
                aria-label="Search catalog"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
              )}
            </div>
            <Button onClick={() => setShowFilters((v) => !v)} variant="outline" className="lg:hidden" aria-expanded={showFilters}>
              <SlidersHorizontal className="h-4 w-4" />
              {activeCount > 0 && <span className="font-mono text-xs">{activeCount}</span>}
            </Button>
          </div>

          {showFilters && <div className="rounded-2xl glass p-5 lg:hidden animate-fade-in">{filters}</div>}

          {loading ? (
            <SkeletonGrid count={8}/>
          ) : error ? (
            <EmptyState icon={Sparkles} title="We couldn't load the catalog" action={<Button onClick={fetchCards} variant="outline">Retry</Button>} />
          ) : cards.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No cards match these filters"
              description="Try a different name or clear some filters. If the catalog looks empty, run a sync."
              action={activeCount> 0 ? <Button onClick={clearAll} variant="outline">Clear filters</Button> : <Button onClick={handleSync} variant="outline">Sync Catalog</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {cards.map((card) => (
                <CatalogCard key={card.slug} card={card} onAdd={(ed, foil) => handleAdd(ed, foil, card.name)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
