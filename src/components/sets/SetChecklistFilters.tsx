"use client";

import { Search, X } from "lucide-react";
import { ALL_ELEMENTS, ELEMENT_LABELS } from "@/lib/elements";
import { RARITIES } from "@/lib/rarities";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { SetChecklistFilterStatus, TranslationKey } from "@ga/contracts";

interface Props {
  status: SetChecklistFilterStatus;
  onStatusChange: (status: SetChecklistFilterStatus) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedElement: string | null;
  onElementChange: (element: string | null) => void;
  selectedRarity: number | null;
  onRarityChange: (rarity: number | null) => void;
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
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              status === opt.value
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white",
            )}
          >
            {t(opt.key)}
          </button>
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