"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  RefreshCw,
  Printer,
  Copy,
  Clock,
  CheckCircle,
  Truck,
  HelpCircle,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import type { ShippingTicketWithOrders } from "@/db/repositories/fulfillment-repository";

const SUPERFRETE_PANEL_URL = "https://web.superfrete.com/#/minhas-etiquetas";

export default function FulfillmentProcessedTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<ShippingTicketWithOrders[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const renderStatusBadge = (status: string) => {
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
          <Clock className="h-3 w-3" />
          {t("fulfillment.ticketStatusPending")}
        </span>
      );
    }
    if (status === "released") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          <CheckCircle className="h-3 w-3" />
          {t("fulfillment.ticketStatusReleased")}
        </span>
      );
    }
    if (status === "posted") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
          <Truck className="h-3 w-3" />
          {t("fulfillment.ticketStatusPosted")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 border border-slate-600 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
        <HelpCircle className="h-3 w-3" />
        {t("fulfillment.ticketStatusUnknown")}
      </span>
    );
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
          {tickets.map((ticket) => {
            const priceBrl = ticket.quotedPriceCents
              ? (ticket.quotedPriceCents / 100).toFixed(2)
              : null;
            const insuranceBrl = (ticket.insuranceValueCents / 100).toFixed(2);

            return (
              <div
                key={ticket.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm space-y-4"
              >
                {/* Header line */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-100 text-base">
                      👤 {ticket.buyerNick}
                    </span>
                    {renderStatusBadge(ticket.status)}
                    <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300 uppercase">
                      {ticket.carrier} · {ticket.serviceName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {priceBrl && (
                      <span className="font-semibold text-slate-200">
                        R$ {priceBrl}
                      </span>
                    )}
                    <span>
                      {t("fulfillment.insuredValue", { value: insuranceBrl })}
                    </span>
                  </div>
                </div>

                {/* Tracking & Print Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {ticket.trackingCode ? (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-mono text-sky-300">
                        <span>{ticket.trackingCode}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyTracking(ticket.trackingCode!)}
                          className="text-slate-400 hover:text-slate-200"
                          title="Copiar rastreio"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        {ticket.status === "pending"
                          ? t("fulfillment.ticketStatusPending")
                          : t("fulfillment.awaitingTracking")}
                      </span>
                    )}

                    {ticket.printUrl && (
                      <a
                        href={ticket.printUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {t("fulfillment.printLabelBtn")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Linked orders count */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {t("fulfillment.includedOrders", { count: ticket.orders?.length || 0 })}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ticket.orders?.map((o) => (
                        <a
                          key={o.id}
                          href={`https://mypcards.com/pedido/${o.mypOrderId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-sky-400 hover:text-sky-300"
                        >
                          #{o.mypOrderId}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
