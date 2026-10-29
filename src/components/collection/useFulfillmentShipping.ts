"use client";

import { useState } from "react";
import { FulfillmentReport } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { filterReportExcludingOrders } from "@/scripts/fulfillment-helpers";
import type { QuotedBuyerPack } from "@/services/superfrete";

export interface UseFulfillmentShippingOptions {
  report: FulfillmentReport | null;
  setReport: React.Dispatch<React.SetStateAction<FulfillmentReport | null>>;
  onSuccess?: () => void;
}

export function useFulfillmentShipping({
  report,
  setReport,
  onSuccess,
}: UseFulfillmentShippingOptions) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [quotedPacks, setQuotedPacks] = useState<QuotedBuyerPack[]>([]);
  const [isQuotingShipping, setIsQuotingShipping] = useState(false);

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

      // Only prune orders whose tickets were ACTUALLY created in Superfrete
      const createdTickets: Array<{ buyerNick: string }> = data.tickets || [];
      const succeededBuyerNicks = new Set(createdTickets.map((t) => t.buyerNick));

      const confirmedOrderIds = new Set<string>();
      if (report) {
        for (const bp of report.buyerPacks) {
          if (succeededBuyerNicks.has(bp.buyerNick)) {
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

      if (createdTickets.length > 0) {
        showToast(t("fulfillment.ticketsCreatedToast", { count: createdTickets.length }));
      }

      // If any orders errored, show the error toast so the user knows what happened
      if (data.errors && data.errors.length > 0) {
        const errorDetails = data.errors
          .map((e: { buyerNick: string; error: string }) => `${e.buyerNick}: ${e.error}`)
          .join("\n");
        showToast(errorDetails);
      }

      setIsShippingModalOpen(false);

      // Only switch to processed tab if all succeeded without errors
      if (!data.errors || data.errors.length === 0) {
        onSuccess?.();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("fulfillment.generateTicketsError");
      showToast(errorMsg);
      throw err;
    }
  };

  return {
    isShippingModalOpen,
    setIsShippingModalOpen,
    quotedPacks,
    isQuotingShipping,
    handleOpenShippingModal,
    handleConfirmShippingTickets,
  };
}
