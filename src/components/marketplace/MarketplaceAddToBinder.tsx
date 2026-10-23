"use client";

import { useState } from "react";
import { Plus, Minus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import type { GlobalMarketplaceCardItem } from "@/services/marketplace";

export interface MarketplaceAddToBinderProps {
  card: Pick<
    GlobalMarketplaceCardItem,
    "id" | "cardSlug" | "editionId" | "cardName" | "isFoil"
  >;
  onAdded?: (cardId: string, quantityAdded: number) => void;
  disabled?: boolean;
}

export default function MarketplaceAddToBinder({
  card,
  onAdded,
  disabled = false,
}: MarketplaceAddToBinderProps) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const resolveEditionId = async (): Promise<string | null> => {
    if (card.editionId) {
      return card.editionId;
    }
    if (!card.cardSlug) {
      return null;
    }
    try {
      const res = await fetch(`/api/catalog?query=${encodeURIComponent(card.cardSlug)}&limit=1`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.cards?.[0]?.editions?.[0]?.id as string | undefined) ?? null;
    } catch {
      return null;
    }
  };

  const handleAdd = async () => {
    if (loading || disabled) return;
    setLoading(true);

    try {
      const editionId = await resolveEditionId();
      if (!editionId) {
        throw new Error(t("marketplace.addToBinderError", { cardName: card.cardName }));
      }

      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
          foil: Boolean(card.isFoil),
          quantity,
        }),
      });

      if (!res.ok) {
        throw new Error(t("marketplace.addToBinderError", { cardName: card.cardName }));
      }

      showToast(
        t("marketplace.addToBinderSuccess", { quantity, cardName: card.cardName }),
        "success"
      );

      onAdded?.(card.id, quantity);
      setQuantity(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("marketplace.addToBinderError", { cardName: card.cardName });
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || disabled;

  return (
    <div className="flex items-center gap-1.5">
      {/* Quantity Stepper */}
      <div
        className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/30 h-9 p-0.5"
        role="group"
        aria-label={t("common.quantityStepperGroup", { label: card.cardName })}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-7 rounded-r-none text-slate-400 hover:text-white hover:bg-white/10"
          onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
          disabled={isBusy || quantity <= 1}
          aria-label={t("common.quantityStepperRemove", { label: card.cardName })}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-7 text-center font-mono text-xs font-semibold text-white tabular-nums">
          {quantity}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-7 rounded-l-none text-slate-400 hover:text-white hover:bg-white/10"
          onClick={() => setQuantity((prev) => prev + 1)}
          disabled={isBusy}
          aria-label={t("common.quantityStepperAdd", { label: card.cardName })}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Add to Binder Button */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleAdd}
        disabled={isBusy}
        className="h-9 gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        <span>{t("common.addToBinder")}</span>
      </Button>
    </div>
  );
}
