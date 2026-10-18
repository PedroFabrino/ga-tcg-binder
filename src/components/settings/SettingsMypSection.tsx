"use client";

import React from "react";
import { Store, ShieldCheck, Lock, Loader2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useTranslation } from "@/lib/i18n";

interface SettingsMypSectionProps {
  mypUsername: string;
  setMypUsername: (val: string) => void;
  mypLogin: string;
  setMypLogin: (val: string) => void;
  mypPassword: string;
  setMypPassword: (val: string) => void;
  mypAutoWatchlistEnabled: boolean;
  setMypAutoWatchlistEnabled: (val: boolean) => void;
  hasSavedMypCredentials: boolean;
  loading: boolean;
  clearingCreds: boolean;
  onClearCredentials: () => void;
}

export function SettingsMypSection({
  mypUsername,
  setMypUsername,
  mypLogin,
  setMypLogin,
  mypPassword,
  setMypPassword,
  mypAutoWatchlistEnabled,
  setMypAutoWatchlistEnabled,
  hasSavedMypCredentials,
  loading,
  clearingCreds,
  onClearCredentials,
}: SettingsMypSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-cyan-400" />
          <h4 className="text-sm font-semibold text-white">{t("settings.mypAutomationTitle")}</h4>
        </div>
        {hasSavedMypCredentials ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="h-3 w-3" /> {t("settings.savedCredentialsActive")}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-mono">{t("settings.manualBridgeDesc")}</span>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {t("settings.mypAutomationDesc")}
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {t("settings.mypUsernameLabel")}
          </label>
          <Input
            type="text"
            placeholder={t("settings.mypUsernamePlaceholder")}
            value={mypUsername}
            onChange={(e) => setMypUsername(e.target.value)}
            disabled={loading}
            className="text-xs"
          />
          <p className="text-[11px] text-slate-500 mt-1">{t("settings.mypUsernameHelp")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t("settings.mypLoginLabel")}
            </label>
            <Input
              type="text"
              placeholder={t("settings.mypLoginPlaceholder")}
              value={mypLogin}
              onChange={(e) => setMypLogin(e.target.value)}
              disabled={loading}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t("settings.mypPasswordLabel")}
            </label>
            <Input
              type="password"
              placeholder={hasSavedMypCredentials ? t("settings.mypPasswordPlaceholder") : t("settings.passwordAutoSyncDesc")}
              value={mypPassword}
              onChange={(e) => setMypPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              className="text-xs"
            />
          </div>
        </div>

        {hasSavedMypCredentials && (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={mypAutoWatchlistEnabled}
                onChange={(e) => setMypAutoWatchlistEnabled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
              />
              <span>{t("settings.mypAutomationTitle")}</span>
            </label>
            <Button
              type="button"
              onClick={onClearCredentials}
              disabled={clearingCreds}
              variant="outline"
              size="sm"
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 text-xs gap-1.5"
            >
              {clearingCreds ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {t("settings.clearCredentialsBtn")}
            </Button>
          </div>
        )}

        <div className="rounded-lg bg-slate-900/60 border border-white/[0.04] p-2.5 text-[11px] text-slate-400 flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>{t("settings.mypCredentialsDesc")}</span>
        </div>
      </div>
    </div>
  );
}
