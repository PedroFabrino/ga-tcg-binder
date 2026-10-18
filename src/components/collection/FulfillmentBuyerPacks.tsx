"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, Check, Camera, MessageSquare } from "lucide-react";
import { FulfillmentReport } from "@ga/contracts";
import { ElementBadge, FoilBadge, CardArt } from "@/components/common";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";

interface FulfillmentBuyerPacksProps {
  report: FulfillmentReport;
  cardNotes?: Record<string, string>;
  onUpdateNote?: (itemKey: string, note: string) => void;
}

export default function FulfillmentBuyerPacks({
  report,
  cardNotes = {},
  onUpdateNote,
}: FulfillmentBuyerPacksProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [completedOrders, setCompletedOrders] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ordersMap: Record<string, boolean> = {};
    const itemsMap: Record<string, boolean> = {};

    for (const buyer of report.buyerPacks) {
      for (const order of buyer.orders) {
        if (localStorage.getItem(`ga_order_photo_${order.orderId}`) === "1") {
          ordersMap[order.orderId] = true;
        }
        for (const item of order.items) {
          const key = `ga_item_${order.orderId}_${item.itemKey}`;
          if (localStorage.getItem(key) === "1") {
            itemsMap[`${order.orderId}_${item.itemKey}`] = true;
          }
        }
      }
    }

    setCompletedOrders(ordersMap);
    setCheckedItems(itemsMap);
  }, [report]);

  const toggleOrderPhoto = (orderId: string) => {
    const next = !completedOrders[orderId];
    setCompletedOrders((prev) => ({ ...prev, [orderId]: next }));
    const key = `ga_order_photo_${orderId}`;
    if (next) {
      localStorage.setItem(key, "1");
      showToast(t("fulfillment.orderPhotoDoneToast", { orderId }));
    } else {
      localStorage.removeItem(key);
    }
  };

  const toggleItemCheck = (orderId: string, itemKey: string) => {
    const compositeKey = `${orderId}_${itemKey}`;
    const next = !checkedItems[compositeKey];
    setCheckedItems((prev) => ({ ...prev, [compositeKey]: next }));
    const key = `ga_item_${orderId}_${itemKey}`;
    if (next) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  };

  return (
    <div className="space-y-6">
      {report.buyerPacks.map((buyer) => {
        const isMulti = buyer.totalOrders > 1;

        return (
          <div
            key={buyer.buyerNick}
            className={`rounded-xl border p-5 shadow-lg backdrop-blur-sm transition-all ${
              isMulti
                ? "border-amber-500/40 bg-slate-900/80 ring-1 ring-amber-500/20"
                : "border-slate-700/60 bg-slate-900/60"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between border-b border-slate-700/60 pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-100">
                  👤 {buyer.buyerNick}
                </span>
                {isMulti && (
                  <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-0.5 text-xs font-bold text-red-400">
                    {t("fulfillment.shipCombinedBadge", { count: buyer.totalOrders })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {t("fulfillment.shippingLabel", {
                    method: buyer.primaryShippingMethod || t("fulfillment.shippingDefault"),
                  })}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {buyer.orders.map((subOrder) => {
                const isPhotoDone = Boolean(completedOrders[subOrder.orderId]);

                return (
                  <div
                    key={subOrder.orderId}
                    className={`rounded-lg border p-4 transition-colors ${
                      isPhotoDone
                        ? "border-emerald-500/30 bg-emerald-950/10"
                        : "border-slate-800 bg-slate-800/30"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-700/40 pb-2 mb-3 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-sky-400 font-mono">
                          #{subOrder.orderId}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({subOrder.shippingMethod})
                        </span>
                        <a
                          href={subOrder.orderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 underline"
                        >
                          {t("fulfillment.openOrderLink", { orderId: subOrder.orderId })}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleOrderPhoto(subOrder.orderId)}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                          isPhotoDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                        }`}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {t("fulfillment.orderCompletedLabel")}
                      </button>
                    </div>

                    <div className="grid gap-2">
                      {subOrder.items.map((item) => {
                        const compositeKey = `${subOrder.orderId}_${item.itemKey}`;
                        const isChecked = Boolean(checkedItems[compositeKey]);
                        const colNum = item.collectorNumber ? ` #${item.collectorNumber}` : "";
                        const noteValue = cardNotes[item.itemKey] || "";

                        return (
                          <div
                            key={compositeKey}
                            onClick={() => toggleItemCheck(subOrder.orderId, item.itemKey)}
                            className={`rounded border p-2.5 transition-colors cursor-pointer ${
                              isChecked
                                ? "border-emerald-500/30 bg-emerald-950/20 opacity-60"
                                : "border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    isChecked
                                      ? "border-emerald-500 bg-emerald-600 text-white"
                                      : "border-slate-600 bg-slate-900"
                                  }`}
                                >
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>

                                <ElementBadge element={item.element} />

                                <CardPreviewTrigger
                                  name={item.cardName}
                                  element={item.element}
                                  slug={item.cardSlug || undefined}
                                  imageUrl={item.imageUrl || undefined}
                                  className="flex items-center gap-2.5 min-w-0"
                                >
                                  <CardArt
                                    src={item.imageUrl}
                                    alt={item.cardName}
                                    className="h-11 w-8 shrink-0 rounded border border-slate-700/80 object-cover shadow-sm"
                                  />
                                  <span
                                    className={`truncate text-xs font-medium ${
                                      isChecked ? "line-through text-slate-400" : "text-slate-200"
                                    }`}
                                  >
                                    {item.cardName}
                                  </span>
                                </CardPreviewTrigger>

                                <span className="shrink-0 text-[11px] text-slate-400 font-mono">
                                  [{item.setPrefix}{colNum} · {item.condition}]
                                </span>

                                {item.isFoil && <FoilBadge />}
                              </div>

                              <span className="shrink-0 ml-3 text-xs font-bold text-sky-400">
                                x{item.quantity}
                              </span>
                            </div>

                            <div
                              className="mt-2 flex items-center gap-2 border-t border-slate-800/60 pt-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageSquare
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  noteValue ? "text-amber-400" : "text-slate-500"
                                }`}
                              />
                              <input
                                type="text"
                                value={noteValue}
                                onChange={(e) => onUpdateNote?.(item.itemKey, e.target.value)}
                                placeholder={t("fulfillment.cardNotePlaceholder")}
                                aria-label={t("fulfillment.cardNotePlaceholder")}
                                className={`w-full rounded border px-2 py-1 text-xs transition-colors focus:outline-none ${
                                  noteValue
                                    ? "border-amber-500/40 bg-amber-950/20 text-amber-200 placeholder:text-amber-400/50 focus:border-amber-400"
                                    : "border-slate-800 bg-slate-900/60 text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
