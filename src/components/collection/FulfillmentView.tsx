"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Package, ListChecks, Users, ExternalLink } from "lucide-react";
import { FulfillmentReport, createEmptyFulfillmentReport } from "@ga/contracts";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import {
  formatFulfillmentTextReport,
  filterReportExcludingOrders,
  buildMypVendasUrl,
} from "@/scripts/fulfillment-helpers";
import { useFulfillmentShipping } from "./useFulfillmentShipping";
import FulfillmentHeader from "./FulfillmentHeader";
import FulfillmentPickList from "./FulfillmentPickList";
import FulfillmentBuyerPacks from "./FulfillmentBuyerPacks";
import FulfillmentShippingModal from "./FulfillmentShippingModal";
import FulfillmentEmptyState from "./FulfillmentEmptyState";
import FulfillmentNonGaBanner from "./FulfillmentNonGaBanner";
import FulfillmentProcessedTab from "./FulfillmentProcessedTab";
import FulfillmentSentTab from "./FulfillmentSentTab";

export interface FulfillmentViewProps {
  mypUsername?: string | null;
  hasShippingCapability?: boolean;
  userId?: string;
  syncToken?: string;
  initialReport?: FulfillmentReport | null;
  initialHasDbEntries?: boolean;
}

export default function FulfillmentView({
  mypUsername,
  hasShippingCapability = false,
  userId: propUserId,
  syncToken: propSyncToken,
  initialReport = null,
  initialHasDbEntries = false,
}: FulfillmentViewProps = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [hasDbEntries, setHasDbEntries] = useState<boolean>(initialHasDbEntries);
  const [report, setReport] = useState<FulfillmentReport | null>(initialReport);
  const [lifecycleTab, setLifecycleTab] = useState<"open" | "processed" | "sent">("open");
  const [activeTab, setActiveTab] = useState<"pick" | "buyer">("pick");
  const [cardNotes, setCardNotes] = useState<Record<string, string>>({});

  const {
    isShippingModalOpen,
    setIsShippingModalOpen,
    quotedPacks,
    isQuotingShipping,
    handleOpenShippingModal,
    handleConfirmShippingTickets,
  } = useFulfillmentShipping({
    report,
    setReport,
    onSuccess: () => setLifecycleTab("processed"),
  });

  const sanitizeReportAgainstDb = useCallback(async (currentReport: FulfillmentReport) => {
    try {
      const res = await fetch("/api/marketplace/fulfillment");
      if (!res.ok) return currentReport;
      const dbOrders: Array<{ mypOrderId: string; status: string }> = await res.json();
      if (Array.isArray(dbOrders) && dbOrders.length > 0) {
        setHasDbEntries(true);
      }
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
      setHasDbEntries(true);
      localStorage.setItem("ga_fulfillment_batch", JSON.stringify(incoming));
      sanitizeReportAgainstDb(incoming).then((cleaned) => {
        setReport(cleaned);
      });
    },
    [sanitizeReportAgainstDb]
  );

  const loadBatch = useCallback(async () => {
    if (typeof window !== "undefined") {
      // Load persisted card commentary notes
      const rawNotes = localStorage.getItem("ga_fulfillment_notes");
      if (rawNotes) {
        try {
          setCardNotes(JSON.parse(rawNotes));
        } catch {
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
          setHasDbEntries(true);
          return;
        } catch (e) {
          console.error("Failed to parse fulfillment hash payload:", e);
        }
      }

      // 2. Check localStorage
      let cachedBatch: FulfillmentReport | null = null;
      const cached = localStorage.getItem("ga_fulfillment_batch");
      if (cached) {
        try {
          const parsed: FulfillmentReport = JSON.parse(cached);
          if (parsed && parsed.buyerPacks && parsed.buyerPacks.length > 0) {
            cachedBatch = parsed;
          }
        } catch {
          localStorage.removeItem("ga_fulfillment_batch");
        }
      }

      // 3. Check database orders
      try {
        const res = await fetch("/api/marketplace/fulfillment");
        if (res.ok) {
          const dbOrders: Array<{ mypOrderId: string; status: string }> = await res.json();
          const hasOrders = Array.isArray(dbOrders) && dbOrders.length > 0;
          setHasDbEntries(hasOrders);

          if (cachedBatch) {
            applyBatch(cachedBatch);
            return;
          }

          const hasOpen = hasOrders && dbOrders.some((o) => o.status === "open");
          if (hasOpen) {
            const dbReportRes = await fetch("/api/marketplace/fulfillment?format=report");
            if (dbReportRes.ok) {
              const dbReport: FulfillmentReport = await dbReportRes.json();
              if (dbReport && dbReport.buyerPacks && dbReport.buyerPacks.length > 0) {
                applyBatch(dbReport);
                return;
              }
            }
          }

          if (hasOrders) {
            setReport(createEmptyFulfillmentReport());
            return;
          }
        }
      } catch {
        // ignore offline / unauth
      }

      if (cachedBatch) {
        applyBatch(cachedBatch);
        setHasDbEntries(true);
      }
    }
  }, [applyBatch]);

  useEffect(() => {
    loadBatch();

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "GA_FULFILLMENT_BATCH" && event.data.report) {
        applyBatch(event.data.report);
        setHasDbEntries(true);
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
    if (hasDbEntries) {
      setReport(createEmptyFulfillmentReport());
    } else {
      setReport(null);
    }
    showToast(t("fulfillment.batchClearedToast"));
  };

  const handleOpenVendas = () => {
    const targetUrl = buildMypVendasUrl({
      mypUsername,
      userId: propUserId,
      syncToken: propSyncToken,
    });
    window.open(targetUrl, "_blank");
  };

  const activeReport = report || (hasDbEntries ? createEmptyFulfillmentReport() : null);

  if (!activeReport) {
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
        report={activeReport}
        lifecycleTab={lifecycleTab}
        onSelectTab={setLifecycleTab}
        hasShippingCapability={hasShippingCapability}
        isQuotingShipping={isQuotingShipping}
        onOpenShippingModal={handleOpenShippingModal}
        onCopyText={handleCopyText}
        onClearBatch={handleClearBatch}
      />

      {/* Non-GA Orders Banner */}
      <FulfillmentNonGaBanner orders={activeReport.nonGrandArchiveOrders || []} />

      {lifecycleTab === "open" ? (
        activeReport.buyerPacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
            <Package className="h-8 w-8 text-slate-500 mb-2" />
            <p className="text-sm font-medium">{t("fulfillment.noOpenOrders")}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenVendas}
                className="gap-2 text-xs"
              >
                {t("fulfillment.openMypVendasBtn")}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
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
                report={activeReport}
                cardNotes={cardNotes}
                onUpdateNote={handleUpdateNote}
              />
            ) : (
              <FulfillmentBuyerPacks
                report={activeReport}
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

      {hasShippingCapability && (
        <FulfillmentShippingModal
          isOpen={isShippingModalOpen}
          onClose={() => setIsShippingModalOpen(false)}
          quotedPacks={quotedPacks}
          onConfirm={handleConfirmShippingTickets}
        />
      )}
    </div>
  );
}
