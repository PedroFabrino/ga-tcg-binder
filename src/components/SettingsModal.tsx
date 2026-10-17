"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Modal } from "./common";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "./ToastProvider";
import { useTranslation } from "@/lib/i18n";
import {
  Flame,
  Copy,
  Check,
  Loader2,
  Lock,
  Store,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import type { SettingsUpdateInput } from "@/lib/validation/watchlist-schemas";

const MIN = 100;
const MAX = 5000;
const STEP = 50;

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState<number>(1000);
  const [friendCode, setFriendCode] = useState<string>("");
  const [mypUsername, setMypUsername] = useState<string>("");
  const [mypLogin, setMypLogin] = useState<string>("");
  const [mypPassword, setMypPassword] = useState<string>("");
  const [mypAutoWatchlistEnabled, setMypAutoWatchlistEnabled] = useState<boolean>(false);
  const [hasSavedMypCredentials, setHasSavedMypCredentials] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingCreds, setClearingCreds] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setThreshold(data.user.lowPopThreshold ?? 1000);
          setFriendCode(data.user.friendCode ?? "");
          setMypUsername(data.user.mypUsername ?? "");
          setMypLogin(data.user.mypLogin ?? "");
          setHasSavedMypCredentials(Boolean(data.user.hasSavedMypCredentials));
          setMypAutoWatchlistEnabled(Boolean(data.user.mypAutoWatchlistEnabled));
        }
      })
      .catch(() => showToast(t("common.error"), "error"))
      .finally(() => setLoading(false));
  }, [showToast, t]);

  const copyFriendCode = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      showToast(t("common.success"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("common.error"), "error");
    }
  };

  const handleClearCredentials = async () => {
    setClearingCreds(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearMypCredentials: true,
          userId: session?.user?.id,
        }),
      });
      if (!res.ok) throw new Error();
      setHasSavedMypCredentials(false);
      setMypLogin("");
      setMypPassword("");
      setMypAutoWatchlistEnabled(false);
      showToast(t("settings.clearedToast"), "success");
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setClearingCreds(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: SettingsUpdateInput = {
        lowPopThreshold: threshold,
        mypUsername: mypUsername.trim() || null,
        mypAutoWatchlistEnabled,
      };

      if (mypPassword.trim()) {
        body.mypPassword = mypPassword.trim();
        body.mypLogin = mypLogin.trim() || mypUsername.trim();
      } else if (mypLogin.trim()) {
        body.mypLogin = mypLogin.trim();
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { user?: { hasSavedMypCredentials?: boolean } };
      if (json.user) {
        setHasSavedMypCredentials(Boolean(json.user.hasSavedMypCredentials));
      }
      showToast(t("settings.savedToast"), "success");
      onClose();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="outline" size="sm" disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={save}
            size="sm"
            disabled={saving || loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            {saving ? (
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
              onClick={copyFriendCode}
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

        {/* MyP Cards Watchlist Auto-Sync (Optional) */}
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
                  onClick={handleClearCredentials}
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
      </div>
    </Modal>
  );
}
