"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/common";
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
      <PageHeader eyebrow={eyebrowText} title={t("sets.title")} description={t("sets.subtitle")} />

      <SetsToolbar
        query={query}
        onQueryChange={setQuery}
        sortMode={sortMode}
        onSortChange={setSortMode}
        category={category}
        onCategoryChange={setCategory}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        target={target}
        onTargetChange={onTargetChange}
        availableDecks={availableDecks}
        hasPersonalWants={hasPersonalWants}
      />

      {/* Active groups grid or list */}
      {active.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t("sets.emptyTitle")}
          description={t("sets.emptyHint")}
        />
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-2">
          {active.map((group) => (
            <SetGroupRow
              key={group.groupUuid}
              group={group}
              onToggleHide={onToggleHide}
              target={target}
            />
          ))}
        </div>
      ) : (
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
      )}

      {/* Hidden sets accordion — count from unfiltered list */}
      {hidden.length > 0 && (
        <HiddenSetsAccordion
          groups={hiddenSorted}
          onToggleHide={onToggleHide}
        />
      )}
    </div>
  );
}
