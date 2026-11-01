"use client";

import { useState } from "react";
import { PackageSearch, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/Skeletons";
import SetGroupCard from "@/components/sets/SetGroupCard";
import SetGroupRow from "@/components/sets/SetGroupRow";
import SetsToolbar from "@/components/sets/SetsToolbar";
import HiddenSetsAccordion from "@/components/sets/HiddenSetsAccordion";
import {
  searchSets,
  filterSetsByCategory,
  sortSets,
  splitActiveHidden,
  type SetCategoryFilter,
  type SetSortMode,
  type SetViewMode,
} from "@/lib/sets-view";
import { useTranslation } from "@/lib/i18n";
import type { FeaturedSetSummary, SetTargetDeck } from "@ga/contracts";

export interface SetsDashboardViewProps {
  groups: FeaturedSetSummary[];
  loading?: boolean;
  error?: boolean;
  onToggleHide: (groupUuid: string) => void;
  initialQuery?: string;
  initialSortMode?: SetSortMode;
  initialCategory?: SetCategoryFilter;
  initialViewMode?: SetViewMode;
  target?: string;
  onTargetChange?: (target: string) => void;
  availableDecks?: SetTargetDeck[];
  hasPersonalWants?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function SetsDashboardView({
  groups,
  loading = false,
  error = false,
  onToggleHide,
  initialQuery = "",
  initialSortMode = "shortages",
  initialCategory = "all",
  initialViewMode = "grid",
  target = "all",
  onTargetChange,
  availableDecks = [],
  hasPersonalWants = false,
  onRefresh,
  isRefreshing = false,
}: SetsDashboardViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [sortMode, setSortMode] = useState<SetSortMode>(initialSortMode);
  const [category, setCategory] = useState<SetCategoryFilter>(initialCategory);
  const [viewMode, setViewMode] = useState<SetViewMode>(initialViewMode);

  // Hidden groups from UNFILTERED list (P0 #7)
  const { active: rawActive, hidden } = splitActiveHidden(groups);

  // Active list respects search, category, sort
  const searched = searchSets(rawActive, query);
  const filtered = filterSetsByCategory(searched, category);
  const active = sortSets(filtered, sortMode);
  // Sorting stays applied inside the hidden section too.
  const hiddenSorted = sortSets(hidden, sortMode);

  // Render
  const totalActiveShortages = rawActive.reduce(
    (sum, g) => sum + g.totalShortageCopies,
    0,
  );
  const eyebrowText =
    totalActiveShortages > 0
      ? t("sets.activeShortagesIndicator", { count: totalActiveShortages })
      : t("sets.noShortages");

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
          icon={PackageSearch}
          title={t("common.error")}
          description={t("sets.error")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <PageHeader
        eyebrow={eyebrowText}
        title={t("sets.title")}
        description={t("sets.subtitle")}
        actions={
          onRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-slate-400 hover:text-white"
              aria-label={t("common.refresh")}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
            </Button>
          ) : undefined
        }
      />

      {/* Target selection toolbar (deck / wants filter) */}
      <SetsToolbar
        target={target}
        onTargetChange={onTargetChange}
        availableDecks={availableDecks}
        hasPersonalWants={hasPersonalWants}
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        sortMode={sortMode}
        onSortChange={setSortMode}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Main grid / list */}
      {active.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t("sets.emptySearch")}
          description={t("sets.emptySearchHint")}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((group) => (
            <SetGroupCard
              key={group.groupUuid}
              group={group}
              onToggleHide={onToggleHide}
              target={target}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((group) => (
            <SetGroupRow
              key={group.groupUuid}
              group={group}
              onToggleHide={onToggleHide}
              target={target}
            />
          ))}
        </div>
      )}

      {/* Collapsed hidden sets section */}
      <HiddenSetsAccordion
        groups={hiddenSorted}
        onToggleHide={onToggleHide}
      />
    </div>
  );
}
