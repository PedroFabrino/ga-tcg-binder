"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  Truck,
  HelpCircle,
  PackageCheck,
  Send,
  Sliders,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import type { ShippingTicketDTO } from "@ga/contracts";
import { FulfillmentTicketCard } from "./FulfillmentTicketCard";

const SUPERFRETE_PANEL_URL = "https://web.superfrete.com/#/minhas-etiquetas";

export default function FulfillmentProcessedTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<ShippingTicketDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [confirmationMode, setConfirmationMode] = useState<"assisted" | "batch">("assisted");
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace/fulfillment/shipping?withOrders=true");
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load processed tickets:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSyncTracking = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/marketplace/fulfillment/shipping/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "SUPERFRETE_API_KEY_NOT_CONFIGURED") {
          showToast(t("fulfillment.superfreteNotConfigured"));
          return;
        }
        throw new Error(data.error || "Failed to sync tracking");
      }
      showToast(t("fulfillment.syncTrackingSuccessToast"));
      await loadTickets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync tracking";
      showToast(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyTracking = async (trackingCode: string) => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      showToast(t("fulfillment.copiedToast"));
    } catch (e) {
      console.error("Failed to copy tracking:", e);
    }
  };

  const handleMarkAsSent = async (orderId: string, mypOrderId: string) => {
    try {
      const res = await fetch("/api/marketplace/fulfillment/confirm-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        showToast(t("fulfillment.orderSentToast", { orderId: mypOrderId }));
        await loadTickets();
      }
    } catch (e) {
      console.error("Failed to mark order as sent:", e);
    }
  };

  const handleCancelTicket = async (ticketId: string) => {
    if (!window.confirm(t("fulfillment.cancelTicketConfirm"))) return;
    try {
      const res = await fetch(`/api/marketplace/fulfillment/shipping?ticketId=${ticketId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast(t("fulfillment.cancelTicketSuccess"));
        await loadTickets();
      }
    } catch (e) {
      console.error("Failed to cancel ticket:", e);
    }
  };

  const handleDownloadAllA5 = async () => {
    setIsPrintingAll(true);
    try {
      const res = await fetch("/api/marketplace/fulfillment/shipping/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: "A5" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "SUPERFRETE_API_KEY_NOT_CONFIGURED") {
          showToast(t("fulfillment.superfreteNotConfigured"));
          return;
        }
        if (data.error === "NO_PRINTABLE_TICKETS_FOUND") {
          showToast(t("fulfillment.noReleasedTicketsToPrint"));
          return;
        }
        throw new Error(data.error || "Failed to generate printable labels");
      }

      if (data.url) {
        const link = document.createElement("a");
        link.href = data.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.download = "etiquetas-superfrete-a5.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(t("fulfillment.printTicketsSuccessToast"));
        await loadTickets();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate printable labels";
      showToast(msg);
    } finally {
      setIsPrintingAll(false);
    }
  };

  const handleOpenMyPConfirm = (
    order: { mypOrderId: string },
    ticket: { carrier: string; trackingCode: string | null }
  ) => {
    // Spec: explicit versioned browser-safe payload: version, mode, correlationId, orderId, carrier, trackingCode
    const payload = {
      version: "1.0",
      mode: confirmationMode,
      correlationId: crypto.randomUUID(),
      orderId: order.mypOrderId,
      carrier: ticket.carrier,
      trackingCode: ticket.trackingCode || "",
      autoSubmit: confirmationMode === "batch",
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    const url = `https://mypcards.com/pedido/confirmar-envio?id=${order.mypOrderId}#ga_confirm=${encoded}`;
    window.open(url, "_blank");
  };

  const handleBatchConfirm = async () => {
    // Spec: Batch Auto-Submit Mode operates only on Processed orders with a released or posted ticket and a non-empty tracking code
    const eligibleOrders = tickets
      .filter((t) => (t.status === "released" || t.status === "posted") && t.trackingCode)
      .flatMap((t) => (t.orders || []).map((o) => ({ order: o, ticket: t })));

    if (eligibleOrders.length === 0) return;

    setIsBatchSubmitting(true);
    try {
      if (eligibleOrders.length > 1) {
        // Modern browsers block opening multiple tabs from a single click event.
        // Open the first order and inform the user to use the dedicated per-order buttons.
        handleOpenMyPConfirm(eligibleOrders[0].order, eligibleOrders[0].ticket);
        showToast(t("fulfillment.batchPopupBlockerNotice"));
      } else {
        handleOpenMyPConfirm(eligibleOrders[0].order, eligibleOrders[0].ticket);
      }
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  const totalEligibleToConfirm = tickets
    .filter((t) => (t.status === "released" || t.status === "posted") && t.trackingCode)
    .reduce((sum, t) => sum + (t.orders ? t.orders.length : 0), 0);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
            <Clock className="h-3 w-3" /> {t("fulfillment.ticketStatusPending")}
          </span>
        );
      case "released":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            <CheckCircle className="h-3 w-3" /> {t("fulfillment.ticketStatusReleased")}
          </span>
        );
      case "posted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
            <Truck className="h-3 w-3" /> {t("fulfillment.ticketStatusPosted")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 border border-slate-600 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            <HelpCircle className="h-3 w-3" /> {t("fulfillment.ticketStatusUnknown")}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-emerald-400" />
            {t("fulfillment.tabProcessed")}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("fulfillment.summaryHeader", {
              orders: tickets.reduce((sum, t) => sum + (t.orders?.length || 0), 0),
              copies: tickets.length,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Selector */}
          <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setConfirmationMode("assisted")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                confirmationMode === "assisted"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t("fulfillment.assistedMode")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmationMode("batch")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                confirmationMode === "batch"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t("fulfillment.batchAutoMode")}
            </button>
          </div>

          <a
            href={SUPERFRETE_PANEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            {t("fulfillment.openSuperfretePanel")}
          </a>

          <Button
            size="sm"
            onClick={handleSyncTracking}
            disabled={isSyncing}
            className="gap-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? t("fulfillment.syncingTrackingLoading") : t("fulfillment.syncTrackingBtn")}
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadAllA5}
            disabled={isPrintingAll || tickets.length === 0}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            title={t("fulfillment.downloadAllA5Btn")}
          >
            <Printer className={`h-3.5 w-3.5 ${isPrintingAll ? "animate-spin" : ""}`} />
            {isPrintingAll ? t("fulfillment.downloadingA5Loading") : t("fulfillment.downloadAllA5Btn")}
          </Button>

          {totalEligibleToConfirm > 0 && (
            <Button
              size="sm"
              onClick={handleBatchConfirm}
              disabled={isBatchSubmitting}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              {t("fulfillment.batchConfirmBtn", { count: totalEligibleToConfirm })}
            </Button>
          )}
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-slate-400">
          <p className="text-sm font-medium">{t("fulfillment.noProcessedOrders")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <FulfillmentTicketCard
              key={ticket.id}
              ticket={ticket}
              t={t}
              onCopyTracking={handleCopyTracking}
              onOpenMyPConfirm={handleOpenMyPConfirm}
              onMarkAsSent={handleMarkAsSent}
              onCancelTicket={handleCancelTicket}
              renderStatusBadge={renderStatusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
