"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, ExternalLink, Code, ChevronDown, ChevronRight } from "lucide-react";
import { Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export interface WatchlistSecurityItem {
  id: string;
  cardName: string;
  setPrefix?: string;
  editionSlug?: string;
  collectorNumber?: string;
  targetQuantity?: number;
  targetPriceBrl?: number;
  mypItemId?: string | null;
}

interface WatchlistSecurityModalProps {
  onClose: () => void;
  userId: string;
  syncToken?: string | null;
  pendingAdds: WatchlistSecurityItem[];
  pendingUpdates: WatchlistSecurityItem[];
  pendingRemoves: WatchlistSecurityItem[];
}

export default function WatchlistSecurityModal({
  onClose,
  userId,
  syncToken,
  pendingAdds,
  pendingUpdates,
  pendingRemoves,
}: WatchlistSecurityModalProps) {
  const { t } = useTranslation();
  const [showCode, setShowCode] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [scriptSource, setScriptSource] = useState<string>("");
  const [loadingScript, setLoadingScript] = useState(false);

  const scriptGithubUrl =
    "https://github.com/PedroFabrino/ga-tcg-binder/blob/main/public/scripts/myp-watchlist-sync.user.js";

  useEffect(() => {
    if (showCode && !scriptSource) {
      setLoadingScript(true);
      fetch("/scripts/myp-watchlist-sync.user.js")
        .then((res) => res.text())
        .then((text) => setScriptSource(text))
        .catch(() => setScriptSource("// Failed to load local script preview. Please review on GitHub."))
        .finally(() => setLoadingScript(false));
    }
  }, [showCode, scriptSource]);

  const handleLaunchSync = () => {
    if (!consentGiven) return;

    const payload = {
      appUrl: window.location.origin,
      userId,
      syncToken: syncToken || undefined,
      pendingAdds: pendingAdds.map((item) => ({
        id: item.id,
        cardName: item.cardName,
        editionSlug: item.setPrefix || item.editionSlug || "",
        collectorNumber: item.collectorNumber || "",
        targetQuantity: item.targetQuantity || 1,
        targetPriceBrl: item.targetPriceBrl || 1.0,
        mypItemId: item.mypItemId || null,
      })),
      pendingUpdates: pendingUpdates.map((item) => ({
        id: item.id,
        cardName: item.cardName,
        editionSlug: item.setPrefix || item.editionSlug || "",
        targetQuantity: item.targetQuantity || 1,
        mypItemId: item.mypItemId || null,
      })),
      pendingRemoves: pendingRemoves.map((item) => ({
        id: item.id,
        cardName: item.cardName,
        editionSlug: item.setPrefix || item.editionSlug || "",
        mypItemId: item.mypItemId || null,
      })),
    };

    const encoded = encodeURIComponent(JSON.stringify(payload));
    const targetUrl = `https://mypcards.com/grandarchive#ga_watchlist_sync=${encoded}`;

    window.open(targetUrl, "_blank");
    onClose();
  };

  const totalMutations = pendingAdds.length + pendingUpdates.length + pendingRemoves.length;

  return (
    <Modal
      title={t("securityModal.title")}
      subtitle={t("securityModal.subtitle")}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <a
            href={scriptGithubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("securityModal.viewGithubSource")}
          </a>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" size="sm">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleLaunchSync}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20"
              disabled={totalMutations === 0 || !consentGiven}
            >
              {t("watchlist.syncNowBtn")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-slate-300 text-sm">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-emerald-300 text-sm">{t("settings.savedCredentialsActive")}</p>
            <p className="text-slate-300 leading-relaxed">
              {t("settings.mypCredentialsDesc")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("securityModal.installationSteps")} ({totalMutations})
          </h4>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <span className="block text-emerald-400 font-bold text-base">+{pendingAdds.length}</span>
              <span className="text-[11px] text-slate-400">{t("watchlist.statusPendingAdd")}</span>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
              <span className="block text-amber-400 font-bold text-base">~{pendingUpdates.length}</span>
              <span className="text-[11px] text-slate-400">{t("watchlist.statusPendingUpdate")}</span>
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
              <span className="block text-rose-400 font-bold text-base">-{pendingRemoves.length}</span>
              <span className="text-[11px] text-slate-400">{t("watchlist.statusPendingRemove")}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="w-full flex items-center justify-between p-3 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Code className="h-4 w-4 text-blue-400" />
              {t("securityModal.title")}
            </span>
            {showCode ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showCode && (
            <div className="p-3 border-t border-white/[0.06] bg-slate-950 font-mono text-[11px] text-slate-400 leading-relaxed max-h-56 overflow-y-auto whitespace-pre">
              {loadingScript ? t("common.loading") : scriptSource}
            </div>
          )}
        </div>

        <label className="flex items-start gap-2.5 p-2 rounded-lg border border-white/[0.06] bg-slate-900/40 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-300 leading-snug">
            {t("securityModal.consentCheckbox")}
          </span>
        </label>
      </div>
    </Modal>
  );
}
