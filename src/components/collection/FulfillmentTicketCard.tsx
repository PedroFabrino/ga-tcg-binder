"use client";

import React from "react";
import { ExternalLink, Printer, Copy, Trash2, Check } from "lucide-react";
import type { ShippingTicketDTO, TranslationKey } from "@ga/contracts";

interface FulfillmentTicketCardProps {
  ticket: ShippingTicketDTO;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  onCopyTracking: (code: string) => void;
  onOpenMyPConfirm: (
    order: { mypOrderId: string },
    ticket: { carrier: string; trackingCode: string | null }
  ) => void;
  onMarkAsSent: (orderId: string, mypOrderId: string) => void;
  onCancelTicket: (ticketId: string) => void;
  renderStatusBadge: (status: string) => React.ReactNode;
}

export function FulfillmentTicketCard({
  ticket,
  t,
  onCopyTracking,
  onOpenMyPConfirm,
  onMarkAsSent,
  onCancelTicket,
  renderStatusBadge,
}: FulfillmentTicketCardProps) {
  const priceBrl = ticket.quotedPriceCents
    ? (ticket.quotedPriceCents / 100).toFixed(2)
    : null;
  const insuranceBrl = (ticket.insuranceValueCents / 100).toFixed(2);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm space-y-4">
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
                onClick={() => onCopyTracking(ticket.trackingCode!)}
                className="text-slate-400 hover:text-slate-200"
                title={t("fulfillment.copyTracking")}
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

          {(ticket.printUrl || ticket.status === "released" || ticket.status === "posted") && (
            <a
              href={ticket.printUrl || `/api/marketplace/fulfillment/shipping/print?ticketId=${ticket.id}&download=true`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40"
            >
              <Printer className="h-3.5 w-3.5" />
              {t("fulfillment.printLabelBtn")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {ticket.status === "pending" && (
            <button
              type="button"
              onClick={() => onCancelTicket(ticket.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/40"
              title={t("fulfillment.cancelTicketBtn")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("fulfillment.cancelTicketBtn")}
            </button>
          )}
        </div>
      </div>

      {/* Linked orders with prominent confirmation action buttons */}
      <div className="border-t border-slate-800/80 pt-3 space-y-2">
        <span className="text-xs text-slate-400 font-medium">
          {t("fulfillment.includedOrders", { count: ticket.orders?.length || 0 })}:
        </span>
        <div className="flex flex-wrap gap-2.5">
          {ticket.orders?.map((o) => {
            const canConfirm = Boolean(ticket.trackingCode);
            return (
              <div
                key={o.id}
                className="flex items-center gap-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 text-xs shadow-sm"
              >
                <a
                  href={`https://mypcards.com/pedido/${o.mypOrderId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-1 font-semibold"
                >
                  #{o.mypOrderId}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>

                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    onClick={() => onOpenMyPConfirm(o, ticket)}
                    disabled={!canConfirm}
                    title={canConfirm ? t("fulfillment.confirmShippingBtn") : t("fulfillment.trackingRequired")}
                    aria-label={`${t("fulfillment.confirmShippingBtn")} - #${o.mypOrderId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700/60 disabled:text-slate-500 disabled:cursor-not-allowed px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors"
                  >
                    <span>{t("fulfillment.confirmShippingBtn")}</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>

                  {ticket.trackingCode && (
                    <button
                      type="button"
                      onClick={() => onMarkAsSent(o.id, o.mypOrderId)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900/60 hover:bg-slate-700 px-2 py-1 text-slate-300 hover:text-white transition-colors"
                      title={t("fulfillment.markAsSentBtn")}
                      aria-label={`${t("fulfillment.markAsSentBtn")} - #${o.mypOrderId}`}
                    >
                      <Check className="h-3 w-3 text-emerald-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
