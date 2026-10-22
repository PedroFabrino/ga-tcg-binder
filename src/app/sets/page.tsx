"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/common";
import { EmptyState, LoadingState } from "@/components/Skeletons";
import { useToast } from "@/components/ToastProvider";
import SetGroupCard from "@/components/sets/SetGroupCard";
import SetsToolbar from "@/components/sets/SetsToolbar";
import HiddenSetsAccordion from "@/components/sets/HiddenSetsAccordion";
import {
  searchSets,
  filterSetsByCategory,
  sortSets,
  splitActiveHidden,
  applyHiddenFlag,
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
      const previous =
        pendingToggles.current.get(groupUuid) ?? Promise.resolve();

      const togglePromise = previous.then(async () => {
        const group = groups.find((g) => g.groupUuid === groupUuid);
        if (!group) return;

        const newHidden = !group.isHidden;

        // Optimistic update using pure helper
        setGroups((prev) => applyHiddenFlag(prev, groupUuid, newHidden));

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
            applyHiddenFlag(prev, groupUuid, !newHidden),
          );
          showToast(t("common.error"), "error");
        }
      });

      pendingToggles.current.set(groupUuid, togglePromise);

      void togglePromise.finally(() => {
        if (pendingToggles.current.get(groupUuid) === togglePromise) {
          pendingToggles.current.delete(groupUuid);
        }
      });
    },
    [groups, showToast, t],
  );

  // -------------------- Derived data --------------------
  // Hidden groups from UNFILTERED list (P0 #7)
  const { active: rawActive, hidden } = splitActiveHidden(groups);

  // Active list respects search, category, sort
  const searched = searchSets(rawActive, query);
  const filtered = filterSetsByCategory(searched, category);
  const active = sortSets(filtered, sortMode);

  // -------------------- Render --------------------
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <LoadingState message={t("sets.loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          icon={<PackageSearch className="h-10 w-10 text-slate-600" />}
          title={t("common.error")}
          description={t("sets.error")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <PageHeader eyebrow="" title={t("sets.title")} description={t("sets.subtitle")} />

      <SetsToolbar
        query={query}
        onQueryChange={setQuery}
        sortMode={sortMode}
        onSortChange={setSortMode}
        category={category}
        onCategoryChange={setCategory}
      />

      {/* Active groups grid */}
      {active.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10 text-slate-600" />}
          title={t("sets.emptyTitle")}
          description={t("sets.emptyHint")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((group) => (
            <SetGroupCard
              key={group.groupUuid}
              group={group}
              onToggleHide={handleToggleHide}
            />
          ))}
        </div>
      )}

      {/* Hidden sets accordion — count from unfiltered list */}
      {hidden.length > 0 && (
        <HiddenSetsAccordion
          groups={hidden}
          onToggleHide={handleToggleHide}
        />
      )}
    </div>
  );
}