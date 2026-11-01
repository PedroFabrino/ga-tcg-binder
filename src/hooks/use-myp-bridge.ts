"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ToastProvider";

interface UseMypBridgeOptions {
  mypUsername?: string | null;
  userId?: string | null;
  syncToken?: string | null;
}

export function useMypBridge({
  mypUsername,
  userId: propUserId,
  syncToken: propSyncToken,
}: UseMypBridgeOptions = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(propUserId || null);
  const [resolvedSyncToken, setResolvedSyncToken] = useState<string | null>(propSyncToken || null);

  useEffect(() => {
    if (propUserId && !resolvedUserId) setResolvedUserId(propUserId);
    if (propSyncToken && !resolvedSyncToken) setResolvedSyncToken(propSyncToken);

    if (!resolvedSyncToken || !resolvedUserId) {
      let active = true;
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          if (data?.user?.id && !resolvedUserId) setResolvedUserId(data.user.id);
          if (data?.user?.watchlistSyncToken && !resolvedSyncToken) {
            setResolvedSyncToken(data.user.watchlistSyncToken);
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [resolvedSyncToken, resolvedUserId, propUserId, propSyncToken]);

  const cleanUser = mypUsername?.trim();
  const baseVendasUrl = cleanUser
    ? `https://mypcards.com/${encodeURIComponent(cleanUser)}/vendas`
    : "https://mypcards.com/Fabrino/vendas";

  const handleOpenVendas = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let targetUrl = baseVendasUrl;
    if (origin) {
      if (resolvedUserId && resolvedSyncToken) {
        const bridge = {
          version: 1,
          appUrl: origin,
          userId: resolvedUserId,
          token: resolvedSyncToken,
        };
        targetUrl = `${baseVendasUrl}#ga_fulfillment_bridge=${encodeURIComponent(JSON.stringify(bridge))}`;
      } else {
        targetUrl = `${baseVendasUrl}#ga_app_url=${encodeURIComponent(origin)}`;
      }
    }
    window.open(targetUrl, "_blank");
  }, [baseVendasUrl, resolvedUserId, resolvedSyncToken]);

  const handleCopyUserscript = useCallback(async () => {
    try {
      const res = await fetch("/scripts/myp-watchlist-sync.user.js");
      const code = await res.text();
      await navigator.clipboard.writeText(code);
      showToast(t("securityModal.copiedToast"));
    } catch (e) {
      console.error("Failed to copy userscript:", e);
    }
  }, [showToast, t]);

  return {
    handleOpenVendas,
    handleCopyUserscript,
    resolvedUserId,
    resolvedSyncToken,
  };
}
