import React, { useState } from "react";
import { Bell, BellOff, MessageSquare, Loader2 } from "lucide-react";

export interface DealAlertCardProps {
  isLinked: boolean;
  notificationsEnabled: boolean;
  dealAlertMode: string;
  alertChannelId: string;
  onUpdatePreferences: (enabled: boolean, mode: "all" | "hard") => Promise<void>;
}

export const DealAlertCard: React.FC<DealAlertCardProps> = ({
  isLinked,
  notificationsEnabled,
  dealAlertMode,
  alertChannelId,
  onUpdatePreferences,
}) => {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!isLinked || loading) return;
    setLoading(true);
    try {
      const nextEnabled = !notificationsEnabled;
      const mode = (dealAlertMode === "hard" ? "hard" : "all") as "all" | "hard";
      await onUpdatePreferences(nextEnabled, mode);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (mode: "all" | "hard") => {
    if (!isLinked || loading || mode === dealAlertMode) return;
    setLoading(true);
    try {
      await onUpdatePreferences(notificationsEnabled, mode);
    } finally {
      setLoading(false);
    }
  };

  const channelUrl = alertChannelId ? `root://channel/${alertChannelId}` : null;

  return (
    <div className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm shadow-xl transition-all ${!isLinked ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {notificationsEnabled ? <Bell className="w-5 h-5 text-indigo-400" /> : <BellOff className="w-5 h-5 text-slate-500" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Market Deal Alerts</h2>
            <p className="text-xs text-slate-400">
              Receive automated notifications when cards you need are listed at or below market value
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={notificationsEnabled}
          disabled={!isLinked || loading}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-40 disabled:cursor-not-allowed ${
            notificationsEnabled ? "bg-indigo-600" : "bg-slate-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              notificationsEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="pt-4 space-y-4">
        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Alert Scope Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!isLinked || loading}
              onClick={() => handleModeChange("all")}
              className={`p-3 rounded-lg border text-left transition ${
                dealAlertMode !== "hard"
                  ? "border-indigo-500/50 bg-indigo-500/10 text-slate-100 shadow-sm shadow-indigo-500/10"
                  : "border-white/[0.08] bg-black/20 text-slate-400 hover:border-white/[0.16] hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">All Shortages</span>
                {dealAlertMode !== "hard" && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Hard shortages + shared deck rotations + personal wantlist
              </p>
            </button>

            <button
              type="button"
              disabled={!isLinked || loading}
              onClick={() => handleModeChange("hard")}
              className={`p-3 rounded-lg border text-left transition ${
                dealAlertMode === "hard"
                  ? "border-indigo-500/50 bg-indigo-500/10 text-slate-100 shadow-sm shadow-indigo-500/10"
                  : "border-white/[0.08] bg-black/20 text-slate-400 hover:border-white/[0.16] hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Hard Shortages Only</span>
                {dealAlertMode === "hard" && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Only unowned cards you need to buy + personal wantlist
              </p>
            </button>
          </div>
        </div>

        {/* Private Alert Channel Link */}
        {notificationsEnabled && channelUrl && (
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-slate-300">
                Delivering alerts to your private channel:
              </span>
            </div>
            <a
              href={channelUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 text-xs font-mono border border-indigo-500/30 transition"
            >
              #deal-alerts
            </a>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-indigo-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Updating notification preferences...
          </div>
        )}
      </div>
    </div>
  );
};
