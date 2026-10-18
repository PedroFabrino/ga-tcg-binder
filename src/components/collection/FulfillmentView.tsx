"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Package, Copy, Trash2, ExternalLink, AlertTriangle, ListChecks, Users, Truck, Loader2 } from "lucide-react";
import { FulfillmentReport } from "@ga/contracts";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { formatFulfillmentTextReport } from "@/scripts/fulfillment-helpers";
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

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(propUserId || null);
  const [resolvedSyncToken, setResolvedSyncToken] = useState<string | null>(propSyncToken || null);

  useEffect(() => {
    if (propUserId && !resolvedUserId) setResolvedUserId(propUserId);
    if (propSyncToken && !resolvedSyncToken) setResolvedSyncToken(propSyncToken);

    if (!resolvedSyncToken || !resolvedUserId) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data?.user?.id && !resolvedUserId) setResolvedUserId(data.user.id);
          if (data?.user?.watchlistSyncToken && !resolvedSyncToken) setResolvedSyncToken(data.user.watchlistSyncToken);
        })
        .catch(() => {});
    }
  }, [resolvedSyncToken, resolvedUserId, propUserId, propSyncToken]);


  const [report, setReport] = useState<FulfillmentReport | null>(null);
  const [lifecycleTab, setLifecycleTab] = useState<"open" | "processed" | "sent">("open");
  const [activeTab, setActiveTab] = useState<"pick" | "buyer">("pick");
  const [cardNotes, setCardNotes] = useState<Record<string, string>>({});
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [quotedPacks, setQuotedPacks] = useState<QuotedBuyerPack[]>([]);
  const [isQuotingShipping, setIsQuotingShipping] = useState(false);

  const cleanUser = mypUsername?.trim();
  const baseVendasUrl = cleanUser
    ? `https://mypcards.com/${encodeURIComponent(cleanUser)}/vendas`
    : "https://mypcards.com/Fabrino/vendas";

  const handleOpenVendas = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let targetUrl = baseVendasUrl;
    if (origin) {
      if (resolvedUserId && resolvedSyncToken) {
        const bridge = {
          version: 1,
          appUrl: origin,
          userId: resolvedUserId,
          token: resolvedSyncToken,
        };
        targetUrl = `${baseVendasUrl}#ga_fulfillment_bridge=${encodeURIComponent(JSON.stringify(bridge))}`;
      } else {
        targetUrl = `${baseVendasUrl}#ga_app_url=${encodeURIComponent(origin)}`;
      }
    }
    window.open(targetUrl, "_blank");
  };


  const handleCopyUserscript = async () => {
    try {
      const res = await fetch("/scripts/myp-watchlist-sync.user.js");
      const code = await res.text();
      await navigator.clipboard.writeText(code);
      showToast(t("securityModal.copiedToast"));
    } catch (e) {
      console.error("Failed to copy userscript:", e);
    }
  };

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

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "GA_FULFILLMENT_BATCH" && event.data.report) {
        const incoming: FulfillmentReport = event.data.report;
        setReport(incoming);
        localStorage.setItem("ga_fulfillment_batch", JSON.stringify(incoming));
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
  }, [loadBatch]);

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
    const res = await fetch("/api/marketplace/fulfillment/shipping/create-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packs: selectedPacks }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create shipping tickets");
    }

    showToast(t("fulfillment.ticketsCreatedToast", { count: data.tickets?.length || selectedPacks.length }));
    setIsShippingModalOpen(false);
    setLifecycleTab("processed");
  };

  if (!report) {
    return (
      <FulfillmentEmptyState
        onOpenVendas={handleOpenVendas}
        onCopyUserscript={handleCopyUserscript}
      />
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
          {lifecycleTab === "open" && (
            <Button
              size="sm"
              onClick={handleOpenShippingModal}
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
