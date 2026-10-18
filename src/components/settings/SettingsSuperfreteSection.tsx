"use client";

import React from "react";
import { Truck, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useTranslation } from "@/lib/i18n";

interface SettingsSuperfreteSectionProps {
  hasSavedSuperfreteApiKey: boolean;
  superfreteApiKey: string;
  setSuperfreteApiKey: (val: string) => void;
  loading: boolean;
  clearingSuperfrete: boolean;
  onClearSuperfrete: () => void;
}

export function SettingsSuperfreteSection({
  hasSavedSuperfreteApiKey,
  superfreteApiKey,
  setSuperfreteApiKey,
  loading,
  clearingSuperfrete,
  onClearSuperfrete,
}: SettingsSuperfreteSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-white">{t("settings.superfreteTitle")}</h4>
        </div>
        {hasSavedSuperfreteApiKey ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="h-3 w-3" /> {t("settings.superfreteConfigured")}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-mono">{t("settings.tokenMasked")}</span>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {t("settings.superfreteDesc")}
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t("settings.superfreteApiKeyLabel")}
          </label>
          <Input
            type="password"
            placeholder={hasSavedSuperfreteApiKey ? "••••••••••••••••••••••••" : t("settings.superfreteApiKeyPlaceholder")}
            value={superfreteApiKey}
            onChange={(e) => setSuperfreteApiKey(e.target.value)}
            disabled={loading}
            autoComplete="off"
            className="text-xs font-mono"
          />
          {hasSavedSuperfreteApiKey && (
            <p className="text-[11px] text-emerald-400/90 mt-1">{t("settings.superfreteConfiguredDesc")}</p>
          )}
        </div>

        {hasSavedSuperfreteApiKey && (
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={onClearSuperfrete}
              disabled={clearingSuperfrete}
              variant="outline"
              size="sm"
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 text-xs gap-1.5"
            >
              {clearingSuperfrete ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {t("settings.clearSuperfreteBtn")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
