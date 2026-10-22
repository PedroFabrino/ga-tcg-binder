"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/common";
import { SkeletonGrid, EmptyState, LoadingState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import SetGroupCard from "@/components/sets/SetGroupCard";
import SetsToolbar from "@/components/sets/SetsToolbar";
import HiddenSetsAccordion from "@/components/sets/HiddenSetsAccordion";
import {
  searchSets,
  filterSetsByCategory,
  sortSets,
  splitActiveHidden,
  type SetCategoryFilter,
  type SetSortMode,
} from "@/lib/sets-view";
import { useTranslation } from "@/lib/i18n";
import type { FeaturedSetSummary } from "@ga/contracts";

export default function SetsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<FeaturedSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SetSortMode>("shortages");
  const [category, setCategory] = useState<SetCategoryFilter>("all");

  // Serialize concurrent hide/unhide toggles per group
  const pendingToggles = useRef<Map<string, Promise<void>>>(new Map());

  // -------------------- Fetch --------------------
  const fetchSets = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch("/api/sets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGroups((data as { groups: FeaturedSetSummary[] }).groups ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  // -------------------- Hide / Unhide --------------------
  const handleToggleHide = useCallback(
    async (groupUuid: string) => {
      // If a toggle is already in-flight for this group, chain after it
      const previous = pendingToggles.current.get(groupUuid) ?? Promise.resolve();

      const togglePromise = previous.then(async () => {
        const group = groups.find((g) => g.groupUuid === groupUuid);
        if (!group) return;

        const newHidden = !group.isHidden;

        // Optimistic update
        setGroups((prev) =>
          prev.map((g) =>
            g.groupUuid === groupUuid ? { ...g, isHidden: newHidden } : g,
          ),
        );

        try {
          const res = await fetch("/api/sets/hide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupUuid, isHidden: newHidden }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch {
          // Rollback
          setGroups((prev) =>
            prev.map((g) =>
              g.groupUuid === groupUuid ? { ...g, isHidden: !newHidden } : g,
            ),
          );
          showToast(t("common.error"), "error");
        }
      });

      pendingToggles.current.set(groupUuid, togglePromise);

      // Clean up resolved promise to prevent memory leak
      void togglePromise.finally(() => {
        pendingToggles.current.delete(groupUuid);
      });
    },
    [groups, showToast, t],
  );

  // -------------------- Derive view state --------------------
  const filtered = filterSetsByCategory(groups, category);
  const searched = searchSets(filtered, query);
  const sorted = sortSets(searched, sortMode);
  const { active, hidden } = splitActiveHidden(sorted);

  // -------------------- Loading state --------------------
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("sets.title")}
          title={t("sets.title")}
          description={t("sets.subtitle")}
        />
        <LoadingState message={t("sets.loading")} />
        <SkeletonGrid count={6} />
      </div>
    );
  }

  // -------------------- Error state --------------------
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("sets.title")}
          title={t("sets.title")}
          description={t("sets.subtitle")}
        />
        <EmptyState
          icon={PackageSearch}
          title={t("common.error")}
        />
      </div>
    );
  }

  // -------------------- Main view --------------------
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("sets.title")}
        title={t("sets.title")}
        description={t("sets.subtitle")}
      />

      <SetsToolbar
        query={query}
        onQueryChange={setQuery}
        sortMode={sortMode}
        onSortChange={setSortMode}
        category={category}
        onCategoryChange={setCategory}
      />

      {/* Active grid */}
      {active.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {active.map((group) => (
            <SetGroupCard
              key={group.groupUuid}
              group={group}
              onToggleHide={handleToggleHide}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t("sets.emptyTitle")}
          description={t("sets.emptyHint")}
        />
      )}

      {/* Hidden accordion */}
      <HiddenSetsAccordion groups={hidden} onToggleHide={handleToggleHide} />
    </div>
  );
}