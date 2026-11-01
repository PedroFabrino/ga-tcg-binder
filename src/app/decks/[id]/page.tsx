"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Trash2, Crown, BookOpen, Check, LayoutGrid, List, Pencil, Sparkles, RefreshCw } from "lucide-react";
import { ConfirmModal } from "@/components/common";
import { SkeletonRow, EmptyState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import DeckFormModal from "@/components/decks/DeckFormModal";
import ShortageTable, { FeasibilityBanner } from "@/components/decks/ShortageTable";
import DeckList, { type DeckCard } from "@/components/decks/DeckList";
import DeckCardGrid from "@/components/decks/DeckCardGrid";
import DeckAdvisorPanel from "@/components/decks/DeckAdvisorPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { buildCollectionUpdateRequest } from "@/lib/collection-stepper";
import { useTranslation } from "@/lib/i18n";
import { useDeckWithShortageQuery } from "@/hooks/queries/use-decks-queries";
import { invalidateDeckQueries, invalidateCollectionQueries } from "@/lib/query-invalidation";

interface BinderTarget {
  cardSlug: string;
  cardName?: string | null;
  assignedEditionId?: string | null;
}

export default function DeckDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const deckId = params?.id as string;
  const { data: session } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: payload, isLoading, isFetching, refetch } = useDeckWithShortageQuery(deckId, session?.user?.id);

  const [copied, setCopied] = useState(false);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const advisorContainerRef = useRef<HTMLDivElement>(null);

  const toggleAdvisor = () => {
    const nextState = !showAdvisor;
    setShowAdvisor(nextState);
    if (nextState) {
      setTimeout(() => {
        advisorContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const deck = payload?.deck?.deck ?? null;
  const cards = useMemo(() => ({
    material: (payload?.deck?.cards?.material || []) as DeckCard[],
    main: (payload?.deck?.cards?.main || []) as DeckCard[],
    side: (payload?.deck?.cards?.side || []) as DeckCard[],
  }), [payload?.deck?.cards]);
  const omnidexText = payload?.deck?.omnidexText || "";
  const shortage = payload?.shortage ?? null;
  const notFound = payload?.notFound ?? false;
  const advisorAllowed = payload?.advisorAllowed ?? false;

  const copyOmnidex = async () => {
    try {
      await navigator.clipboard.writeText(omnidexText);
      setCopied(true);
      showToast(t("decks.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("friends.clipboardError"), "error");
    }
  };

  const resolveEdition = async (cardSlug: string, assignedEditionId?: string | null) => {
    if (assignedEditionId) {
      return { editionId: assignedEditionId, cardName: null as string | null };
    }

    const catRes = await fetch(`/api/catalog?query=${encodeURIComponent(cardSlug)}&limit=1`);
    const catData = catRes.ok ? await catRes.json() : null;
    const foundCard = catData?.cards?.[0];
    return {
      editionId: (foundCard?.editions?.[0]?.id as string | undefined) ?? null,
      cardName: (foundCard?.name as string | undefined) ?? null,
    };
  };

  const adjustCopies = async (target: BinderTarget, delta: number, ownedQuantity: number) => {
    if (delta === 0) return;

    setAddingSlug(target.cardSlug);
    try {
      const resolved = await resolveEdition(target.cardSlug, target.assignedEditionId);
      if (!resolved.editionId) {
        throw new Error(t("shortages.noPrintingFound"));
      }

      const body = buildCollectionUpdateRequest(resolved.editionId, ownedQuantity, delta);
      if (!body) return;

      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, userId: session?.user?.id }),
      });
      if (!res.ok) {
        throw new Error(t("shortages.quantityUpdateError"));
      }

      const cardName = resolved.cardName || target.cardName || target.cardSlug;
      showToast(
        delta > 0
          ? t("shortages.quickAddSuccess", { quantity: delta, cardName })
          : t("shortages.quickRemoveSuccess", { quantity: Math.abs(delta), cardName }),
        delta > 0 ? "success" : "info",
      );
      await invalidateCollectionQueries(queryClient);
      await refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("shortages.quantityUpdateError");
      showToast(msg, "error");
    } finally {
      setAddingSlug(null);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(t("decks.deleteDeckModalTitle"), "info");
      await invalidateDeckQueries(queryClient);
      window.location.href = "/decks";
    } catch {
      showToast(t("common.error"), "error");
      setDeleting(false);
    }
  };

  if (notFound) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("decks.deleteDeck")}
        description={t("decks.deleteConfirm")}
        action={
          <Button asChild variant="outline">
            <a href="/decks">{t("settings.backLink")}</a>
          </Button>
        }
      />
    );
  }

  const showInitialLoading = isLoading && !deck;

  return (
    <div className="space-y-6 pb-12">
      <a href="/decks" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("decks.allDecks")}
      </a>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
        <div>
          {deck?.champion && (
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Crown className="h-3.5 w-3.5" /> {deck.champion}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {deck?.name || "Loading..."}
          </h1>
          {deck && (
            <p className="mt-1 text-xs text-slate-400">
              {cards.main.reduce((acc, c) => acc + c.quantity, 0)} main · {cards.material.reduce((acc, c) => acc + c.quantity, 0)} material · {cards.side.reduce((acc, c) => acc + c.quantity, 0)} sideboard
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 text-xs text-slate-400 hover:text-slate-200"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          {advisorAllowed && (
            <Button
              onClick={toggleAdvisor}
              size="sm"
              variant={showAdvisor ? "default" : "outline"}
              className={showAdvisor ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold" : "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {t("advisor.tabAdvisor")}
            </Button>
          )}
          <Button onClick={() => setEditing(true)} size="sm" variant="outline">
            <Pencil className="h-4 w-4" /> {t("decks.editDeck")}
          </Button>
          <Button onClick={copyOmnidex} size="sm" variant="outline">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
            {copied ? t("decks.copied") : t("decks.copyOmnidex")}
          </Button>
          <Button onClick={() => setConfirmDelete(true)} size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showInitialLoading ? (
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <>
          {shortage && (
            <div className="animate-fade-in">
              <FeasibilityBanner report={shortage} />
            </div>
          )}

          {advisorAllowed && deck && (
            <div ref={advisorContainerRef} className={showAdvisor ? "block animate-fade-in" : "hidden"}>
              <DeckAdvisorPanel
                deckId={deck.id}
                deckName={deck.name}
                onDeckUpdated={() => {
                  invalidateDeckQueries(queryClient);
                  refetch();
                }}
              />
            </div>
          )}

          {/* View Toggle & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">{t("decks.contentAndVisuals")}</span>
              <div className="inline-flex rounded-lg border border-white/[0.08] bg-slate-900/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={t("decks.gridView")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>{t("decks.gridView")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={t("decks.listView")}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>{t("decks.listView")}</span>
                </button>
              </div>
            </div>

            <label htmlFor="only-missing" className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
              <Switch id="only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
              <span>{t("decks.onlyShowShortages")}</span>
            </label>
          </div>

          {viewMode === "grid" ? (
            <section className="rounded-2xl glass p-5 animate-fade-in" aria-label={t("decks.gridView")}>
              <DeckCardGrid
                cards={cards}
                shortageItems={shortage?.items || []}
                onlyMissing={onlyMissing}
                onAddOne={(cardSlug, cardName, assignedEditionId) =>
                  adjustCopies({ cardSlug, cardName, assignedEditionId }, 1, 0)
                }
                onAddMissing={(item) =>
                  adjustCopies(item, item.missingQuantity, item.availableQuantity)
                }
                addingSlug={addingSlug}
              />
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="rounded-2xl glass p-5 lg:col-span-2" aria-label={t("decks.demandAndContention")}>
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-white">{t("decks.demandAndContention")}</h2>
                  <p className="text-[11px] text-slate-500">{t("decks.demandHint")}</p>
                </div>
                <ShortageTable
                  items={shortage?.items || []}
                  onAddMissing={(item) =>
                    adjustCopies(item, item.missingQuantity, item.availableQuantity)
                  }
                  onAdjustQuantity={(item, delta) =>
                    adjustCopies(item, delta, item.availableQuantity)
                  }
                  addingSlug={addingSlug}
                  onlyMissing={onlyMissing}
                />
              </section>
              <aside className="rounded-2xl glass p-5" aria-label={t("decks.decksTab")}>
                <DeckList {...cards} />
              </aside>
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={t("decks.deleteDeckModalTitle")}
          message={t("decks.deleteDeckModalMessage", { name: deck?.name || "" })}
          confirmLabel={t("decks.deleteDeck")}
          busy={deleting}
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {editing && deck && (
        <DeckFormModal
          mode="edit"
          initialDeck={{
            id: deck.id,
            name: deck.name,
            champion: deck.champion,
            omnidexText,
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            showToast(t("decks.deckUpdated"), "success");
            invalidateDeckQueries(queryClient);
            refetch();
          }}
        />
      )}
    </div>
  );
}
