"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, PackageCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { FulfillmentOrderDTO } from "@ga/contracts";

export default function FulfillmentSentTab() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<FulfillmentOrderDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSentOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace/fulfillment?status=sent");
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to load sent orders:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSentOrders();
  }, [loadSentOrders]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-slate-400">
        <p className="text-sm font-medium">{t("fulfillment.noSentOrders")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-emerald-400" />
            {t("fulfillment.tabSent")}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("fulfillment.summaryHeader", {
              orders: orders.length,
              copies: orders.reduce((sum, o) => sum + (o.printings?.length || 0), 0),
            })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const dateStr = order.mypConfirmedAt
            ? new Date(order.mypConfirmedAt).toLocaleDateString()
            : order.orderDate;

          const totalFormatted = (order.totalCents / 100).toFixed(2);

          return (
            <div
              key={order.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-100 text-sm">
                    👤 {order.buyerNick}
                  </span>
                  <a
                    href={`https://mypcards.com/pedido/${order.mypOrderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-sky-400 hover:text-sky-300"
                  >
                    #{order.mypOrderId}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("fulfillment.confirmedAt", { date: dateStr })}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">R$ {totalFormatted}</span> · {order.buyerCity} - {order.buyerStateAbbr}
                </div>
              </div>

              {/* Items Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex flex-wrap gap-2">
                  {order.printings.map((p) => (
                    <span
                      key={p.id}
                      className="rounded bg-slate-800/70 border border-slate-700/60 px-2 py-0.5 text-slate-300 font-medium"
                    >
                      {p.cardName} x{p.quantity}
                    </span>
                  ))}
                </div>
                <span className="text-slate-500 italic">
                  {order.shippingMethod}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
