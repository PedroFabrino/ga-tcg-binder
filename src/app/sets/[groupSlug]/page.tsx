"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PackageOpen, ArrowLeft } from "lucide-react";
import { matchesSetChecklistFilters, type SetChecklistFilterStatus, type SetChecklistFilters as SetChecklistFiltersType } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { LoadingState, EmptyState } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import SetChecklistHeader from "@/components/sets/SetChecklistHeader";
import SetChecklistFiltersBar from "@/components/sets/SetChecklistFilters";
import SetChecklistCard from "@/components/sets/SetChecklistCard";
import { buildCollectionUpdateRequest } from "@/components/sets/stepper-utils";
import type { SetChecklistReportCard, SetGroupChecklistReport } from "@/services/set-shortage";

export default function SetChecklistPage() {
  const params = useParams<{ groupSlug: string }>();
  const groupSlug = params?.groupSlug ?? "";
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Data state
  const [report, setReport] = useState<SetGroupChecklistReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Filter state
  const [prefix, setPrefix] = useState<string | null>(null);
  const [status, setStatus] = useState<SetChecklistFilterStatus>("all");
  const [search, setSearch] = useState("");
  const [element, setElement] = useState<string | null>(null);
  const [rarity, setRarity] = useState<number | null>(null);

  // Quantity loading state per card slug (to serialize concurrent clicks)
  const loadingCardsRef = useRef<Set<string>>(new Set());
  const [loadingCards, setLoadingCards] = useState<Set<string>>(new Set());

  // Fetch the checklist
  const fetchChecklist = useCallback(async () => {
    if (!groupSlug) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/sets/${encodeURIComponent(groupSlug)}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: { group: SetGroupChecklistReport["group"]; checklist: SetChecklistReportCard[]; summary: SetGroupChecklistReport["stats"] } = await res.json();
      setReport({
        group: data.group,
        stats: data.summary,
        cards: data.checklist as SetChecklistReportCard[],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [groupSlug]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // Stepper: POST then refetch
  const handleQuantityChange = useCallback(
    async (card: SetChecklistReportCard, delta: number) => {
      const body = buildCollectionUpdateRequest(card.preferredEditionId, card.ownedQuantity, delta);
      if (!body) return;

      const slug = card.cardSlug;
      if (loadingCardsRef.current.has(slug)) return; // serialize

      // Optimistic update
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.cardSlug === slug ? { ...c, ownedQuantity: body.quantity, ownedNormal: body.quantity - (c.ownedFoil ?? 0) } : c,
          ),
        };
      });

      loadingCardsRef.current.add(slug);
      setLoadingCards(new Set(loadingCardsRef.current));

      try {
        const res = await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error ?? `HTTP ${res.status}`);
        }
        // Refetch to get accurate stats
        await fetchChecklist();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update";
        showToast(message, "error");
        // Revert by refetching
        await fetchChecklist();
      } finally {
        loadingCardsRef.current.delete(slug);
        setLoadingCards(new Set(loadingCardsRef.current));
      }
    },
    [fetchChecklist, showToast],
  );

  // Filtering
  const filters: SetChecklistFiltersType = { prefix, status, element, rarity, search: search || null };
  const filteredCards = report?.cards.filter((c) => matchesSetChecklistFilters(c, filters)) ?? [];

  // Compute header stats from report
  const group = report?.group;
  const stats = report?.stats;

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <LoadingState message={t("sets.checklist.loading")} />
      </div>
    );
  }

  // Not found (404)
  if (notFound) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <EmptyState
          icon={PackageOpen}
          title={t("sets.checklist.error")}
          description={t("common.error")}
          action={
            <a href="/sets">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> {t("sets.checklist.backToSets")}
              </Button>
            </a>
          }
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <EmptyState
          icon={PackageOpen}
          title={t("sets.checklist.error")}
          description={error}
          action={
            <Button variant="outline" onClick={fetchChecklist}>
              {t("common.refresh")}
            </Button>
          }
        />
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <SetChecklistHeader
        groupName={group?.name ?? ""}
        imageUrl={group?.imageUrl ?? null}
        releaseDate={group?.releaseDate ?? null}
        stats={stats ?? { totalGroups: 0, totalHardShortageCopies: 0, totalSharedShortageCopies: 0, totalShortageCopies: 0, totalCardsAcrossGroups: 0, totalOwnedCardsAcrossGroups: 0, overallCompletionPercent: 0 }}
        childPrefixes={group?.childPrefixes ?? []}
        selectedPrefix={prefix}
        onPrefixChange={setPrefix}
      />

      <SetChecklistFiltersBar
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        selectedElement={element}
        onElementChange={setElement}
        selectedRarity={rarity}
        onRarityChange={setRarity}
      />

      {filteredCards.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={t("sets.checklist.empty")}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredCards.map((card) => (
            <SetChecklistCard
              key={card.cardSlug}
              card={card}
              onQuantityChange={handleQuantityChange}
              quantityLoading={loadingCards.has(card.cardSlug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}