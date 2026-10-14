"use client";

import { useEffect, useState } from "react";
import { X, Sliders, Copy, Check, Save } from "lucide-react";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [threshold, setThreshold] = useState<number>(1000);
  const [friendCode, setFriendCode] = useState<string>("GA-ALEX01");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setThreshold(data.user.lowPopThreshold ?? 1000);
          setFriendCode(data.user.friendCode ?? "GA-ALEX01");
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));
  }, []);

  const copyFriendCode = () => {
    navigator.clipboard.writeText(friendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowPopThreshold: threshold }),
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Collector Preferences</h2>
            <p className="text-xs text-slate-400">Manage scarcity cutoffs and your Friend Link code.</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Friend Code */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Your Playgroup Friend Code
            </span>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-indigo-400">{friendCode}</span>
              <button
                onClick={copyFriendCode}
                className="flex items-center space-x-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Low Pop Threshold */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="threshold-slider" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Low Population Threshold
              </label>
              <span className="rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-400 font-mono">
                ≤ {threshold.toLocaleString()} copies
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 mb-2">
              Cards with publisher circulation count at or below this limit are marked with the "Low Population" badge.
            </p>
            <input
              id="threshold-slider"
              type="range"
              min="100"
              max="5000"
              step="50"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>100 (Ultra Rare)</span>
              <span>1,000 (Standard Cutoff)</span>
              <span>5,000</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>{saved ? "Preferences Saved!" : saving ? "Saving..." : "Save Preferences"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
