"use client";

import { useEffect, useState } from "react";
import { Trophy, ExternalLink, Link2, Loader2, Swords } from "lucide-react";
import { Modal, PageHeader } from "@/components/ui";
import { SkeletonGrid, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import ShortageTable, { FeasibilityBanner, type ShortageReport } from "@/components/decks/ShortageTable";

interface MetaArchetype {
  id: string;
  name: string;
  tier: string;
  champion: string;
  shareRate: string;
  winRate: string;
  decklist: string;
  sourceUrl?: string | null;
}

const TIERS = ["S", "A", "B", "C"];
const TIER_COPY: Record<string, string> = {
  S: "Defining the format",
  A: "Top contenders",
  B: "Strong picks",
  C: "Niche and rogue",
};

function pctValue(v: string) {
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? 0 : n;
}

function ArchetypeCard({ meta, onCompare }: { meta: MetaArchetype; onCompare: () => void }) {
  return (
    <article className="hover-lift group flex flex-col rounded-2xl glass p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{meta.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">{meta.champion}</p>
        </div>
        <span className={`tier-${meta.tier} shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs font-bold`}>{meta.tier}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Win Rate", value: meta.winRate, bar: "bg-emerald-400", max: 70 },
          { label: "Meta Share", value: meta.shareRate, bar: "bg-cyan-400", max: 30 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
            <div className="label-caps !text-[9px]">{s.label}</div>
            <div className="mt-1 font-mono text-lg font-semibold text-white">{s.value}</div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, (pctValue(s.value) / s.max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-4">
        <button onClick={onCompare} className="btn-ghost flex-1 !py-1.5 !text-xs group-hover:border-cyan-400/30 group-hover:text-cyan-200">
          <Swords className="h-3.5 w-3.5" /> Compare to Binder
        </button>
        {meta.sourceUrl && (
          <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${meta.name} stats`} className="btn-ghost !px-2.5 !py-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
}

export default function MetaExplorerPage() {
  const { showToast } = useToast();
  const [archetypes, setArchetypes] = useState<MetaArchetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [customText, setCustomText] = useState("");
  const [compareTitle, setCompareTitle] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState<ShortageReport | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/meta");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setArchetypes(Array.isArray(data.archetypes) ? data.archetypes : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const compare = async (title: string, body: { metaId?: string; deckText?: string }) => {
    setCompareTitle(title);
    setComparing(true);
    setReport(null);
    try {
      const res = await fetch("/api/meta/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) throw new Error();
      setReport(data);
    } catch {
      showToast("Couldn't compare that decklist", "error");
      setCompareTitle(null);
    } finally {
      setComparing(false);
    }
  };

  const missingCount = report?.items.filter((i) => i.missingQuantity > 0).length ?? 0;
  const borrowable = report?.items.filter((i) => i.missingQuantity > 0 && (i.friendsWithIdle?.length ?? 0) > 0).length ?? 0;
  const pct = report && report.totalCardsRequired ? Math.round(((report.totalCardsRequired - report.totalCardsMissing) / report.totalCardsRequired) * 100) : 0;

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Tournament Meta"
        title="Meta Tier List"
        description="Top competitive archetypes by win rate and share. Compare any list against your binder to see how close you are."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (customText.trim()) compare("Custom Decklist", { deckText: customText.trim() });
        }}
        className="mb-8 flex flex-col gap-2 rounded-2xl glass p-2 sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          <Link2 className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Paste a GrandArchiveStats URL or Omnidex decklist..."
            aria-label="Custom decklist or URL"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
          />
        </div>
        <button type="submit" disabled={!customText.trim() || comparing} className="btn-accent">
          <Swords className="h-4 w-4" /> Compare
        </button>
      </form>

      {loading ? (
        <SkeletonGrid count={6} />
      ) : error ? (
        <EmptyState icon={Trophy} title="Couldn't load the meta" description="Please refresh to try again." />
      ) : archetypes.length === 0 ? (
        <EmptyState icon={Trophy} title="No archetypes yet" description="Meta data will appear once tournament results are synced." />
      ) : (
        <div className="space-y-10">
          {TIERS.map((tier) => {
            const list = archetypes.filter((a) => a.tier === tier);
            if (list.length === 0) return null;
            return (
              <section key={tier} aria-label={`Tier ${tier}`}>
                <div className="mb-4 flex items-center gap-3">
                  <span className={`tier-${tier} flex h-9 w-9 items-center justify-center rounded-xl font-mono text-base font-bold`}>{tier}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Tier {tier}</h2>
                    <p className="text-[11px] text-slate-500">{TIER_COPY[tier]} · {list.length} archetype{list.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((m) => (
                    <ArchetypeCard key={m.id} meta={m} onCompare={() => compare(m.name, { metaId: m.id })} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {compareTitle && (
        <Modal title={report?.deckName || compareTitle} subtitle="Shortage report against your binder" onClose={() => setCompareTitle(null)} size="xl">
          {comparing || !report ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
              <p className="text-sm text-slate-400">Analyzing your binder...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Feasibility", value: `${pct}%`, tone: pct === 100 ? "text-emerald-300" : "text-white" },
                  { label: "Cards Missing", value: missingCount, tone: missingCount ? "text-rose-300" : "text-emerald-300" },
                  { label: "Friend Idle", value: borrowable, tone: borrowable ? "text-emerald-300" : "text-slate-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className={`font-mono text-xl font-semibold ${s.tone}`}>{s.value}</div>
                    <div className="label-caps mt-1 !text-[9px]">{s.label}</div>
                  </div>
                ))}
              </div>
              <FeasibilityBanner report={report} />
              <ShortageTable items={report.items} onlyMissing={missingCount > 0} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
