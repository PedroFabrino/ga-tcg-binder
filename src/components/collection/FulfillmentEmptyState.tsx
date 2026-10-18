"use client";

import React from "react";
import { Package, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface FulfillmentEmptyStateProps {
  onOpenVendas: () => void;
  onCopyUserscript: () => void;
}

export default function FulfillmentEmptyState({
  onOpenVendas,
  onCopyUserscript,
}: FulfillmentEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
      <Package className="h-12 w-12 text-slate-500 mb-4" />
      <h3 className="text-lg font-semibold text-slate-200">
        {t("fulfillment.emptyStateTitle")}
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        {t("fulfillment.emptyStateDesc")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={onOpenVendas}
          className="gap-2"
        >
          {t("fulfillment.openMypVendasBtn")}
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={onCopyUserscript}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {t("securityModal.copyScriptBtn")}
        </Button>
      </div>
    </div>
  );
}
