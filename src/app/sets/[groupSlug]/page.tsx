"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { PackageOpen } from "lucide-react";
import {
  matchesSetChecklistFilters,
  type SetChecklistFilterStatus,
  type SetChecklistFilters as SetChecklistFiltersType,
  type SetChecklistReportCard,
  type SetGroupChecklistReport,
} from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { LoadingState, EmptyState } from "@/components/Skeletons";
import SetChecklistHeader from "@/components/sets/SetChecklistHeader";
import SetChecklistFiltersBar from "@/components/sets/SetChecklistFilters";
import SetChecklistCard from "@/components/sets/SetChecklistCard";
import { buildCollectionUpdateRequest } from "@/lib/collection-stepper";
import { useSetChecklistQuery } from "@/hooks/queries/use-sets-queries";
import { invalidateCollectionQueries } from "@/lib/query-invalidation";

export default function SetChecklistPage() {
  const params = useParams<{ groupSlug: string }>();
  const groupSlug = params?.groupSlug ?? "";
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Filter state
  const [prefix, setPrefix] = useState<string | null>(null);
  const [status, setStatus] = useState<SetChecklistFilterStatus>("all");
  const [search, setSearch] = useState("");
  const [element, setElement] = useState<string | null>(null);
  const [rarity, setRarity] = useState<number | null>(null);
  const [target, setTarget] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("target") || "all";
    }
    return "all";
  });

  // Query state
  const { data, isLoading, isError, error: queryError, refetch } = useSetChecklistQuery(
    groupSlug,
    target,
    session?.user?.id ?? null
  );

  // Local report for optimistic updates
  const [report, setReport] = useState<SetGroupChecklistReport | null>(null);

  useEffect(() => {
    setReport(null);
  }, [target]);

  useEffect(() => {
    if (data) {
      setReport(data);
    }
  }, [data]);

  const notFound = queryError instanceof Error && queryError.message === "NOT_FOUND";
  const loading = isLoading && !report && !notFound;
  const error = isError && !notFound && !report;

  // Quantity loading state per card slug (to serialize concurrent clicks)
  const loadingCardsRef = useRef<Set<string>>(new Set());
  const [loadingCards, setLoadingCards] = useState<Set<string>>(new Set());

  // Stepper: POST delta then optimistically update + refetch
  const handleQuantityChange = useCallback(
    async (card: SetChecklistReportCard, delta: number) => {
      const body = buildCollectionUpdateRequest(
        card.preferredEditionId,
        card.ownedNormal,
        delta,
      );
      if (!body) return;

      const slug = card.cardSlug;
      if (loadingCardsRef.current.has(slug)) return;
      loadingCardsRef.current.add(slug);
      setLoadingCards(new Set(loadingCardsRef.current));

      // Optimistic update: adjust ownedNormal, ownedQuantity
      const newOwnedNormal = Math.max(0, card.ownedNormal + delta);
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.cardSlug === slug
              ? {
                  ...c,
                  ownedNormal: newOwnedNormal,
                  ownedQuantity: newOwnedNormal + c.ownedFoil,
                }
              : c,
          ),
        };
      });

      try {
        const res = await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await invalidateCollectionQueries(queryClient);
        await refetch();
      } catch {
        showToast(t("common.error"), "error");
        await refetch();
      } finally {
        loadingCardsRef.current.delete(slug);
        setLoadingCards(new Set(loadingCardsRef.current));
      }
    },
    [queryClient, refetch, showToast, t],
  );

  // Derived: filtered cards
  const filters: SetChecklistFiltersType = {
    prefix,
    status,
    element,
    rarity,
    search: search || null,
  };

  const allCards = report?.cards ?? [];
  const filteredCards = allCards.filter((c) =>
    matchesSetChecklistFilters(c, filters),
  );

  // -------------------- Render --------------------

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <LoadingState message={t("sets.checklist.loading")} />
      </div>
    );
  }

  // Not found
  if (notFound) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          icon={<PackageOpen className="h-10 w-10 text-slate-600" />}
          title={t("sets.checklist.notFound")}
        />
      </div>
    );
  }

  // Error
  if (error || !report) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          icon={<PackageOpen className="h-10 w-10 text-slate-600" />}
          title={t("sets.checklist.error")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <SetChecklistHeader
        groupName={report.group.name}
        imageUrl={report.group.imageUrl}
        releaseDate={report.group.releaseDate}
        stats={report.stats}
        childPrefixes={report.group.childPrefixes}
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
        target={target}
        onTargetChange={setTarget}
        availableDecks={report.availableDecks}
      />

      {/* Cards grid */}
      {filteredCards.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-10 w-10 text-slate-600" />}
          title={t("sets.checklist.empty")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
