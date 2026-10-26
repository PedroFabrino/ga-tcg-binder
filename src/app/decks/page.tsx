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
  Pencil,
  Loader2,
} from "lucide-react";
import { RecommendedMetaDecks, type RecommendedMetaArchetype } from "@/components/decks/RecommendedMetaDecks";
import { DeckSummaryCard } from "@/components/decks/DeckSummaryCard";
import { PageHeader, ConfirmModal, Tabs } from "@/components/common";
import { SkeletonCard, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import DeckFormModal from "@/components/decks/DeckFormModal";
import AllShortagesView from "@/components/decks/AllShortagesView";
import { Button } from "@/components/ui/button";
import type { AggregatedShortageReport } from "@/services/shortage";
import { useTranslation } from "@/lib/i18n";

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
const { t } = useTranslation();
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
  const [recommendedMeta, setRecommendedMeta] = useState<RecommendedMetaArchetype[]>([]);
  const [editingDeck, setEditingDeck] = useState<{
    id: string;
    name: string;
    champion: string;
    omnidexText: string;
  } | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

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
        fetchDecks();
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
    { id: "decks" as const, label: `${t("decks.decksTab")} (${decks.length})`, icon: BookOpen },
    {
    id: "shortages" as const,
    label: totalShortageCopies > 0 ? `${t("decks.shortagesTab")} (${totalShortageCopies})` : t("decks.shortagesTab"),
    icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow={t("decks.title")}
        title={t("decks.title")}
        description={t("decks.subtitle")}
        actions={
          <>
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

      {/* View Switcher: My Decks vs All Shortages */}
      <Tabs tabs={TABS} active={activeTab} onChange={handleTabChange} />

      {activeTab === "decks" && (
        <RecommendedMetaDecks
          archetypes={recommendedMeta}
          onImport={handleImportMetaDeck}
        />
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
          {decks.map((deck, i) => (
            <DeckSummaryCard
              key={deck.id}
              deck={deck}
              missing={shortages[deck.id]}
              index={i}
              isEditing={loadingEditId === deck.id}
              onEdit={(e) => handleStartEdit(deck, e)}
              onDelete={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPendingDelete(deck);
              }}
            />
          ))}
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

      {editingDeck && (
        <DeckFormModal
          mode="edit"
          initialDeck={editingDeck}
          onClose={() => setEditingDeck(null)}
          onSaved={() => {
            setEditingDeck(null);
            showToast(t("decks.deckUpdated"), "success");
            fetchDecks();
            fetchShortages();
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
