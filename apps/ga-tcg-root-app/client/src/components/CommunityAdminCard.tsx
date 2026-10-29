import React, { useEffect, useState, useCallback } from "react";
import {
  Radio,
  Save,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { type SupportedLocale } from "@ga/contracts";
import { useTranslator } from "../hooks/useTranslator";
import {
  pickInitialChannelId,
  pickInitialGroupId,
  resolveAdminErrorMessage,
} from "./admin-card-helpers";
import { AdminStatusBadges } from "./AdminStatusBadges";
import { AdminBroadcastLanguageSelector } from "./AdminBroadcastLanguageSelector";
import type {
  IAssistantRpcClient,
  CommunityChannelOption,
  CommunityChannelGroupOption,
  AdminSettingsResponse,
  AdminFeedback,
} from "../types";

export interface CommunityAdminCardProps {
  isAdmin: boolean;
  client: IAssistantRpcClient;
  locale?: SupportedLocale;
  /** Seeds settings state for SSR tests and instant first paint */
  initialSettings?: AdminSettingsResponse;
  /** Seeds feedback state for SSR tests */
  initialFeedback?: AdminFeedback;
}

export const CommunityAdminCard: React.FC<CommunityAdminCardProps> = ({
  isAdmin,
  client,
  locale,
  initialSettings,
  initialFeedback,
}) => {
  const t = useTranslator(locale);
  const [loading, setLoading] = useState(!initialSettings);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [broadcastChannelId, setBroadcastChannelId] = useState(
    initialSettings?.broadcastChannelId ?? ""
  );
  const [broadcastChannelName, setBroadcastChannelName] = useState(
    initialSettings?.broadcastChannelName ?? ""
  );
  const [alertSectionId, setAlertSectionId] = useState(
    initialSettings?.alertSectionId ?? ""
  );
  const [alertSectionName, setAlertSectionName] = useState(
    initialSettings?.alertSectionName ?? ""
  );
  const [textChannels, setTextChannels] = useState<CommunityChannelOption[]>(
    initialSettings?.textChannels ?? []
  );
  const [channelGroups, setChannelGroups] = useState<
    CommunityChannelGroupOption[]
  >(initialSettings?.channelGroups ?? []);
  const [selectedChannelId, setSelectedChannelId] = useState(
    pickInitialChannelId(initialSettings)
  );
  const [selectedGroupId, setSelectedGroupId] = useState(
    pickInitialGroupId(initialSettings)
  );
  const [broadcastLocale, setBroadcastLocale] = useState<SupportedLocale>(
    initialSettings?.broadcastLocale === "pt-BR" ? "pt-BR" : "en"
  );
  const [savingLocale, setSavingLocale] = useState(false);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(
    initialFeedback ?? null
  );

  const loadSettings = useCallback(async () => {
    try {
      const res = await client.getAdminSettings();
      if (res.isAdmin) {
        setBroadcastChannelId(res.broadcastChannelId);
        setBroadcastChannelName(res.broadcastChannelName);
        setAlertSectionId(res.alertSectionId || "");
        setAlertSectionName(res.alertSectionName || "");
        setTextChannels(res.textChannels || []);
        setChannelGroups(res.channelGroups || []);
        setSelectedChannelId(pickInitialChannelId(res));
        setSelectedGroupId(pickInitialGroupId(res));
        if (res.broadcastLocale) {
          setBroadcastLocale(res.broadcastLocale === "pt-BR" ? "pt-BR" : "en");
        }
      }
    } catch (err) {
      console.warn("Failed to load community admin settings:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
    }
  }, [isAdmin, loadSettings]);

  if (!isAdmin) {
    return null;
  }

  const handleSaveSettings = async () => {
    if ((!selectedChannelId && !selectedGroupId) || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await client.setBroadcastChannel({
        channelId: selectedChannelId,
        channelGroupId: selectedGroupId,
      });
      if (res.success) {
        setBroadcastChannelId(res.broadcastChannelId);
        setBroadcastChannelName(res.broadcastChannelName);
        if (res.alertSectionId) {
          setAlertSectionId(res.alertSectionId);
          setAlertSectionName(res.alertSectionName);
        }
        setFeedback({
          type: "success",
          text: t("communityAdmin.saveSuccess"),
        });
      } else {
        setFeedback({
          type: "error",
          text: resolveAdminErrorMessage(res.error, t),
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("communityAdmin.saveError"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProvision = async () => {
    if (provisioning) return;
    setProvisioning(true);
    setFeedback(null);
    try {
      const res = await client.provisionMarketChannels({
        channelGroupId: selectedGroupId,
      });
      if (res.success) {
        setBroadcastChannelId(res.broadcastChannelId);
        setBroadcastChannelName(res.broadcastChannelName);
        if (res.alertSectionId) {
          setAlertSectionId(res.alertSectionId);
          setAlertSectionName(res.alertSectionName);
        }
        setFeedback({
          type: "success",
          text: t("communityAdmin.provisionSuccess", {
            channel: res.broadcastChannelName || "market",
          }),
        });
        await loadSettings();
      } else {
        setFeedback({
          type: "error",
          text: resolveAdminErrorMessage(
            res.error,
            t,
            "communityAdmin.provisionError"
          ),
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("communityAdmin.provisionError"),
      });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSaveLocale = async (newLocale: SupportedLocale) => {
    if (savingLocale || saving) return;
    setSavingLocale(true);
    setFeedback(null);
    try {
      const res = await client.setBroadcastChannel({
        channelId: "",
        broadcastLocale: newLocale,
      });
      if (res.success) {
        setBroadcastLocale(res.broadcastLocale === "pt-BR" ? "pt-BR" : "en");
        setFeedback({
          type: "success",
          text: t("communityAdmin.saveLocaleSuccess", {
            locale:
              newLocale === "pt-BR"
                ? t("communityAdmin.broadcastLocalePtBr")
                : t("communityAdmin.broadcastLocaleEn"),
          }),
        });
      } else {
        setFeedback({
          type: "error",
          text: resolveAdminErrorMessage(res.error, t),
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : t("communityAdmin.saveError"),
      });
    } finally {
      setSavingLocale(false);
    }
  };

  return (
    <div
      data-testid="community-admin-card"
      className="rounded-xl border border-amber-500/20 bg-amber-500/[0.02] p-6 backdrop-blur-sm shadow-xl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                {t("communityAdmin.cardTitle")}
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <ShieldCheck className="w-3 h-3" />
                {t("communityAdmin.adminBadge")}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {t("communityAdmin.cardDescription")}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="pt-4 flex items-center justify-center py-6 text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2 text-amber-400" />
          {t("communityAdmin.loadingSettings")}
        </div>
      ) : (
        <div className="pt-4 space-y-4">
          <AdminStatusBadges
            t={t}
            broadcastChannelId={broadcastChannelId}
            broadcastChannelName={broadcastChannelName}
            alertSectionId={alertSectionId}
            alertSectionName={alertSectionName}
          />

          {/* Feedback banner */}
          {feedback && (
            <div
              role="alert"
              className={`flex items-center gap-2 p-3 rounded-lg text-xs border ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Configuration Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Channel Group Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">
                {t("communityAdmin.channelGroupLabel")}
              </label>
              <select
                aria-label={t("communityAdmin.channelGroupLabel")}
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={saving || provisioning}
                className="w-full appearance-none rounded-lg border border-white/[0.12] bg-black/40 px-3.5 py-2 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
              >
                <option value="">{t("communityAdmin.selectGroupPlaceholder")}</option>
                {channelGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Broadcast Channel Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">
                {t("communityAdmin.broadcastChannelLabel")}
              </label>
              <select
                aria-label={t("communityAdmin.broadcastChannelLabel")}
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                disabled={saving || provisioning || textChannels.length === 0}
                className="w-full appearance-none rounded-lg border border-white/[0.12] bg-black/40 px-3.5 py-2 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
              >
                {textChannels.length === 0 ? (
                  <option value="">{t("communityAdmin.noChannelsFound")}</option>
                ) : (
                  textChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name} {ch.groupName ? `(${ch.groupName})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving || provisioning || (!selectedChannelId && !selectedGroupId)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/20"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving
                ? t("communityAdmin.savingSettings")
                : t("communityAdmin.saveSettingsButton")}
            </button>

            <button
              type="button"
              onClick={handleProvision}
              disabled={saving || provisioning}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {provisioning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              )}
              {provisioning
                ? t("communityAdmin.provisioning")
                : t("communityAdmin.provisionButton")}
            </button>
          </div>

          <AdminBroadcastLanguageSelector
            t={t}
            broadcastLocale={broadcastLocale}
            disabled={savingLocale || saving || provisioning}
            onSaveLocale={handleSaveLocale}
          />
        </div>
      )}
    </div>
  );
};
