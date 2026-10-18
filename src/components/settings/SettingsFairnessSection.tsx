"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface SettingsFairnessSectionProps {
  slightlyOverpriced: number;
  setSlightlyOverpriced: (val: number) => void;
  heavilyOverpriced: number;
  setHeavilyOverpriced: (val: number) => void;
  loading: boolean;
}

export function SettingsFairnessSection({
  slightlyOverpriced,
  setSlightlyOverpriced,
  heavilyOverpriced,
  setHeavilyOverpriced,
  loading,
}: SettingsFairnessSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-purple-400" />
        <h4 className="text-sm font-semibold text-white">{t("settings.overpricedTitle")}</h4>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {t("settings.overpricedDesc")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              {t("settings.slightlyOverpricedLabel")}
            </label>
            <span className="font-mono text-xs font-bold text-amber-400">
              {slightlyOverpriced.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="1.1"
            max="2.5"
            step="0.1"
            value={slightlyOverpriced}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSlightlyOverpriced(val);
              if (val > heavilyOverpriced) setHeavilyOverpriced(val);
            }}
            disabled={loading}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <p className="text-[10px] text-slate-500 mt-1">{t("settings.slightlyOverpricedHelp")}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              {t("settings.heavilyOverpricedLabel")}
            </label>
            <span className="font-mono text-xs font-bold text-rose-400">
              {heavilyOverpriced.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="1.5"
            max="5.0"
            step="0.1"
            value={heavilyOverpriced}
            onChange={(e) => {
              const val = Number(e.target.value);
              setHeavilyOverpriced(val);
              if (val < slightlyOverpriced) setSlightlyOverpriced(val);
            }}
            disabled={loading}
            className="w-full accent-rose-400 cursor-pointer"
          />
          <p className="text-[10px] text-slate-500 mt-1">{t("settings.heavilyOverpricedHelp")}</p>
        </div>
      </div>
    </div>
  );
}
