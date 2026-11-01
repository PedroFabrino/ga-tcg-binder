"use client";

import React from "react";
import { Package, Copy, Trash2, Truck, Loader2, ExternalLink } from "lucide-react";
import { FulfillmentReport } from "@ga/contracts";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface FulfillmentHeaderProps {
  report: FulfillmentReport | null;
  lifecycleTab: "open" | "processed" | "sent";
  onSelectTab: (tab: "open" | "processed" | "sent") => void;
  hasShippingCapability: boolean;
  isQuotingShipping: boolean;
  onOpenShippingModal: () => void;
  onCopyText: () => void;
  onClearBatch: () => void;
  onOpenVendas: () => void;
  onCopyUserscript: () => void;
}

export default function FulfillmentHeader({
  report,
  lifecycleTab,
  onSelectTab,
  hasShippingCapability,
  isQuotingShipping,
  onOpenShippingModal,
  onCopyText,
  onClearBatch,
  onOpenVendas,
  onCopyUserscript,
}: FulfillmentHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="h-5 w-5 text-sky-400" />
            {t("fulfillment.title")}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("fulfillment.subtitle")}
          </p>
          {report && report.totalGrandArchiveOrders > 0 && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-400">
              {t("fulfillment.summaryHeader", {
                orders: report.totalGrandArchiveOrders,
                copies: report.totalGrandArchiveCopies,
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Permanent Bridge Actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenVendas}
            className="gap-1.5 text-xs border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("fulfillment.openMypVendasBtn")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyUserscript}
            className="gap-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("securityModal.copyScriptBtn")}
          </Button>

          {/* Contextual Active Batch Actions */}
          {hasShippingCapability && lifecycleTab === "open" && report && report.buyerPacks && report.buyerPacks.length > 0 && (
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
          {report && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Lifecycle Tabs (Open Orders / Processed / Sent) */}
      <div className="flex border-b border-slate-800 gap-2 pb-2">
        <button
          type="button"
          onClick={() => onSelectTab("open")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            lifecycleTab === "open"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Package className="h-4 w-4" />
          {t("fulfillment.tabOpenOrders")}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("processed")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            lifecycleTab === "processed"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {t("fulfillment.tabProcessed")}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("sent")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            lifecycleTab === "sent"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {t("fulfillment.tabSent")}
        </button>
      </div>
    </div>
  );
}
