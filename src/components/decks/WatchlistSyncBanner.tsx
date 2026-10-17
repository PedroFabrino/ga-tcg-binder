"use client";

import { useState } from "react";
import { Shield, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { WatchlistQuotaPolicy } from "@/services/watchlist";

export interface WatchlistSummary {
  deckCount: number;
  activePolicy: WatchlistQuotaPolicy;
  watchingCount?: number;
  pendingAdds?: number;
  pendingUpdates?: number;
  pendingRemoves?: number;
  hasSavedMypCredentials?: boolean;
}

interface WatchlistSyncBannerProps {
  summary: WatchlistSummary;
  pendingAddsCount: number;
  pendingUpdatesCount: number;
  pendingRemovesCount: number;
  onPolicyChange: (policies: { hard?: boolean; shared?: boolean; staples?: boolean }) => Promise<void>;
  onTriggerSyncNow: () => Promise<void>;
  onOpenBrowserBridge: () => void;
  syncingAutomated: boolean;
}

export default function WatchlistSyncBanner({
  summary,
  pendingAddsCount,
  pendingUpdatesCount,
  pendingRemovesCount,
  onPolicyChange,
  onTriggerSyncNow,
  onOpenBrowserBridge,
  syncingAutomated,
}: WatchlistSyncBannerProps) {
  const { t } = useTranslation();
  const [policyUpdating, setPolicyUpdating] = useState(false);

  const [policyHard, setPolicyHard] = useState<boolean>(summary.activePolicy ? summary.activePolicy === "hard" : true);
  const [policyShared, setPolicyShared] = useState<boolean>(summary.activePolicy === "shared");
  const [policyStaples, setPolicyStaples] = useState<boolean>(summary.activePolicy === "staples");

  const handleToggle = async (key: "hard" | "shared" | "staples") => {
    setPolicyUpdating(true);
    let nextHard = policyHard;
    let nextShared = policyShared;
    let nextStaples = policyStaples;

    if (key === "hard") nextHard = !policyHard;
    if (key === "shared") nextShared = !policyShared;
    if (key === "staples") nextStaples = !policyStaples;

    if (!nextHard && !nextShared && !nextStaples) {
      nextHard = true; // At least one active
    }

    setPolicyHard(nextHard);
    setPolicyShared(nextShared);
    setPolicyStaples(nextStaples);

    try {
      await onPolicyChange({ hard: nextHard, shared: nextShared, staples: nextStaples });
    } finally {
      setPolicyUpdating(false);
    }
  };

  const watching = summary.watchingCount ?? 0;
  const adds = summary.pendingAdds ?? pendingAddsCount;
  const updates = summary.pendingUpdates ?? pendingUpdatesCount;
  const removes = summary.pendingRemoves ?? pendingRemovesCount;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-xs font-semibold text-slate-300">
          {t("watchlist.bannerTitle")}:
        </span>
        <div className="inline-flex rounded-xl border border-white/[0.08] bg-slate-900/60 p-1 gap-1">
          <button
            type="button"
            disabled={policyUpdating}
            onClick={() => handleToggle("hard")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              policyHard
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
            title={t("shortages.hardShortageTooltip")}
          >
            {t("watchlist.policyHardLabel")}
          </button>
          <button
            type="button"
            disabled={policyUpdating}
            onClick={() => handleToggle("shared")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              policyShared
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
            title={t("shortages.sharedShortageTooltip")}
          >
            {t("watchlist.policySharedLabel")}
          </button>
          <button
            type="button"
            disabled={policyUpdating}
            onClick={() => handleToggle("staples")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              policyStaples
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
            title={t("shortages.staplesTooltip")}
          >
            {t("watchlist.policyStaplesLabel")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
            {t("watchlist.bannerWatching", { count: watching })}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
            {t("watchlist.bannerPendingAdd", { count: adds })}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium">
            {t("watchlist.bannerPendingUpdate", { count: updates })}
          </span>
          {removes > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
              {t("watchlist.bannerPendingRemove", { count: removes })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenBrowserBridge}
            className="gap-1.5 text-xs border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-white"
          >
            <Shield className="h-3.5 w-3.5 text-blue-400" />
            {t("watchlist.browserBridgeBtn")}
          </Button>

          {summary.hasSavedMypCredentials && (
            <Button
              size="sm"
              disabled={syncingAutomated}
              onClick={onTriggerSyncNow}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 font-medium"
            >
              {syncingAutomated ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t("watchlist.syncNowBtn")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
