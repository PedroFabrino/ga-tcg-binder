"use client";

import React from "react";
import { Modal } from "./common";
import { Button } from "./ui/button";
import { useTranslation } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useSettingsManager } from "./settings/useSettingsManager";
import { SettingsPlaygroupSection } from "./settings/SettingsPlaygroupSection";
import { SettingsMypSection } from "./settings/SettingsMypSection";
import { SettingsSuperfreteSection } from "./settings/SettingsSuperfreteSection";
import { SettingsFairnessSection } from "./settings/SettingsFairnessSection";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const mgr = useSettingsManager();

  return (
    <Modal
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="outline" size="sm" disabled={mgr.saving}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => mgr.save(onClose)}
            size="sm"
            disabled={mgr.saving || mgr.loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            {mgr.saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("settings.savingBtn")}
              </span>
            ) : (
              t("settings.saveSettingsBtn")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Playgroup Friend Code & Low Pop Threshold */}
        <SettingsPlaygroupSection
          friendCode={mgr.friendCode}
          copied={mgr.copied}
          onCopyFriendCode={mgr.copyFriendCode}
          threshold={mgr.threshold}
          setThreshold={mgr.setThreshold}
          loading={mgr.loading}
        />

        {/* MyP Cards Watchlist Auto-Sync */}
        <SettingsMypSection
          mypUsername={mgr.mypUsername}
          setMypUsername={mgr.setMypUsername}
          mypLogin={mgr.mypLogin}
          setMypLogin={mgr.setMypLogin}
          mypPassword={mgr.mypPassword}
          setMypPassword={mgr.setMypPassword}
          mypAutoWatchlistEnabled={mgr.mypAutoWatchlistEnabled}
          setMypAutoWatchlistEnabled={mgr.setMypAutoWatchlistEnabled}
          hasSavedMypCredentials={mgr.hasSavedMypCredentials}
          loading={mgr.loading}
          clearingCreds={mgr.clearingCreds}
          onClearCredentials={mgr.handleClearCredentials}
        />

        {/* Superfrete Shipping Credentials */}
        <SettingsSuperfreteSection
          hasSavedSuperfreteApiKey={mgr.hasSavedSuperfreteApiKey}
          superfreteApiKey={mgr.superfreteApiKey}
          setSuperfreteApiKey={mgr.setSuperfreteApiKey}
          loading={mgr.loading}
          clearingSuperfrete={mgr.clearingSuperfrete}
          onClearSuperfrete={mgr.handleClearSuperfrete}
        />

        {/* Price Fairness Multipliers */}
        <SettingsFairnessSection
          slightlyOverpriced={mgr.slightlyOverpriced}
          setSlightlyOverpriced={mgr.setSlightlyOverpriced}
          heavilyOverpriced={mgr.heavilyOverpriced}
          setHeavilyOverpriced={mgr.setHeavilyOverpriced}
          loading={mgr.loading}
        />
      </div>
    </Modal>
  );
}
