"use client";

import React, { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { FulfillmentReport, CANONICAL_ELEMENT_ORDER } from "@ga/contracts";
import { ElementBadge, FoilBadge } from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { useTranslation } from "@/lib/i18n";

interface FulfillmentPickListProps {
  report: FulfillmentReport;
}

export default function FulfillmentPickList({ report }: FulfillmentPickListProps) {
  const { t } = useTranslation();
  const [checkedKeys, setCheckedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const entries of Object.values(report.pickListByElement)) {
      for (const entry of entries) {
        const key = `ga_pick_${entry.itemKey}`;
        if (localStorage.getItem(key) === "1") {
          initial[entry.itemKey] = true;
        }
      }
    }
    setCheckedKeys(initial);
  }, [report]);

  const toggleCheck = (itemKey: string) => {
    const next = !checkedKeys[itemKey];
    setCheckedKeys((prev) => ({ ...prev, [itemKey]: next }));
    const key = `ga_pick_${itemKey}`;
    if (next) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  };

  return (
    <div className="space-y-6">
      {CANONICAL_ELEMENT_ORDER.map((element) => {
        const entries = report.pickListByElement[element];
        if (!entries || entries.length === 0) return null;

        const totalQty = entries.reduce((s, e) => s + e.totalQuantity, 0);

        return (
          <div
            key={element}
            className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-lg backdrop-blur-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ElementBadge element={element} />
                <span className="text-sm font-semibold text-slate-200">
                  {element}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {t("fulfillment.elementGroupCount", { count: totalQty })}
              </span>
            </div>

            <div className="grid gap-2">
              {entries.map((entry) => {
                const isChecked = Boolean(checkedKeys[entry.itemKey]);
                const colNum = entry.collectorNumber ? ` #${entry.collectorNumber}` : "";

                return (
                  <div
                    key={entry.itemKey}
                    onClick={() => toggleCheck(entry.itemKey)}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer ${
                      isChecked
                        ? "border-emerald-500/30 bg-emerald-950/20 opacity-60"
                        : "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-600 text-white"
                            : "border-slate-600 bg-slate-900/80"
                        }`}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>

                      <CardPreviewTrigger
                        name={entry.cardName}
                        element={entry.element}
                        slug={entry.cardSlug || undefined}
                        imageUrl={entry.imageUrl || undefined}
                      >
                        <span
                          className={`truncate text-sm font-medium ${
                            isChecked ? "line-through text-slate-400" : "text-slate-100"
                          }`}
                        >
                          {entry.cardName}
                        </span>
                      </CardPreviewTrigger>

                      <span className="shrink-0 text-xs text-slate-400 font-mono">
                        [{entry.setPrefix}{colNum} · {entry.condition}]
                      </span>

                      {entry.isFoil && <FoilBadge />}
                    </div>

                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-bold text-sky-400">
                        x{entry.totalQuantity}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t("fulfillment.ordersRef", {
                          refs: entry.orderReferences.map((r) => `#${r.orderId}`).join(", "),
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
