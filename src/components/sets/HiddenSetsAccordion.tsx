"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { FeaturedSetSummary } from "@ga/contracts";

export default function HiddenSetsAccordion({
  groups,
  onToggleHide,
}: {
  groups: FeaturedSetSummary[];
  onToggleHide: (groupUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/[0.03] list-none">
        <span className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-slate-500" />
          {t("sets.hiddenSetsTitle")}
        </span>
        <span className="text-xs text-slate-500">
          {t("sets.hiddenCount", { count: groups.length })}
        </span>
      </summary>

      {groups.length > 0 && (
        <ul className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
          {groups.map((group) => (
            <li
              key={group.groupUuid}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-300">
                  {group.groupName}
                </p>
                <p className="text-[11px] text-slate-600">
                  {t("sets.decksImpacted", { count: group.impactedDecks })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] gap-1.5 shrink-0"
                onClick={() => onToggleHide(group.groupUuid)}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("sets.unhideSet")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}