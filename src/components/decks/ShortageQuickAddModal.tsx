"use client";

import { useState } from "react";
import { Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";
import type { AggregatedShortageCard } from "@/services/shortage";

interface ShortageQuickAddModalProps {
  card: AggregatedShortageCard;
  onClose: () => void;
  onAdded: () => void;
}

export default function ShortageQuickAddModal({
  card,
  onClose,
  onAdded,
}: ShortageQuickAddModalProps) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [selectedEditionId, setSelectedEditionId] = useState(card.editions[0]?.id || "");
  const [foil, setFoil] = useState(false);
  const [quantity, setQuantity] = useState(Math.max(1, card.concurrentMissing));
  const [loading, setLoading] = useState(false);

  const selectedEdition = card.editions.find((e) => e.id === selectedEditionId) || card.editions[0];

  const handleAdd = async () => {
    if (!selectedEdition?.id) {
      showToast(t("shortages.quickAddNoEdition"), "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: selectedEdition.id,
          foil,
          quantity,
        }),
      });

      if (!res.ok) throw new Error();

      showToast(
        t("shortages.quickAddSuccess", { quantity, cardName: card.cardName }),
        "success"
      );
      onAdded();
      onClose();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t("shortages.quickAddTitle", { cardName: card.cardName })}
      subtitle={t("shortages.quickAddSubtitle", { cardName: card.cardName })}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="outline" size="sm" disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleAdd}
            size="sm"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            {loading ? t("common.loading") : t("common.confirm")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {card.editions.length > 1 && (
          <div>
            <label className="block text-slate-400 mb-1 font-medium">
              {t("shortages.quickAddEditionLabel")}
            </label>
            <select
              value={selectedEditionId}
              onChange={(e) => setSelectedEditionId(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-slate-900 px-3 py-1.5 text-white outline-none"
            >
              {card.editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.setPrefix} #{ed.collectorNumber} - {ed.setName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-slate-400 mb-1 font-medium">
            {t("shortages.quickAddQuantityLabel")}
          </label>
          <Input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full text-xs"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={foil}
            onChange={(e) => setFoil(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-slate-300">{t("shortages.quickAddFoilLabel")}</span>
        </label>
      </div>
    </Modal>
  );
}
