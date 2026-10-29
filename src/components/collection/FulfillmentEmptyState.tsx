"use client";

import React, { useState, useEffect } from "react";
import { Package, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";
import { buildMypVendasUrl } from "@/scripts/fulfillment-helpers";

interface FulfillmentEmptyStateProps {
  mypUsername?: string | null;
  userId?: string | null;
  syncToken?: string | null;
}

export default function FulfillmentEmptyState({
  mypUsername,
  userId: propUserId,
  syncToken: propSyncToken,
}: FulfillmentEmptyStateProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(propUserId || null);
  const [resolvedSyncToken, setResolvedSyncToken] = useState<string | null>(propSyncToken || null);

  useEffect(() => {
    if (propUserId && !resolvedUserId) setResolvedUserId(propUserId);
    if (propSyncToken && !resolvedSyncToken) setResolvedSyncToken(propSyncToken);

    if (!resolvedSyncToken || !resolvedUserId) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data?.user?.id && !resolvedUserId) setResolvedUserId(data.user.id);
          if (data?.user?.watchlistSyncToken && !resolvedSyncToken) setResolvedSyncToken(data.user.watchlistSyncToken);
        })
        .catch(() => {});
    }
  }, [resolvedSyncToken, resolvedUserId, propUserId, propSyncToken]);

  const handleOpenVendas = () => {
    const targetUrl = buildMypVendasUrl({
      mypUsername,
      userId: resolvedUserId,
      syncToken: resolvedSyncToken,
    });
    window.open(targetUrl, "_blank");
  };

  const handleCopyUserscript = async () => {
    try {
      const res = await fetch("/scripts/myp-watchlist-sync.user.js");
      const code = await res.text();
      await navigator.clipboard.writeText(code);
      showToast(t("securityModal.copiedToast"));
    } catch (e) {
      console.error("Failed to copy userscript:", e);
    }
  };

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
          onClick={handleOpenVendas}
          className="gap-2"
        >
          {t("fulfillment.openMypVendasBtn")}
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={handleCopyUserscript}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {t("securityModal.copyScriptBtn")}
        </Button>
      </div>
    </div>
  );
}
