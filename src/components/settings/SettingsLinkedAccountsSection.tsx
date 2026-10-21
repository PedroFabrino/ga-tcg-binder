"use client";

import React, { useState, useEffect } from "react";
import { Link2, Copy, Check, Trash2, KeyRound } from "lucide-react";
import { Button } from "../ui/button";
import { useTranslation } from "@/lib/i18n";

interface LinkedIdentity {
  id: string;
  provider: "discord" | "root";
  providerUserId: string;
  providerUsername?: string | null;
  linkedAt: string;
}

export function SettingsLinkedAccountsSection() {
  const { t } = useTranslation();
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch linked identities
  const fetchIdentities = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.identities || []);
      }
    } catch (err) {
      console.error("Failed to load linked identities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdentities();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setPairingToken(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleGenerateToken = async () => {
    try {
      setGenerating(true);
      const res = await fetch("/api/settings/identities/token", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPairingToken(data.token);
        const exp = new Date(data.expiresAt);
        setExpiresAt(exp);
        setTimeLeft(Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)));
      }
    } catch (err) {
      console.error("Failed to generate pairing token:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async (provider: "discord" | "root") => {
    try {
      const res = await fetch(`/api/settings/identities/${provider}`, { method: "DELETE" });
      if (res.ok) {
        setIdentities((prev) => prev.filter((i) => i.provider !== provider));
      }
    } catch (err) {
      console.error("Failed to unlink identity:", err);
    }
  };

  const handleCopy = () => {
    if (!pairingToken) return;
    navigator.clipboard.writeText(pairingToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            {t("settings.linkedAccountsTitle")}
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t("settings.linkedAccountsDesc")}
        </p>

        {/* Existing connected platforms */}
        <div className="space-y-2 pt-2">
          {loading ? (
            <p className="text-xs text-slate-500">{t("common.loading")}</p>
          ) : identities.length === 0 ? (
            <p className="text-xs text-slate-500 italic">{t("settings.noLinkedAccounts")}</p>
          ) : (
            identities.map((id) => (
              <div
                key={id.id}
                className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {id.provider === "discord"
                      ? t("settings.discordLabel")
                      : t("settings.rootLabel")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {id.providerUsername || id.providerUserId}
                    </p>
                    <p className="text-[10px] text-slate-500">{t("settings.connectedStatus")}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink(id.provider)}
                  className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {t("settings.unlinkBtn")}
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Token pairing display */}
        {pairingToken && (
          <div className="mt-4 p-4 rounded-lg bg-indigo-950/40 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-300 font-medium">
                {t("settings.pairingCodeExpiresIn", {
                  minutes: String(minutes),
                  seconds: seconds < 10 ? `0${seconds}` : String(seconds),
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-xs border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {t("settings.copyCodeBtn")}
              </Button>
            </div>
            <div className="text-center py-2">
              <span className="font-mono text-2xl font-bold tracking-widest text-white select-all">
                {pairingToken}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-indigo-200/70 border-t border-indigo-500/20 pt-2">
              <p>• {t("settings.botInstructionDiscord")}</p>
              <p>• {t("settings.botInstructionRoot")}</p>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!pairingToken && (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generating}
              onClick={handleGenerateToken}
              className="text-xs border-white/[0.12] hover:bg-white/[0.06]"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              {t("settings.generatePairingCodeBtn")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
