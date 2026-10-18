"use client";

import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { NonGrandArchiveOrderNotice } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";

interface FulfillmentNonGaBannerProps {
  orders: NonGrandArchiveOrderNotice[];
}

export default function FulfillmentNonGaBanner({ orders }: FulfillmentNonGaBannerProps) {
  const { t } = useTranslation();

  if (!orders || orders.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 text-amber-200">
      <div className="flex items-center gap-2 font-semibold text-sm text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {t("fulfillment.nonGaNoticeTitle", {
          count: orders.length,
        })}
      </div>
      <p className="text-xs text-amber-300/80 mt-1">
        {t("fulfillment.nonGaNoticeDesc")}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {orders.map((o) => (
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
  );
}
