"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Upload,
  AlertTriangle,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import { RecommendedMetaDecks, type RecommendedMetaArchetype } from "@/components/decks/RecommendedMetaDecks";
import { DeckSectionsView } from "@/components/decks/DeckSectionsView";
import { PageHeader, ConfirmModal, Tabs } from "@/components/common";
import { SkeletonCard, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import DeckFormModal from "@/components/decks/DeckFormModal";
import AllShortagesView from "@/components/decks/AllShortagesView";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useDeckOrdering } from "@/hooks/use-deck-ordering";
import {
  useDecksSummaryQuery,
  useAggregatedShortagesQuery,
  type DeckSummary,
} from "@/hooks/queries/use-decks-queries";
import { invalidateDeckQueries } from "@/lib/query-invalidation";

type DecksViewTab = "decks" | "shortages";

export default function DecksPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<DecksViewTab>("decks");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [shortages, setShortages] = useState<Record<string, number | null>>({});
  const [formMode, setFormMode] = useState<"create" | "import" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recommendedMeta, setRecommendedMeta] = useState<RecommendedMetaArchetype[]>([]);
  const [editingDeck, setEditingDeck] = useState<{
    id: string;
    name: string;
    champion?: string | null;
    omnidexText?: string | null;
  } | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

  const {
    data: serverDecks,
    isLoading: isDecksLoading,
    isError: isDecksError,
    isFetching: isDecksFetching,
    refetch: refetchDecks,
  } = useDecksSummaryQuery(session?.user?.id);

  const {
    data: aggregatedReport,
    isLoading: isShortagesLoading,
    refetch: refetchShortages,
  } = useAggregatedShortagesQuery(session?.user?.id);

  const {
    decks,
    setDecks,
    reorder: handleReorder,
    moveWithinSection: handleMove,
    moveToOtherSection: handleToggleSection,
  } = useDeckOrdering<DeckSummary>([], () => {
    invalidateDeckQueries(queryClient);
  });

  useEffect(() => {
    if (serverDecks) {
      setDecks(serverDecks);
      const userIdQuery = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
      serverDecks.forEach(async (d) => {
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
    }
  }, [serverDecks, session?.user?.id, setDecks]);

  useEffect(() => {
    const userIdQuery = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
    fetch(`/api/meta${userIdQuery}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((metaData) => {
        if (metaData && Array.isArray(metaData.recommendedArchetypes)) {
          setRecommendedMeta(metaData.recommendedArchetypes);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  const handleStartEdit = async (deck: DeckSummary, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoadingEditId(deck.id);
    try {
      const res = await fetch(`/api/decks/${deck.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditingDeck({
          id: deck.id,
          name: deck.name,
          champion: deck.champion || "",
          omnidexText: data.omnidexText || "",
        });
      } else {
        showToast("Couldn't load deck details", "error");
      }
    } catch {
      showToast("Couldn't load deck details", "error");
    } finally {
      setLoadingEditId(null);
    }
  };

  const handleImportMetaDeck = async (m: RecommendedMetaArchetype) => {
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
        await invalidateDeckQueries(queryClient);
      } else {
        showToast("Failed to import deck: " + data.error, "error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to import";
      showToast("Failed to import: " + message, "error");
    }
  };

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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${pendingDelete.name}"`, "info");
      setPendingDelete(null);
      await invalidateDeckQueries(queryClient);
    } catch {
      showToast("Couldn't delete deck", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshAll = () => {
    refetchDecks();
    refetchShortages();
    showToast(t("common.refresh"), "info");
  };

  const totalShortageCopies = aggregatedReport?.summary.totalShortageCopies || 0;
  const TABS = [
    { id: "decks" as const, label: `${t("decks.decksTab")} (${decks.length})`, icon: BookOpen },
    {
      id: "shortages" as const,
      label: totalShortageCopies > 0 ? `${t("decks.shortagesTab")} (${totalShortageCopies})` : t("decks.shortagesTab"),
      icon: AlertTriangle,
    },
  ];

  const showInitialLoading = isDecksLoading && decks.length === 0;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow={t("decks.title")}
        title={t("decks.title")}
        description={t("decks.subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isDecksFetching ? "animate-spin" : ""}`} />
            </Button>
            {totalShortageCopies > 0 ? (
              <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 font-mono text-xs text-rose-300">
                {totalShortageCopies} {t("common.missing")}
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={TABS} active={activeTab} onChange={handleTabChange} />
        {activeTab === "decks" && (
          <div className="flex items-center self-end sm:self-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setLayout("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                layout === "grid"
                  ? "bg-white/[0.12] text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              aria-label={t("decks.deckGrid")}
              title={t("decks.deckGrid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{t("decks.deckGrid")}</span>
            </button>
            <button
              type="button"
              onClick={() => setLayout("list")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                layout === "list"
                  ? "bg-white/[0.12] text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              aria-label={t("decks.deckList")}
              title={t("decks.deckList")}
            >
              <List className="h-3.5 w-3.5" />
              <span>{t("decks.deckList")}</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === "decks" && (
        <RecommendedMetaDecks
          archetypes={recommendedMeta}
          onImport={handleImportMetaDeck}
        />
      )}

      {activeTab === "shortages" ? (
        <AllShortagesView
          report={aggregatedReport || null}
          onRefresh={handleRefreshAll}
          loading={isShortagesLoading}
        />
      ) : showInitialLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isDecksError ? (
        <EmptyState
          icon={BookOpen}
          title="We couldn't load your decks"
          action={
            <Button onClick={() => refetchDecks()} variant="outline">
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
            <div className="flex gap-2">
              <Button onClick={() => setFormMode("import")} variant="outline">
                <Upload className="h-4 w-4" /> Import Omnidex
              </Button>
              <Button onClick={() => setFormMode("create")}>
                <Plus className="h-4 w-4" /> New Deck
              </Button>
            </div>
          }
        />
      ) : (
        <DeckSectionsView
          decks={decks}
          layout={layout}
          shortages={shortages}
          loadingEditId={loadingEditId}
          onEdit={handleStartEdit}
          onDelete={(deck: DeckSummary) => setPendingDelete(deck)}
          onReorder={handleReorder}
          onMove={handleMove}
          onToggleSection={handleToggleSection}
        />
      )}

      {formMode && (
        <DeckFormModal
          mode={formMode}
          onClose={() => setFormMode(null)}
          onCreated={(id, name) => {
            setFormMode(null);
            showToast(`Deck "${name}" saved`, "success");
            invalidateDeckQueries(queryClient);
            window.location.href = `/decks/${id}`;
          }}
        />
      )}

      {editingDeck && (
        <DeckFormModal
          mode="edit"
          initialDeck={editingDeck}
          onClose={() => setEditingDeck(null)}
          onSaved={() => {
            setEditingDeck(null);
            showToast(t("decks.deckUpdated"), "success");
            invalidateDeckQueries(queryClient);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title={t("decks.deleteDeckModalTitle")}
          message={t("decks.deleteDeckModalMessage", { name: pendingDelete.name })}
          confirmLabel={t("decks.deleteDeck")}
          busy={deleting}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
