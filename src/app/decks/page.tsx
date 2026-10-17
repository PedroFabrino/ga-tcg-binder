"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Plus,
  Upload,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Crown,
} from "lucide-react";
import { PageHeader, ConfirmModal, Tabs } from "@/components/common";
import { SkeletonCard, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import DeckFormModal from "@/components/decks/DeckFormModal";
import AllShortagesView from "@/components/decks/AllShortagesView";
import { Button } from "@/components/ui/button";
import type { AggregatedShortageReport } from "@/services/shortage";

interface DeckSummary {
  id: string;
  name: string;
  champion: string;
  format: string;
  mainCount: number;
  materialCount: number;
  sideCount: number;
  totalCards: number;
}

type DecksViewTab = "decks" | "shortages";

export default function DecksPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<DecksViewTab>("decks");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [shortages, setShortages] = useState<Record<string, number | null>>({});
  const [aggregatedReport, setAggregatedReport] = useState<AggregatedShortageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingShortages, setLoadingShortages] = useState(false);
  const [error, setError] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "import" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recommendedMeta, setRecommendedMeta] = useState<any[]>([]);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view") as DecksViewTab | null;
    if (v === "shortages" || v === "decks") setActiveTab(v);
  }, []);

  const handleTabChange = (tab: DecksViewTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "shortages") {
      url.searchParams.set("view", "shortages");
    } else {
      url.searchParams.delete("view");
    }
    window.history.replaceState(null, "", url.toString());
  };

  const fetchShortages = useCallback(async () => {
    setLoadingShortages(true);
    try {
      const userIdQuery = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
      const res = await fetch(`/api/decks/shortages${userIdQuery}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAggregatedReport(data);
    } catch {
      // ignore
    } finally {
      setLoadingShortages(false);
    }
  }, [session?.user?.id]);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    try {
      const userIdQuery = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
      const res = await fetch(`/api/decks${userIdQuery}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: DeckSummary[] = Array.isArray(data.decks) ? data.decks : [];
      setDecks(list);
      setError(false);

      // Fetch recommended meta archetypes
      try {
        const metaRes = await fetch(`/api/meta${userIdQuery}`);
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setRecommendedMeta(Array.isArray(metaData.recommendedArchetypes) ? metaData.recommendedArchetypes : []);
        }
      } catch {
        // Soft error: ignore
      }

      list.forEach(async (d) => {
        try {
          const r = await fetch(`/api/decks/${d.id}/shortage${userIdQuery}`);
          const s = r.ok ? await r.json() : null;
          setShortages((prev) => ({
            ...prev,
            [d.id]: typeof s?.totalCardsMissing === "number" ? s.totalCardsMissing : null,
          }));
        } catch {
          setShortages((prev) => ({ ...prev, [d.id]: null }));
        }
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchDecks();
    fetchShortages();
  }, [fetchDecks, fetchShortages]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${pendingDelete.name}"`, "info");
      setPendingDelete(null);
      fetchDecks();
      fetchShortages();
    } catch {
      showToast("Couldn't delete deck", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshAll = () => {
    fetchShortages();
    fetchDecks();
  };

  const totalShortageCopies = aggregatedReport?.summary.totalShortageCopies || 0;

  const TABS = [
    { id: "decks" as const, label: `My Decks (${decks.length})`, icon: BookOpen },
    {
      id: "shortages" as const,
      label: totalShortageCopies > 0 ? `All Shortages (${totalShortageCopies})` : "All Shortages",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Decks & Shortage Engine"
        title="Deck Management"
        description="Every constructed list, checked live against your binder with shared and dedicated copy rules."
        actions={
          <>
            {totalShortageCopies > 0 ? (
              <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 font-mono text-xs text-rose-300">
                {totalShortageCopies} total missing
              </span>
            ) : decks.length > 0 ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300">
                Ready to Play
              </span>
            ) : null}
            <Button onClick={() => setFormMode("import")} variant="outline">
              <Upload className="h-4 w-4" /> Import Omnidex
            </Button>
            <Button onClick={() => setFormMode("create")}>
              <Plus className="h-4 w-4" /> New Deck
            </Button>
          </>
        }
      />

      {/* View Switcher: My Decks vs All Shortages */}
      <Tabs tabs={TABS} active={activeTab} onChange={handleTabChange} />

      {activeTab === "decks" && recommendedMeta.length > 0 && (
        <div className="rounded-2xl glass border border-emerald-400/25 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-300 font-bold">✨</span>
              <h2 className="text-sm font-bold text-white">Recommended Meta Decks for Your Collection</h2>
            </div>
            <a href="/meta" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
              View All Meta Archetypes →
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendedMeta.slice(0, 3).map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/30 p-3 hover:border-emerald-400/40 transition-colors"
              >
                <div className="min-w-0 mr-3">
                  <div className="font-semibold text-white text-xs truncate">{m.name}</div>
                  <div className="text-[11px] text-slate-400">
                    <span className="font-mono text-emerald-300 font-bold">{m.completionPct}% owned</span>
                    {m.missingCardsCount > 0 ? ` · ${m.missingCardsCount} missing` : " · Complete!"}
                  </div>
                </div>
                <Button
                  onClick={async () => {
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
                      if (data.success) {
                        showToast(`Imported "${m.name}" to your Decks!`, "success");
                        fetchDecks();
                      } else {
                        showToast("Failed to import deck: " + data.error, "error");
                      }
                    } catch (err: any) {
                      showToast("Failed to import: " + err.message, "error");
                    }
                  }}
                  size="sm"
                  variant="outline"
                  className="text-xs border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10 shrink-0"
                >
                  Import
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "shortages" ? (
        <AllShortagesView
          report={aggregatedReport}
          onRefresh={handleRefreshAll}
          loading={loadingShortages}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={BookOpen}
          title="We couldn't load your decks"
          action={
            <Button onClick={fetchDecks} variant="outline">
              Retry
            </Button>
          }
        />
      ) : decks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No decks yet"
          description="Create an empty deck or paste an Omnidex list to see what you're missing."
          action={
            <Button onClick={() => setFormMode("import")}>
              <Upload className="h-4 w-4" /> Import a Decklist
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, i) => {
            const missing = shortages[deck.id];
            return (
              <a
                key={deck.id}
                href={`/decks/${deck.id}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group relative flex flex-col overflow-hidden rounded-2xl glass p-5 hover-lift animate-fade-in hover:border-white/[0.12]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-200/10 to-transparent text-amber-200">
                      <Crown className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-white">{deck.name}</h3>
                      <p className="truncate text-xs text-slate-400">
                        {deck.champion || "No champion set"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDelete(deck);
                    }}
                    className="rounded-lg p-1.5 text-slate-500 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Delete ${deck.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    {deck.format}
                  </span>
                  {missing === undefined ? (
                    <span className="skeleton h-5 w-20 rounded-full" />
                  ) : missing === null ? null : missing === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                      <AlertTriangle className="h-3 w-3" /> Shortage: {missing} card
                      {missing === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Main", value: deck.mainCount, max: 60 },
                    { label: "Material", value: deck.materialCount, max: 12 },
                    { label: "Side", value: deck.sideCount },
                  ].map((z) => (
                    <div
                      key={z.label}
                      className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-2 text-center"
                    >
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                        {z.label}
                      </div>
                      <div className="font-mono text-sm font-semibold text-white">
                        {z.value}
                        {z.max && <span className="text-slate-500">/{z.max}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs font-medium text-slate-400 transition-colors group-hover:text-white">
                  Open shortage analysis
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </a>
            );
          })}
        </div>
      )}

      {formMode && (
        <DeckFormModal
          mode={formMode}
          onClose={() => setFormMode(null)}
          onCreated={(id, name) => {
            setFormMode(null);
            showToast(`Deck "${name}" saved`, "success");
            window.location.href = `/decks/${id}`;
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete deck?"
          message={`"${pendingDelete.name}" and its card list will be removed. Cards in your binder are not affected.`}
          confirmLabel="Delete Deck"
          busy={deleting}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
