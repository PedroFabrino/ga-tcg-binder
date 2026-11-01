"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  Link2,
  Loader2,
  Swords,
  BookmarkPlus,
  CheckCircle2,
  RefreshCw,
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
import { ArchetypeCard, type MetaArchetype } from "@/components/meta/ArchetypeCard";
import { useMetaExplorerQuery } from "@/hooks/queries/use-meta-queries";
import { invalidateDeckQueries } from "@/lib/query-invalidation";

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

export default function MetaExplorerPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useMetaExplorerQuery(
    session?.user?.id
  );
  const archetypes = data?.archetypes ?? [];
  const recommended = data?.recommendedArchetypes ?? [];
  const loading = isLoading && archetypes.length === 0;
  const error = isError;

  const [customText, setCustomText] = useState("");
  const [compareTitle, setCompareTitle] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState<ShortageReport | null>(null);
  const [savingDeck, setSavingDeck] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

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
      const resData = await res.json();
      if (!res.ok || !Array.isArray(resData.items)) {
        throw new Error(resData.error || "Failed to compare decklist");
      }
      setReport(resData);
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
      const resData = await res.json();
      if (resData.success && resData.id) {
        await invalidateDeckQueries(queryClient);
        if ((m.mypStoreCardsOwned || 0) > 0) {
          showToast(
            t("meta.importWithMypNote", { name: m.name, count: m.mypStoreCardsOwned ?? 0 }),
            "success"
          );
        } else {
          showToast(t("meta.importSuccess", { name: m.name }), "success");
        }
      } else {
        throw new Error(resData.error || "Failed to import deck");
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
      const resData = await res.json();
      if (resData.success && resData.id) {
        await invalidateDeckQueries(queryClient);
        setSavedDeckId(resData.id);
        showToast(t("meta.saveSuccess"), "success");
      } else if (resData.error) {
        showToast(t("meta.saveError", { error: resData.error }), "error");
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
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-slate-400 hover:text-white"
            aria-label={t("common.refresh")}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
          </Button>
        }
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
