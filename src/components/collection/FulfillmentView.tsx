"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Package, ListChecks, Users } from "lucide-react";
import { FulfillmentReport } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { formatFulfillmentTextReport, filterReportExcludingOrders } from "@/scripts/fulfillment-helpers";
import FulfillmentHeader from "./FulfillmentHeader";
import FulfillmentPickList from "./FulfillmentPickList";
import FulfillmentBuyerPacks from "./FulfillmentBuyerPacks";
import FulfillmentShippingModal from "./FulfillmentShippingModal";
import FulfillmentEmptyState from "./FulfillmentEmptyState";
import FulfillmentNonGaBanner from "./FulfillmentNonGaBanner";
import FulfillmentProcessedTab from "./FulfillmentProcessedTab";
import FulfillmentSentTab from "./FulfillmentSentTab";
import type { QuotedBuyerPack } from "@/services/superfrete";

interface FulfillmentViewProps {

  mypUsername?: string | null;
  userId?: string;
  syncToken?: string;
}

export default function FulfillmentView({
  mypUsername,
  userId: propUserId,
  syncToken: propSyncToken,
}: FulfillmentViewProps = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [report, setReport] = useState<FulfillmentReport | null>(null);
  const [lifecycleTab, setLifecycleTab] = useState<"open" | "processed" | "sent">("open");
  const [activeTab, setActiveTab] = useState<"pick" | "buyer">("pick");
  const [cardNotes, setCardNotes] = useState<Record<string, string>>({});
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [quotedPacks, setQuotedPacks] = useState<QuotedBuyerPack[]>([]);
  const [isQuotingShipping, setIsQuotingShipping] = useState(false);

  const sanitizeReportAgainstDb = useCallback(async (currentReport: FulfillmentReport) => {
    try {
      const res = await fetch("/api/marketplace/fulfillment");
      if (!res.ok) return currentReport;
      const dbOrders: Array<{ mypOrderId: string; status: string }> = await res.json();
      const nonOpenOrderIds = new Set(
        dbOrders
          .filter((o) => o.status !== "open")
          .map((o) => o.mypOrderId)
      );
      if (nonOpenOrderIds.size > 0) {
        const cleaned = filterReportExcludingOrders(currentReport, nonOpenOrderIds);
        localStorage.setItem("ga_fulfillment_batch", JSON.stringify(cleaned));
        return cleaned;
      }
    } catch {
      // offline or unauthenticated
    }
    return currentReport;
  }, []);

  const applyBatch = useCallback(
    (incoming: FulfillmentReport) => {
      setReport(incoming);
      localStorage.setItem("ga_fulfillment_batch", JSON.stringify(incoming));
      sanitizeReportAgainstDb(incoming).then((cleaned) => {
        setReport(cleaned);
      });
    },
    [sanitizeReportAgainstDb]
  );

  const loadBatch = useCallback(() => {
    if (typeof window !== "undefined") {
      // Load persisted card commentary notes
      const rawNotes = localStorage.getItem("ga_fulfillment_notes");
      if (rawNotes) {
        try {
          setCardNotes(JSON.parse(rawNotes));
        } catch (e) {
          localStorage.removeItem("ga_fulfillment_notes");
        }
      }

      // 1. Check URL hash
      const hash = window.location.hash || "";
      const prefix = "#ga_fulfillment=";
      if (hash.startsWith(prefix)) {
        try {
          const jsonStr = decodeURIComponent(hash.slice(prefix.length));
          const parsed: FulfillmentReport = JSON.parse(jsonStr);
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
          applyBatch(parsed);
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
          applyBatch(parsed);
          return;
        } catch (e) {
          localStorage.removeItem("ga_fulfillment_batch");
        }
      }
    }
  }, [applyBatch]);

  useEffect(() => {
    loadBatch();

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "GA_FULFILLMENT_BATCH" && event.data.report) {
        applyBatch(event.data.report);
      }
    };

    const handleHashOrStorage = () => {
      loadBatch();
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("hashchange", handleHashOrStorage);
    window.addEventListener("storage", handleHashOrStorage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("hashchange", handleHashOrStorage);
      window.removeEventListener("storage", handleHashOrStorage);
    };
  }, [loadBatch, applyBatch]);

  const handleUpdateNote = useCallback((itemKey: string, note: string) => {
    setCardNotes((prev) => {
      const next = { ...prev };
      if (note) {
        next[itemKey] = note;
      } else {
        delete next[itemKey];
      }
      localStorage.setItem("ga_fulfillment_notes", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleCopyText = async () => {
    if (!report) return;
    const text = formatFulfillmentTextReport(report, cardNotes);
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("fulfillment.copiedToast"));
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  const handleClearBatch = () => {
    localStorage.removeItem("ga_fulfillment_batch");
    localStorage.removeItem("ga_fulfillment_notes");
    setCardNotes({});
    setReport(null);
    showToast(t("fulfillment.batchClearedToast"));
  };

  const handleOpenShippingModal = async () => {
    setIsQuotingShipping(true);
    try {
      const res = await fetch("/api/marketplace/fulfillment/shipping/quote", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "SUPERFRETE_API_KEY_NOT_CONFIGURED") {
          showToast(t("fulfillment.superfreteNotConfigured"));
          return;
        }
        throw new Error(data.error || "Failed to quote shipping");
      }
      setQuotedPacks(data);
      setIsShippingModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error quoting shipping";
      showToast(msg);
    } finally {
      setIsQuotingShipping(false);
    }
  };

  const handleConfirmShippingTickets = async (
    selectedPacks: Array<{
      buyerNick: string;
      selectedServiceCode: string;
      selectedServiceName?: string;
      quotedPriceBrl?: number;
    }>
  ) => {
    try {
      const res = await fetch("/api/marketplace/fulfillment/shipping/create-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs: selectedPacks }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || t("fulfillment.generateTicketsError");
        showToast(errorMsg);
        throw new Error(errorMsg);
      }

      const confirmedBuyerNicks = new Set(selectedPacks.map((p) => p.buyerNick));
      const confirmedOrderIds = new Set<string>();
      if (report) {
        for (const bp of report.buyerPacks) {
          if (confirmedBuyerNicks.has(bp.buyerNick)) {
            for (const o of bp.orders) {
              confirmedOrderIds.add(o.orderId);
            }
          }
        }
      }

      if (report && confirmedOrderIds.size > 0) {
        const nextReport = filterReportExcludingOrders(report, confirmedOrderIds);
        setReport(nextReport);
        localStorage.setItem("ga_fulfillment_batch", JSON.stringify(nextReport));
      }

      showToast(t("fulfillment.ticketsCreatedToast", { count: data.tickets?.length || selectedPacks.length }));
      setIsShippingModalOpen(false);
      setLifecycleTab("processed");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("fulfillment.generateTicketsError");
      showToast(errorMsg);
      throw err;
    }
  };

  if (!report) {
    return (
      <FulfillmentEmptyState
        mypUsername={mypUsername}
        userId={propUserId}
        syncToken={propSyncToken}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <FulfillmentHeader
        report={report}
        lifecycleTab={lifecycleTab}
        isQuotingShipping={isQuotingShipping}
        onOpenShippingModal={handleOpenShippingModal}
        onCopyText={handleCopyText}
        onClearBatch={handleClearBatch}
      />

      {/* Non-GA Orders Banner */}
      <FulfillmentNonGaBanner orders={report.nonGrandArchiveOrders || []} />

      {/* Lifecycle Tabs (Open Orders / Processed / Sent) */}
      <div className="flex border-b border-slate-800 gap-2 pb-2">
        <button
          type="button"
          onClick={() => setLifecycleTab("open")}
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
          onClick={() => setLifecycleTab("processed")}
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
          onClick={() => setLifecycleTab("sent")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            lifecycleTab === "sent"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {t("fulfillment.tabSent")}
        </button>
      </div>

      {lifecycleTab === "open" ? (
        report.buyerPacks.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
            <p className="text-sm">{t("fulfillment.noOpenOrders")}</p>
          </div>
        ) : (
          <>
            {/* Mode / Sub-Tabs Switcher for Open Orders */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("pick")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === "pick"
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-slate-200 bg-slate-800/60"
                }`}
              >
                <ListChecks className="h-3.5 w-3.5" />
                {t("fulfillment.tabPickList")}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("buyer")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === "buyer"
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-slate-200 bg-slate-800/60"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {t("fulfillment.tabBuyerPacks")}
              </button>
            </div>

            {/* Tab Panels */}
            {activeTab === "pick" ? (
              <FulfillmentPickList
                report={report}
                cardNotes={cardNotes}
                onUpdateNote={handleUpdateNote}
              />
            ) : (
              <FulfillmentBuyerPacks
                report={report}
                cardNotes={cardNotes}
                onUpdateNote={handleUpdateNote}
              />
            )}
          </>
        )
      ) : lifecycleTab === "processed" ? (
        <FulfillmentProcessedTab />
      ) : (
        <FulfillmentSentTab />
      )}

      {/* Superfrete Shipping Validation Modal */}
      <FulfillmentShippingModal
        isOpen={isShippingModalOpen}
        onClose={() => setIsShippingModalOpen(false)}
        quotedPacks={quotedPacks}
        onConfirm={handleConfirmShippingTickets}
      />
    </div>
  );
}
