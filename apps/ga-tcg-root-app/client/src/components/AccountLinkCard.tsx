import React, { useState } from "react";
import { Link2, ShieldCheck, ExternalLink, Loader2, AlertCircle, UserPlus } from "lucide-react";
import type { SupportedLocale } from "@ga/contracts";
import { useTranslator } from "../hooks/useTranslator";

export interface AccountLinkCardProps {
  isLinked: boolean;
  collectorName: string;
  friendCode: string;
  onLink: (code: string) => Promise<{ success: boolean; error?: string }>;
  onRegister?: () => Promise<{ success: boolean; error?: string }>;
  portalUrl?: string;
  locale?: SupportedLocale;
}

export const AccountLinkCard: React.FC<AccountLinkCardProps> = ({
  isLinked,
  collectorName,
  friendCode,
  onLink,
  onRegister,
  portalUrl = "https://ga-tcg-binder.vercel.app/settings/linked-accounts",
  locale,
}) => {
  const t = useTranslator(locale);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError(t("rootApp.accountLink.errEnterCode"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await onLink(trimmed);
      if (!res.success) {
        if (res.error === "INVALID_CODE") {
          setError(t("rootApp.accountLink.errInvalidCode"));
        } else if (res.error === "EXPIRED_CODE") {
          setError(t("rootApp.accountLink.errExpiredCode"));
        } else {
          setError(res.error || t("rootApp.accountLink.errLinkFailed"));
        }
      } else {
        setCode("");
      }
    } catch {
      setError(t("rootApp.accountLink.errNetworkRpc"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = async () => {
    if (!onRegister) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await onRegister();
      if (!res.success) {
        setError(res.error || t("rootApp.accountLink.errRegisterFailed"));
      }
    } catch {
      setError(t("rootApp.accountLink.errRegisterFailed"));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm shadow-xl transition-all">
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {isLinked ? <ShieldCheck className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {isLinked
                ? t("rootApp.accountLink.titleConnected")
                : t("rootApp.accountLink.titleUnlinked")}
            </h2>
            <p className="text-xs text-slate-400">
              {isLinked
                ? t("rootApp.accountLink.subtitleConnected")
                : t("rootApp.accountLink.subtitleUnlinked")}
            </p>
          </div>
        </div>

        {isLinked ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("rootApp.accountLink.statusConnected")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {t("rootApp.accountLink.statusUnlinked")}
          </span>
        )}
      </div>

      <div className="pt-4">
        {isLinked ? (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-black/20 rounded-lg p-4 border border-white/[0.04]">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {t("rootApp.accountLink.labelCollector")}
              </span>
              <p className="text-lg font-bold text-slate-100">
                {collectorName || t("rootApp.accountLink.labelCollector")}
              </p>
            </div>
            {friendCode && (
              <div className="space-y-1 text-right">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {t("rootApp.accountLink.labelFriendCode")}
                </span>
                <p className="text-sm font-mono text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                  {friendCode}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-indigo-300">
                  {t("rootApp.accountLink.newToTitle")}
                </h3>
                <p className="text-xs text-slate-400">
                  {t("rootApp.accountLink.newToDesc")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRegisterClick}
                disabled={registering || loading}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition shadow-lg shadow-emerald-600/20 cursor-pointer shrink-0"
              >
                {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                {t("rootApp.accountLink.registerButton")}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <p className="text-xs text-slate-400">
                {t("rootApp.accountLink.alreadyHaveAccount", {
                  portalLink: t("rootApp.accountLink.portalSettingsLink"),
                })}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t("rootApp.accountLink.placeholderCode")}
                  disabled={loading || registering}
                  className="w-full sm:w-48 px-3.5 py-2 rounded-lg bg-black/40 border border-white/[0.12] text-slate-100 text-center font-mono text-sm tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 uppercase disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || code.trim().length === 0 || registering}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  {t("rootApp.accountLink.buttonLink")}
                </button>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-medium text-xs transition"
                >
                  {t("rootApp.accountLink.buttonGetCode")}
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </div>
            </form>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
