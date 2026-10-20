"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Trophy,
  ExternalLink,
  Link2,
  Loader2,
  Swords,
  BookmarkPlus,
  CheckCircle2,
} from "lucide-react";
import { Modal, PageHeader } from "@/components/common";
import { SkeletonGrid, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import ShortageTable, {
  FeasibilityBanner,
  type ShortageReport,
} from "@/components/decks/ShortageTable";
import { Button } from "@/components/ui/button";

interface MetaArchetype {
  id: string;
  name: string;
  tier: string;
  champion: string;
  element?: string | null;
  signatureCardImageUrl?: string | null;
  shareRate: string;
  winRate: string;
  deckCount?: number | null;
  decklist: string;
  detailUrl?: string | null;
  sampleEventDeckUrl?: string | null;
  sourceUrl?: string | null;
  completionPct?: number;
  binderPct?: number;
  mypStorePct?: number;
  totalCoreRequired?: number;
  totalCoreOwned?: number;
  binderCardsOwned?: number;
  mypStoreCardsOwned?: number;
  missingCardsCount?: number;
  missingAvailableOnMarketCount?: number;
  estimatedCostToCompleteBrl?: number;
  isRecommended?: boolean;
}

const TIERS = ["Tier 1", "Tier 2", "Tier 3", "S", "A", "B", "C", "Rogue"];
const TIER_COPY: Record<string, string> = {
  "Tier 1": "Dominant meta staples and tournament winners",
  "Tier 2": "High-tier competitive contenders",
  "Tier 3": "Solid competitive alternatives",
  S: "Defining the format",
  A: "Top contenders",
  B: "Strong picks",
  C: "Niche contenders",
  Rogue: "Unranked or niche archetypes",
};

function pctValue(v: string) {
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? 0 : n;
}

function ArchetypeCard({
  meta,
  onCompare,
  onImport,
  importing,
}: {
  meta: MetaArchetype;
  onCompare: () => void;
  onImport: () => void;
  importing: boolean;
}) {
  const completion = meta.completionPct ?? 0;
  const hasHoldings = (meta.totalCoreOwned ?? 0) > 0;

  return (
    <article className="hover-lift group flex flex-col rounded-2xl glass p-5 relative">
      {/* Top Banner / Recommendation Pill */}
      {meta.isRecommended && (
        <div className="mb-2 inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
          <span>✨ Recommended for You</span>
        </div>
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{meta.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {meta.champion}
            {meta.element ? ` · ${meta.element}` : ""}
          </p>
        </div>
        <span
          className={`tier-${meta.tier.replace(/\s+/g, "")} shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs font-bold border border-white/10`}
        >
          {meta.tier}
        </span>
      </div>

      {/* Archetype Completion Progress Bar */}
      {meta.totalCoreRequired && meta.totalCoreRequired > 0 ? (
        <div className="mb-3 rounded-xl border border-white/[0.06] bg-black/30 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">
              {completion}% Owned
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {meta.totalCoreOwned}/{meta.totalCoreRequired} Core Cards
            </span>
          </div>

          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08] flex">
            {meta.binderPct && meta.binderPct > 0 ? (
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${meta.binderPct}%` }}
                title={`Binder: ${meta.binderCardsOwned} cards`}
              />
            ) : null}
            {meta.mypStorePct && meta.mypStorePct > 0 ? (
              <div
                className="h-full bg-amber-400"
                style={{ width: `${meta.mypStorePct}%` }}
                title={`MyP Store: ${meta.mypStoreCardsOwned} cards`}
              />
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1">
            <div className="flex items-center gap-2">
              <span className="text-cyan-300">● {meta.binderCardsOwned || 0} Binder</span>
              {(meta.mypStoreCardsOwned || 0) > 0 && (
                <span className="text-amber-300">● {meta.mypStoreCardsOwned} MyP Store</span>
              )}
            </div>
            {(meta.missingCardsCount || 0) > 0 && (
              <span className="font-mono text-slate-400">
                {meta.missingCardsCount} missing
              </span>
            )}
          </div>

          {/* Cost to complete on MyP */}
          {(meta.missingCardsCount || 0) > 0 && (
            <div className="mt-2 border-t border-white/[0.06] pt-1.5 text-[10px] text-slate-400 flex items-center justify-between">
              <span>MyP Market:</span>
              <span className="font-mono text-emerald-300 font-medium">
                {meta.missingAvailableOnMarketCount && meta.missingAvailableOnMarketCount > 0 ? (
                  <>
                    {meta.missingAvailableOnMarketCount}/{meta.missingCardsCount} in stock · from R${" "}
                    {(meta.estimatedCostToCompleteBrl || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </>
                ) : (
                  <span className="text-slate-500">Out of stock</span>
                )}
              </span>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Win Rate", value: meta.winRate, bar: "bg-emerald-400", max: 70 },
          { label: "Meta Share", value: meta.shareRate, bar: "bg-cyan-400", max: 30 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5">
            <div className="label-caps !text-[9px]">{s.label}</div>
            <div className="mt-0.5 font-mono text-base font-semibold text-white">{s.value}</div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${s.bar}`}
                style={{ width: `${Math.min(100, (pctValue(s.value) / s.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-3">
        <Button
          onClick={onCompare}
          variant="outline"
          size="sm"
          className="flex-1 text-xs group-hover:border-cyan-400/30 group-hover:text-cyan-200"
        >
          <Swords className="h-3.5 w-3.5 mr-1" /> Compare
        </Button>
        <Button
          onClick={onImport}
          disabled={importing}
          variant="default"
          size="sm"
          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold text-xs"
        >
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5 mr-1" />}
          Import
        </Button>
        {meta.sourceUrl && (
          <Button asChild variant="outline" size="sm" className="px-2">
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${meta.name} stats`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

export default function MetaExplorerPage() {
const { t } = useTranslation();
const { data: session } = useSession();
const { showToast } = useToast();
  const [archetypes, setArchetypes] = useState<MetaArchetype[]>([]);
  const [recommended, setRecommended] = useState<MetaArchetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [customText, setCustomText] = useState("");
  const [compareTitle, setCompareTitle] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState<ShortageReport | null>(null);
  const [savingDeck, setSavingDeck] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const userIdQuery = session?.user?.id ? `?userId=${session.user.id}` : "";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/meta${userIdQuery}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setArchetypes(Array.isArray(data.archetypes) ? data.archetypes : []);
        setRecommended(Array.isArray(data.recommendedArchetypes) ? data.recommendedArchetypes : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [userIdQuery]);

  const compare = async (title: string, body: { metaId?: string; deckText?: string }) => {
    setCompareTitle(title);
    setComparing(true);
    setReport(null);
    setSavedDeckId(null);
    try {
      const res = await fetch("/api/meta/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          userId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || "Failed to compare decklist");
      }
      setReport(data);
    } catch (err: any) {
      showToast(err.message || t("meta.compareError"), "error");
      setCompareTitle(null);
    } finally {
      setComparing(false);
    }
  };

  const importArchetype = async (m: MetaArchetype) => {
    if (!m.decklist) {
      showToast(t("meta.noDecklistError"), "error");
      return;
    }
    setImportingId(m.id);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: m.name,
          champion: m.champion || "",
          format: "standard",
          omnidexText: m.decklist,
          userId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        if ((m.mypStoreCardsOwned || 0) > 0) {
          showToast(
            t("meta.importWithMypNote", { name: m.name, count: m.mypStoreCardsOwned ?? 0 }),
            "success"
          );
        } else {
          showToast(t("meta.importSuccess", { name: m.name }), "success");
        }
      } else {
        throw new Error(data.error || "Failed to import deck");
      }
    } catch (err: any) {
      showToast(err.message || t("meta.saveError", { error: "Unknown" }), "error");
    } finally {
      setImportingId(null);
    }
  };

  const handleAddToDecks = async () => {
    if (!report || !report.decklistText) return;
    setSavingDeck(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: (report.deckName || "Meta Deck").replace(/^Meta:\s*/, ""),
          champion: report.champion || "",
          format: "standard",
          omnidexText: report.decklistText,
          userId: session?.user?.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        setSavedDeckId(data.id);
        showToast(t("meta.saveSuccess"), "success");
      } else if (data.error) {
        showToast(t("meta.saveError", { error: data.error }), "error");
      }
    } catch (err: any) {
      showToast(t("meta.saveError", { error: err.message }), "error");
    } finally {
      setSavingDeck(false);
    }
  };

  const missingCount = report?.items.filter((i) => i.missingQuantity > 0).length ?? 0;
  const borrowable =
    report?.items.filter((i) => i.missingQuantity > 0 && (i.friendsWithIdle?.length ?? 0) > 0)
      .length ?? 0;
  const pct =
    report && report.totalCardsRequired
      ? Math.round(
          ((report.totalCardsRequired - report.totalCardsMissing) / report.totalCardsRequired) * 100
        )
      : 0;

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Tournament Meta"
        title="Meta Tier List & Recommendations"
        description="Top competitive archetypes by win rate and share, personalized to your binder and MyP store inventory."
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
        <Button type="submit" disabled={!customText.trim() || comparing} variant="accent">
          <Swords className="h-4 w-4" /> Compare
        </Button>
      </form>

      {/* Recommended for Your Collection Highlight Rail */}
      {recommended.length > 0 && (
        <section className="mb-10" aria-label="Recommended Decks">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                ✨
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Recommended for Your Collection</h2>
                <p className="text-xs text-slate-400">
                  Archetypes you are closest to completing with cards in your Binder and MyP Store
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((m) => (
              <ArchetypeCard
                key={`rec-${m.id}`}
                meta={{ ...m, isRecommended: true }}
                onCompare={() => compare(m.name, { metaId: m.id })}
                onImport={() => importArchetype(m)}
                importing={importingId === m.id}
              />
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <SkeletonGrid count={6} />
      ) : error ? (
        <EmptyState
          icon={Trophy}
          title="Couldn't load the meta"
          description="Please refresh to try again."
        />
      ) : archetypes.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No archetypes yet"
          description="Meta data will appear once tournament results are synced."
        />
      ) : (
        <div className="space-y-10">
          {TIERS.map((tier) => {
            const list = archetypes.filter(
              (a) => a.tier.toLowerCase() === tier.toLowerCase()
            );
            if (list.length === 0) return null;
            return (
              <section key={tier} aria-label={`Tier ${tier}`}>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`tier-${tier.replace(/\s+/g, "")} flex h-9 px-3 items-center justify-center rounded-xl font-mono text-xs font-bold border border-white/10`}
                  >
                    {tier}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{tier}</h2>
                    <p className="text-[11px] text-slate-500">
                      {TIER_COPY[tier] || "Competitive Archetypes"} · {list.length} archetype{list.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((m) => (
                    <ArchetypeCard
                      key={m.id}
                      meta={m}
                      onCompare={() => compare(m.name, { metaId: m.id })}
                      onImport={() => importArchetype(m)}
                      importing={importingId === m.id}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {compareTitle && (
        <Modal
          title={report?.deckName || compareTitle}
          subtitle="Shortage report against your binder"
          onClose={() => setCompareTitle(null)}
          size="xl"
        >
          {comparing || !report ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
              <p className="text-sm text-slate-400">Analyzing your binder...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Feasibility",
                    value: `${pct}%`,
                    tone: pct === 100 ? "text-emerald-300" : "text-white",
                  },
                  {
                    label: "Cards Missing",
                    value: missingCount,
                    tone: missingCount ? "text-rose-300" : "text-emerald-300",
                  },
                  {
                    label: "Friend Idle",
                    value: borrowable,
                    tone: borrowable ? "text-emerald-300" : "text-slate-400",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center"
                  >
                    <div className={`font-mono text-xl font-semibold ${s.tone}`}>{s.value}</div>
                    <div className="label-caps mt-1 !text-[9px]">{s.label}</div>
                  </div>
                ))}
              </div>

              {report.decklistText && (
                <div className="flex justify-end pt-1">
                  {savedDeckId ? (
                    <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Saved to Decks!</span>
                      <a href={`/decks/${savedDeckId}`} className="ml-1 underline hover:text-white">
                        View →
                      </a>
                    </div>
                  ) : (
                    <Button
                      onClick={handleAddToDecks}
                      disabled={savingDeck}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {savingDeck ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BookmarkPlus className="h-3.5 w-3.5" />
                      )}
                      Add to My Decks
                    </Button>
                  )}
                </div>
              )}

              <FeasibilityBanner report={report} />
              <ShortageTable items={report.items} onlyMissing={missingCount > 0} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
