"use client";

import React from "react";
import { Package, Copy, Trash2, Truck, Loader2 } from "lucide-react";
import { FulfillmentReport } from "@ga/contracts";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface FulfillmentHeaderProps {
  report: FulfillmentReport;
  lifecycleTab: "open" | "processed" | "sent";
  isQuotingShipping: boolean;
  onOpenShippingModal: () => void;
  onCopyText: () => void;
  onClearBatch: () => void;
}

export default function FulfillmentHeader({
  report,
  lifecycleTab,
  isQuotingShipping,
  onOpenShippingModal,
  onCopyText,
  onClearBatch,
}: FulfillmentHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Package className="h-5 w-5 text-sky-400" />
          {t("fulfillment.title")}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {t("fulfillment.subtitle")}
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-400">
          {t("fulfillment.summaryHeader", {
            orders: report.totalGrandArchiveOrders,
            copies: report.totalGrandArchiveCopies,
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lifecycleTab === "open" && (
          <Button
            size="sm"
            onClick={onOpenShippingModal}
            disabled={isQuotingShipping}
            className="gap-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          >
            {isQuotingShipping ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("fulfillment.generateShippingLoading")}
              </>
            ) : (
              <>
                <Truck className="h-3.5 w-3.5" />
                {t("fulfillment.generateShippingBtn")}
              </>
            )}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyText}
          className="gap-1.5 text-xs"
        >
          <Copy className="h-3.5 w-3.5" />
          {t("fulfillment.copyTextBtn")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearBatch}
          className="gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("fulfillment.clearBatchBtn")}
        </Button>
      </div>
    </div>
  );
}
