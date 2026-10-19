"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Truck,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { QuotedBuyerPack } from "@/services/superfrete";

interface FulfillmentShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotedPacks: QuotedBuyerPack[];
  onConfirm: (
    selectedPacks: Array<{
      buyerNick: string;
      selectedServiceCode: string;
      selectedServiceName?: string;
      quotedPriceBrl?: number;
    }>
  ) => Promise<void>;
}

export default function FulfillmentShippingModal({
  isOpen,
  onClose,
  quotedPacks,
  onConfirm,
}: FulfillmentShippingModalProps) {
  const { t } = useTranslation();

  // Map of buyerNick -> boolean (included in batch)
  const [selectedPackNicks, setSelectedPackNicks] = useState<Record<string, boolean>>({});
  // Map of buyerNick -> selectedServiceCode
  const [selectedServices, setSelectedServices] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setSubmitError(null);
    const initialSelected: Record<string, boolean> = {};
    const initialServices: Record<string, string> = {};

    for (const pack of quotedPacks) {
      // Ready packs pre-checked; unphotographed packs unchecked by default
      initialSelected[pack.buyerNick] = pack.isReadyForShipping && Boolean(pack.recommendedQuote);
      if (pack.recommendedQuote) {
        initialServices[pack.buyerNick] = String(pack.recommendedQuote.id);
      } else if (pack.quotes.length > 0) {
        initialServices[pack.buyerNick] = String(pack.quotes[0].id);
      }
    }

    setSelectedPackNicks(initialSelected);
    setSelectedServices(initialServices);
  }, [quotedPacks]);

  if (!isOpen) return null;

  const togglePackSelection = (buyerNick: string) => {
    setSubmitError(null);
    setSelectedPackNicks((prev) => ({
      ...prev,
      [buyerNick]: !prev[buyerNick],
    }));
  };

  const handleServiceChange = (buyerNick: string, serviceCode: string) => {
    setSubmitError(null);
    setSelectedServices((prev) => ({
      ...prev,
      [buyerNick]: serviceCode,
    }));
  };

  const handleConfirm = async () => {
    const packsToCreate = quotedPacks
      .filter((p) => selectedPackNicks[p.buyerNick])
      .map((p) => {
        const chosenCode = selectedServices[p.buyerNick] || String(p.recommendedQuote?.id || "31");
        const foundQuote = p.quotes.find((q) => String(q.id) === chosenCode);
        const quotedPrice = foundQuote
          ? typeof foundQuote.price === "number"
            ? foundQuote.price
            : parseFloat(String(foundQuote.price))
          : undefined;

        return {
          buyerNick: p.buyerNick,
          selectedServiceCode: chosenCode,
          selectedServiceName: foundQuote?.name,
          quotedPriceBrl: quotedPrice,
        };
      });

    if (packsToCreate.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(packsToCreate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("fulfillment.generateTicketsError");
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = quotedPacks.filter((p) => selectedPackNicks[p.buyerNick]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {t("fulfillment.shippingModalTitle")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("fulfillment.shippingModalDesc")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {quotedPacks.map((pack) => {
            const isChecked = Boolean(selectedPackNicks[pack.buyerNick]);
            const currentServiceCode = selectedServices[pack.buyerNick];
            const hasValidQuotes = pack.quotes.some((q) => !q.has_error);

            return (
              <div
                key={pack.buyerNick}
                className={`rounded-xl border p-4 transition-colors ${
                  isChecked
                    ? "border-sky-500/40 bg-slate-800/60 ring-1 ring-sky-500/20"
                    : "border-slate-800 bg-slate-900/60 opacity-80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`check-${pack.buyerNick}`}
                      checked={isChecked}
                      disabled={!hasValidQuotes || isSubmitting}
                      onChange={() => togglePackSelection(pack.buyerNick)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <label
                        htmlFor={`check-${pack.buyerNick}`}
                        className="cursor-pointer font-bold text-slate-100 text-sm hover:text-sky-300"
                      >
                        {pack.recipient.fullName} ({pack.buyerNick})
                      </label>
                      <p className="text-xs text-slate-400">
                        {pack.recipient.city} - {pack.recipient.stateAbbr} · CEP {pack.recipient.postalCode}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      {t("fulfillment.includedOrders", { count: pack.ordersCount })}
                    </span>
                    <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      {t("fulfillment.totalCardsCount", { count: pack.totalCards })}
                    </span>
                    <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      {t("fulfillment.packageWeight", {
                        grams: Math.round((pack.packageWeightKg || 0.208) * 1000),
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      {t("fulfillment.insuredValue", {
                        value: pack.insuranceValueBrl.toFixed(2),
                      })}
                    </span>
                  </div>
                </div>

                {/* Warnings / Quotes */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {pack.containsUnphotographedOrders && (
                    <div className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{t("fulfillment.unphotographedWarning")}</span>
                    </div>
                  )}

                  {!hasValidQuotes ? (
                    <div className="text-xs text-rose-400 font-medium">
                      {t("fulfillment.noValidQuotes")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 font-medium">
                        {t("fulfillment.shippingLabel", { method: "" }).trim()}:
                      </label>
                      <select
                        value={currentServiceCode}
                        disabled={!isChecked || isSubmitting}
                        onChange={(e) => handleServiceChange(pack.buyerNick, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                      >
                        {pack.quotes
                          .filter((q) => !q.has_error)
                          .map((q) => {
                            const isRec = pack.recommendedQuote?.id === q.id;
                            const priceFormatted =
                              typeof q.price === "number"
                                ? q.price.toFixed(2)
                                : Number(q.price).toFixed(2);
                            return (
                              <option key={q.id} value={String(q.id)}>
                                {q.name} - R$ {priceFormatted}
                                {q.delivery_time ? ` (${q.delivery_time}d)` : ""}
                                {isRec ? ` [${t("fulfillment.recommendedCarrier")}]` : ""}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
 
        {/* Error notification banner */}
        {submitError && (
          <div className="mx-5 mb-2 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold block">{t("fulfillment.generateTicketsErrorTitle")}:</strong>
              <p className="mt-0.5 whitespace-pre-wrap">{submitError}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 p-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-200"
          >
            {t("common.cancel")}
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0 || isSubmitting}
            className="gap-2 bg-sky-600 font-semibold text-white hover:bg-sky-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("fulfillment.generatingTicketsLoading")}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {t("fulfillment.confirmGenerateTickets", { count: selectedCount })}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
