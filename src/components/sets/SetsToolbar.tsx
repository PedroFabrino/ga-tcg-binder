"use client";

import { Search, ChevronDown, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SetCategoryFilter, SetSortMode, SetViewMode } from "@/lib/sets-view";

const CATEGORY_OPTIONS: { value: SetCategoryFilter; tKey: "sets.filterAll" | "sets.filterBoosters" | "sets.filterDecks" }[] = [
  { value: "all", tKey: "sets.filterAll" },
  { value: "booster", tKey: "sets.filterBoosters" },
  { value: "decks", tKey: "sets.filterDecks" },
];

const SORT_OPTIONS: {
  value: SetSortMode;
  tKey:
    | "sets.sortByShortages"
    | "sets.sortByHardShortages"
    | "sets.sortByCompletionAsc"
    | "sets.sortByCompletionDesc"
    | "sets.sortByDate"
    | "sets.sortByName";
}[] = [
  { value: "shortages", tKey: "sets.sortByShortages" },
  { value: "hardShortages", tKey: "sets.sortByHardShortages" },
  { value: "completionAsc", tKey: "sets.sortByCompletionAsc" },
  { value: "completionDesc", tKey: "sets.sortByCompletionDesc" },
  { value: "date", tKey: "sets.sortByDate" },
  { value: "name", tKey: "sets.sortByName" },
];

export default function SetsToolbar({
  query,
  onQueryChange,
  sortMode,
  onSortChange,
  category,
  onCategoryChange,
  viewMode,
  onViewModeChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  sortMode: SetSortMode;
  onSortChange: (mode: SetSortMode) => void;
  category: SetCategoryFilter;
  onCategoryChange: (cat: SetCategoryFilter) => void;
  viewMode: SetViewMode;
  onViewModeChange: (mode: SetViewMode) => void;
}) {
  const { t } = useTranslation();

  const activeSortLabel = SORT_OPTIONS.find((o) => o.value === sortMode)?.tKey ?? "sets.sortByShortages";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          className="pl-9 h-9 text-sm"
          placeholder={t("sets.searchPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={t("sets.searchPlaceholder")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Category quick filters */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={category === opt.value}
              onClick={() => onCategoryChange(opt.value)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors",
                category === opt.value
                  ? "bg-white/[0.10] text-white"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {t(opt.tKey)}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-[11px] gap-1.5">
              {t("sets.sortLabel")}
              <span className="font-normal text-slate-400">
                {t(activeSortLabel)}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={cn(
                  "text-sm",
                  sortMode === opt.value && "text-cyan-400 font-medium",
                )}
              >
                {t(opt.tKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode toggle (Grid vs List) */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-md p-0",
              viewMode === "grid"
                ? "bg-white/[0.12] text-white"
                : "text-slate-400 hover:text-white",
            )}
            onClick={() => onViewModeChange("grid")}
            aria-label={t("sets.viewGrid")}
            title={t("sets.viewGrid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-md p-0",
              viewMode === "list"
                ? "bg-white/[0.12] text-white"
                : "text-slate-400 hover:text-white",
            )}
            onClick={() => onViewModeChange("list")}
            aria-label={t("sets.viewList")}
            title={t("sets.viewList")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}