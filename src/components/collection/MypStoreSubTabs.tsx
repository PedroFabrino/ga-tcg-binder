"use client";

import React, { useEffect } from "react";
import { Store, Package } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export type MypSubView = "listings" | "fulfillment";

interface MypStoreSubTabsProps {
  currentView: MypSubView;
  onViewChange: (view: MypSubView) => void;
}

/**
 * Dedicated sub-view navigation tabs for Personal MyP Store:
 * Switches between public Store Listings and Order Fulfillment batch processing.
 */
export default function MypStoreSubTabs({
  currentView,
  onViewChange,
}: MypStoreSubTabsProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const isFulfillment =
        searchParams.get("fulfillment") === "1" ||
        window.location.hash.startsWith("#ga_fulfillment=");
      if (isFulfillment) {
        onViewChange("fulfillment");
      }
    }
  }, [onViewChange]);

  return (
    <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 mb-6">
      <button
        type="button"
        onClick={() => onViewChange("listings")}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
          currentView === "listings"
            ? "border border-white/20 bg-white/10 text-white shadow-sm"
            : "border border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white"
        }`}
      >
        <Store className="h-4 w-4" />
        {t("fulfillment.tabListings")}
      </button>

      <button
        type="button"
        onClick={() => onViewChange("fulfillment")}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
          currentView === "fulfillment"
            ? "border border-sky-400/40 bg-sky-500/20 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
            : "border border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white"
        }`}
      >
        <Package className="h-4 w-4 text-sky-400" />
        {t("fulfillment.tabFulfillment")}
      </button>
    </div>
  );
}
