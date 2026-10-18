"use client";

import React from "react";
import { Flame, Copy, Check } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useTranslation } from "@/lib/i18n";

const MIN = 100;
const MAX = 5000;
const STEP = 50;

interface SettingsPlaygroupSectionProps {
  friendCode: string;
  copied: boolean;
  onCopyFriendCode: () => void;
  threshold: number;
  setThreshold: (val: number) => void;
  loading: boolean;
}

export function SettingsPlaygroupSection({
  friendCode,
  copied,
  onCopyFriendCode,
  threshold,
  setThreshold,
  loading,
}: SettingsPlaygroupSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Playgroup Friend Code */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("settings.friendCodeLabel")}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{t("settings.networkLabel")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            readOnly
            value={friendCode || (loading ? t("common.loading") : "GA-000000")}
            className="font-mono text-sm tracking-wider bg-black/40 border-white/[0.08] select-all"
          />
          <Button
            type="button"
            onClick={onCopyFriendCode}
            disabled={!friendCode || loading}
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
        </div>
      </div>

      {/* Low Pop Threshold */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <label htmlFor="lowpop-slider" className="text-sm font-semibold text-white">
              {t("settings.lowPopThreshold")}
            </label>
          </div>
          <span className="font-mono text-sm font-bold text-amber-400">
            ≤ {threshold.toLocaleString()}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {t("settings.lowPopHelp")}
        </p>

        <input
          id="lowpop-slider"
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          disabled={loading}
          className="w-full accent-amber-400 cursor-pointer"
        />

        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>{MIN.toLocaleString()}</span>
          <span>1,000</span>
          <span>{MAX.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
