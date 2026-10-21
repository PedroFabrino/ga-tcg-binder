"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSettingsManager } from "@/components/settings/useSettingsManager";
import { SettingsSuperfreteSection } from "@/components/settings/SettingsSuperfreteSection";
import { SettingsShippingPackageSection } from "@/components/settings/SettingsShippingPackageSection";
import { SettingsFairnessSection } from "@/components/settings/SettingsFairnessSection";
import { SettingsMypSection } from "@/components/settings/SettingsMypSection";
import { SettingsPlaygroupSection } from "@/components/settings/SettingsPlaygroupSection";
import { SettingsLinkedAccountsSection } from "@/components/settings/SettingsLinkedAccountsSection";

export default function SettingsPage() {
  const { t } = useTranslation();
  const mgr = useSettingsManager();

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        <Link href="/decks?view=shortages">
          {t("settings.backLink")}
        </Link>
      </div>

      <PageHeader
        eyebrow={t("settings.pageEyebrow")}
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={
          <Button
            onClick={() => mgr.save()}
            disabled={mgr.saving || mgr.loading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 shadow-lg shadow-emerald-900/20"
          >
            {mgr.saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t("settings.savingBtn")}</span>
              </>
            ) : (
              <span>{t("settings.saveSettingsBtn")}</span>
            )}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Fulfillment & Marketplace Pricing */}
        <div className="space-y-6">
          {mgr.hasVendorCapability && <SettingsSuperfreteSection
            hasSavedSuperfreteApiKey={mgr.hasSavedSuperfreteApiKey}
            superfreteApiKey={mgr.superfreteApiKey}
            setSuperfreteApiKey={mgr.setSuperfreteApiKey}
            loading={mgr.loading}
            clearingSuperfrete={mgr.clearingSuperfrete}
            onClearSuperfrete={mgr.handleClearSuperfrete}
          />}

          {mgr.hasVendorCapability && (mgr.hasSavedSuperfreteApiKey || Boolean(mgr.superfreteApiKey.trim())) && (
            <SettingsShippingPackageSection
              shippingPackagePreset={mgr.shippingPackagePreset}
              onSelectPreset={mgr.handleSelectPackagePreset}
              shippingPackageHeight={mgr.shippingPackageHeight}
              setShippingPackageHeight={mgr.setShippingPackageHeight}
              shippingPackageWidth={mgr.shippingPackageWidth}
              setShippingPackageWidth={mgr.setShippingPackageWidth}
              shippingPackageLength={mgr.shippingPackageLength}
              setShippingPackageLength={mgr.setShippingPackageLength}
              shippingPackageBaseWeight={mgr.shippingPackageBaseWeight}
              setShippingPackageBaseWeight={mgr.setShippingPackageBaseWeight}
              shippingPackageTapeWeight={mgr.shippingPackageTapeWeight}
              setShippingPackageTapeWeight={mgr.setShippingPackageTapeWeight}
              shippingCardWeight={mgr.shippingCardWeight}
              setShippingCardWeight={mgr.setShippingCardWeight}
              loading={mgr.loading}
            />
          )}

          <SettingsFairnessSection
            slightlyOverpriced={mgr.slightlyOverpriced}
            setSlightlyOverpriced={mgr.setSlightlyOverpriced}
            heavilyOverpriced={mgr.heavilyOverpriced}
            setHeavilyOverpriced={mgr.setHeavilyOverpriced}
            loading={mgr.loading}
          />
        </div>

        {/* Right Column: MyP Automation & Playgroup */}
        <div className="space-y-6">
          <SettingsMypSection
            mypUsername={mgr.mypUsername}
            setMypUsername={mgr.setMypUsername}
            mypLogin={mgr.mypLogin}
            setMypLogin={mgr.setMypLogin}
            mypPassword={mgr.mypPassword}
            setMypPassword={mgr.setMypPassword}
            mypAutoWatchlistEnabled={mgr.mypAutoWatchlistEnabled}
            setMypAutoWatchlistEnabled={mgr.setMypAutoWatchlistEnabled}
            sellerModeEnabled={mgr.sellerModeEnabled}
            setSellerModeEnabled={mgr.setSellerModeEnabled}
            hasSavedMypCredentials={mgr.hasSavedMypCredentials}
            loading={mgr.loading}
            clearingCreds={mgr.clearingCreds}
            onClearCredentials={mgr.handleClearCredentials}
          />

          <SettingsPlaygroupSection
            friendCode={mgr.friendCode}
            copied={mgr.copied}
            onCopyFriendCode={mgr.copyFriendCode}
            threshold={mgr.threshold}
            setThreshold={mgr.setThreshold}
            loading={mgr.loading}
          />

          <SettingsLinkedAccountsSection />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button
          onClick={() => mgr.save()}
          disabled={mgr.saving || mgr.loading}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 shadow-lg shadow-emerald-900/20"
        >
          {mgr.saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("settings.savingBtn")}</span>
            </>
          ) : (
            <span>{t("settings.saveSettingsBtn")}</span>
          )}
        </Button>
      </div>
    </div>
  );
}
