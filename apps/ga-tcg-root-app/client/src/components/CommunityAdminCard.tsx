import React, { useEffect, useState, useCallback } from "react";
import {
  Radio,
  Save,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { createTranslator, resolveLocale, type SupportedLocale } from "@ga/contracts";
import type {
  IAssistantRpcClient,
  CommunityChannelOption,
  AdminSettingsResponse,
} from "../types";

export interface CommunityAdminCardProps {
  isAdmin: boolean;
  client: IAssistantRpcClient;
  locale?: SupportedLocale;
  initialSettings?: AdminSettingsResponse;
  initialFeedback?: {
    type: "success" | "error";
    text: string;
  };
}

export const CommunityAdminCard: React.FC<CommunityAdminCardProps> = ({
  isAdmin,
  client,
  locale,
  initialSettings,
  initialFeedback,
}) => {
  const t = createTranslator(resolveLocale(locale));
  const [loading, setLoading] = useState(!initialSettings);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [broadcastChannelId, setBroadcastChannelId] = useState(
    initialSettings?.broadcastChannelId ?? ""
  );
  const [broadcastChannelName, setBroadcastChannelName] = useState(
    initialSettings?.broadcastChannelName ?? ""
  );
  const [textChannels, setTextChannels] = useState<CommunityChannelOption[]>(
    initialSettings?.textChannels ?? []
  );
  const [selectedChannelId, setSelectedChannelId] = useState(
    initialSettings?.broadcastChannelId || (initialSettings?.textChannels?.[0]?.id ?? "")
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(initialFeedback ?? null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await client.getAdminSettings();
      if (res.isAdmin) {
        setBroadcastChannelId(res.broadcastChannelId);
        setBroadcastChannelName(res.broadcastChannelName);
        setTextChannels(res.textChannels || []);
        setSelectedChannelId(
          res.broadcastChannelId || (res.textChannels?.[0]?.id ?? "")
        );
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

  const handleSaveChannel = async () => {
    if (!selectedChannelId || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await client.setBroadcastChannel({ channelId: selectedChannelId });
      if (res.success) {
        setBroadcastChannelId(res.broadcastChannelId);
        setBroadcastChannelName(res.broadcastChannelName);
        setFeedback({
          type: "success",
          text: t("communityAdmin.saveSuccess", {
            channel: res.broadcastChannelName || res.broadcastChannelId,
          }),
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || t("communityAdmin.saveError"),
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
      const res = await client.provisionMarketChannels();
      if (res.success) {
        setBroadcastChannelId(res.broadcastChannelId);
        setBroadcastChannelName(res.broadcastChannelName);
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
          text: res.error || t("communityAdmin.provisionError"),
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
          {/* Active Broadcast Channel Status */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">
              {t("communityAdmin.activeChannelLabel")}:
            </span>
            {broadcastChannelId ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-xs">
                <Hash className="w-3 h-3 text-emerald-400" />
                {broadcastChannelName || broadcastChannelId}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <AlertCircle className="w-3 h-3" />
                {t("communityAdmin.noChannelConfigured")}
              </span>
            )}
          </div>

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

          {/* Channel selector & actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <div className="relative flex-1">
              <select
                aria-label={t("communityAdmin.selectChannelPlaceholder")}
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

            <button
              type="button"
              onClick={handleSaveChannel}
              disabled={saving || provisioning || !selectedChannelId}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/20"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving
                ? t("communityAdmin.savingChannel")
                : t("communityAdmin.saveChannelButton")}
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
        </div>
      )}
    </div>
  );
};
