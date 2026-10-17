"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Package, Copy, Trash2, ExternalLink, AlertTriangle, ListChecks, Users } from "lucide-react";
import { FulfillmentReport } from "@ga/contracts";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { formatFulfillmentTextReport } from "@/scripts/fulfillment-helpers";
import FulfillmentPickList from "./FulfillmentPickList";
import FulfillmentBuyerPacks from "./FulfillmentBuyerPacks";

interface FulfillmentViewProps {
  mypUsername?: string | null;
}

export default function FulfillmentView({ mypUsername }: FulfillmentViewProps = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [report, setReport] = useState<FulfillmentReport | null>(null);
  const [activeTab, setActiveTab] = useState<"pick" | "buyer">("pick");

  const cleanUser = mypUsername?.trim();
  const vendasUrl = cleanUser
    ? `https://mypcards.com/${encodeURIComponent(cleanUser)}/vendas`
    : "https://mypcards.com/Fabrino/vendas";

  const loadBatch = useCallback(() => {
    // 1. Check URL hash
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const prefix = "#ga_fulfillment=";
      if (hash.startsWith(prefix)) {
        try {
          const jsonStr = decodeURIComponent(hash.slice(prefix.length));
          const parsed: FulfillmentReport = JSON.parse(jsonStr);
          setReport(parsed);
          localStorage.setItem("ga_fulfillment_batch", JSON.stringify(parsed));
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
          return;
        } catch (e) {
          console.error("Failed to parse fulfillment hash payload:", e);
        }
      }

      // 2. Check localStorage
      const cached = localStorage.getItem("ga_fulfillment_batch");
      if (cached) {
        try {
          const parsed: FulfillmentReport = JSON.parse(cached);
          setReport(parsed);
          return;
        } catch (e) {
          localStorage.removeItem("ga_fulfillment_batch");
        }
      }
    }
  }, []);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  const handleCopyText = async () => {
    if (!report) return;
    const text = formatFulfillmentTextReport(report);
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("fulfillment.copiedToast"));
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  const handleClearBatch = () => {
    localStorage.removeItem("ga_fulfillment_batch");
    setReport(null);
    showToast(t("fulfillment.batchClearedToast"));
  };

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
        <Package className="h-12 w-12 text-slate-500 mb-4" />
        <h3 className="text-lg font-semibold text-slate-200">
          {t("fulfillment.emptyStateTitle")}
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          {t("fulfillment.emptyStateDesc")}
        </p>
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => window.open(vendasUrl, "_blank")}
            className="gap-2"
          >
            {t("fulfillment.openMypVendasBtn")}
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            className="gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("fulfillment.copyTextBtn")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearBatch}
            className="gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("fulfillment.clearBatchBtn")}
          </Button>
        </div>
      </div>

      {/* Non-GA Orders Banner */}
      {report.nonGrandArchiveOrders && report.nonGrandArchiveOrders.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 text-amber-200">
          <div className="flex items-center gap-2 font-semibold text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t("fulfillment.nonGaNoticeTitle", {
              count: report.nonGrandArchiveOrders.length,
            })}
          </div>
          <p className="text-xs text-amber-300/80 mt-1">
            {t("fulfillment.nonGaNoticeDesc")}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {report.nonGrandArchiveOrders.map((o) => (
              <a
                key={o.orderId}
                href={o.orderUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 text-xs text-amber-200 hover:text-amber-100 hover:border-amber-500/50"
              >
                <span>
                  #{o.orderId} ({o.buyerNick}) · {o.detectedTcg.toUpperCase()}
                </span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Mode / Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-2 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("pick")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === "pick"
              ? "bg-sky-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <ListChecks className="h-4 w-4" />
          {t("fulfillment.tabPickList")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("buyer")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === "buyer"
              ? "bg-sky-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          {t("fulfillment.tabBuyerPacks")}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "pick" ? (
        <FulfillmentPickList report={report} />
      ) : (
        <FulfillmentBuyerPacks report={report} />
      )}
    </div>
  );
}
