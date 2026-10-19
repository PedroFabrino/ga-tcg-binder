"use client";

import React from "react";
import { Package } from "lucide-react";
import { Input } from "../ui/input";
import { useTranslation } from "@/lib/i18n";
import type { ShippingPackagePreset } from "@/services/superfrete-helpers";

interface SettingsShippingPackageSectionProps {
  shippingPackagePreset: ShippingPackagePreset;
  onSelectPreset: (preset: ShippingPackagePreset) => void;
  shippingPackageHeight: number;
  setShippingPackageHeight: (val: number) => void;
  shippingPackageWidth: number;
  setShippingPackageWidth: (val: number) => void;
  shippingPackageLength: number;
  setShippingPackageLength: (val: number) => void;
  shippingPackageBaseWeight: number;
  setShippingPackageBaseWeight: (val: number) => void;
  shippingPackageTapeWeight: number;
  setShippingPackageTapeWeight: (val: number) => void;
  shippingCardWeight: number;
  setShippingCardWeight: (val: number) => void;
  loading: boolean;
}

const PRESET_OPTIONS: { id: ShippingPackagePreset; labelKey: "settings.presetStandardBox" | "settings.presetBubbleMailer" | "settings.presetDeckBox" | "settings.presetCustom" }[] = [
  { id: "standard-box", labelKey: "settings.presetStandardBox" },
  { id: "bubble-mailer", labelKey: "settings.presetBubbleMailer" },
  { id: "deck-box", labelKey: "settings.presetDeckBox" },
  { id: "custom", labelKey: "settings.presetCustom" },
];

export function SettingsShippingPackageSection({
  shippingPackagePreset,
  onSelectPreset,
  shippingPackageHeight,
  setShippingPackageHeight,
  shippingPackageWidth,
  setShippingPackageWidth,
  shippingPackageLength,
  setShippingPackageLength,
  shippingPackageBaseWeight,
  setShippingPackageBaseWeight,
  shippingPackageTapeWeight,
  setShippingPackageTapeWeight,
  shippingCardWeight,
  setShippingCardWeight,
  loading,
}: SettingsShippingPackageSectionProps) {
  const { t } = useTranslation();

  const handleDimensionChange = (setter: (val: number) => void, val: string) => {
    const num = parseFloat(val);
    setter(isNaN(num) ? 0 : num);
  };

  const exampleCards = 10;
  const exampleGrams = Math.round(
    shippingPackageBaseWeight + shippingPackageTapeWeight + exampleCards * shippingCardWeight
  );
  const exampleKg = (exampleGrams / 1000).toFixed(3);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-sky-400" />
        <h4 className="text-sm font-semibold text-white">{t("settings.shippingPackageTitle")}</h4>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {t("settings.shippingPackageDesc")}
      </p>

      {/* Preset Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-300">
          {t("settings.packagePresetLabel")}
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_OPTIONS.map((opt) => {
            const isSelected = shippingPackagePreset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectPreset(opt.id)}
                disabled={loading}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "border-sky-500/50 bg-sky-500/15 text-sky-200 font-medium shadow-sm"
                    : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimensions Inputs */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
          {t("settings.packageDimensionsTitle")}
        </h5>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {t("settings.packageHeightLabel")}
            </label>
            <Input
              type="number"
              min={0.1}
              step={0.5}
              value={shippingPackageHeight || ""}
              onChange={(e) => handleDimensionChange(setShippingPackageHeight, e.target.value)}
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {t("settings.packageWidthLabel")}
            </label>
            <Input
              type="number"
              min={0.1}
              step={0.5}
              value={shippingPackageWidth || ""}
              onChange={(e) => handleDimensionChange(setShippingPackageWidth, e.target.value)}
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {t("settings.packageLengthLabel")}
            </label>
            <Input
              type="number"
              min={0.1}
              step={0.5}
              value={shippingPackageLength || ""}
              onChange={(e) => handleDimensionChange(setShippingPackageLength, e.target.value)}
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Weight Formula Inputs */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
          {t("settings.packageWeightFormulaTitle")}
        </h5>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {t("settings.packageBaseWeightLabel")}
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={shippingPackageBaseWeight || ""}
              onChange={(e) => handleDimensionChange(setShippingPackageBaseWeight, e.target.value)}
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {t("settings.packageTapeWeightLabel")}
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={shippingPackageTapeWeight || ""}
              onChange={(e) => handleDimensionChange(setShippingPackageTapeWeight, e.target.value)}
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {t("settings.cardWeightLabel")}
            </label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={shippingCardWeight || ""}
              onChange={(e) => handleDimensionChange(setShippingCardWeight, e.target.value)}
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Live Formula Preview */}
      <div className="rounded-lg border border-sky-500/20 bg-sky-950/20 p-3 space-y-1">
        <div className="text-[11px] font-medium text-sky-300">
          {t("settings.weightFormulaPreviewTitle")}
        </div>
        <p className="text-xs text-slate-300 font-mono">
          {t("settings.weightFormulaFormulaText", {
            base: shippingPackageBaseWeight,
            tape: shippingPackageTapeWeight,
            cards: "N",
            card: shippingCardWeight,
          })}
        </p>
        <p className="text-[11px] text-sky-400/90 font-medium">
          {t("settings.weightFormulaExampleText", {
            grams: exampleGrams,
            kg: exampleKg,
          })}
        </p>
      </div>
    </div>
  );
}
