"use client";

import { Search, X } from "lucide-react";
import { ALL_ELEMENTS, ELEMENT_LABELS } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import { useTranslation } from "@/lib/i18n";
import type { SetChecklistFilterStatus, SetTargetDeck, TranslationKey } from "@ga/contracts";
import FilterChip from "./FilterChip";

interface Props {
  status: SetChecklistFilterStatus;
  onStatusChange: (status: SetChecklistFilterStatus) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedElement: string | null;
  onElementChange: (element: string | null) => void;
  selectedRarity: number | null;
  onRarityChange: (rarity: number | null) => void;
  target?: string;
  onTargetChange?: (target: string) => void;
  availableDecks?: SetTargetDeck[];
}

const STATUS_OPTIONS: { value: SetChecklistFilterStatus; key: TranslationKey }[] = [
  { value: "all", key: "sets.checklist.allCards" },
  { value: "shortages", key: "sets.checklist.shortagesOnly" },
  { value: "unowned", key: "sets.checklist.missingOnly" },
  { value: "owned", key: "sets.checklist.ownedOnly" },
];

export default function SetChecklistFilters({
  status,
  onStatusChange,
  search,
  onSearchChange,
  selectedElement,
  onElementChange,
  selectedRarity,
  onRarityChange,
  target = "all",
  onTargetChange,
  availableDecks = [],
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={t(opt.key)}
            pressed={status === opt.value}
            onClick={() => onStatusChange(opt.value)}
            variant="accent"
          />
        ))}
      </div>

      {/* Search + selects row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Search */}
        <div className="relative flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("sets.checklist.searchPlaceholder")}
            aria-label={t("sets.checklist.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="rounded-full p-0.5 text-slate-500 hover:text-white"
              aria-label={t("common.close")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Target select */}
        {onTargetChange && (
          <select
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
            aria-label={t("sets.targetLabel")}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/30 appearance-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900">
              {t("sets.targetAll")}
            </option>
            <option value="wantlist" className="bg-slate-900">
              {t("sets.targetWantlist")}
            </option>
            {availableDecks.map((d) => (
              <option key={d.id} value={d.id} className="bg-slate-900">
                {d.name}
              </option>
            ))}
          </select>
        )}

        {/* Element select */}
        <select
          value={selectedElement ?? ""}
          onChange={(e) => onElementChange(e.target.value || null)}
          aria-label={t("sets.checklist.filterElement")}
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/30 appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-900">{t("sets.checklist.allElements")}</option>
          {ALL_ELEMENTS.map((el) => (
            <option key={el} value={el} className="bg-slate-900">
              {ELEMENT_LABELS[el] ?? el}
            </option>
          ))}
        </select>

        {/* Rarity select */}
        <select
          value={selectedRarity ?? ""}
          onChange={(e) => onRarityChange(e.target.value ? Number(e.target.value) : null)}
          aria-label={t("sets.checklist.filterRarity")}
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/30 appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-900">{t("sets.checklist.allRarities")}</option>
          {RARITIES.map((r) => (
            <option key={r.id} value={r.id} className="bg-slate-900">
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
