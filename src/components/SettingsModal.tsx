"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Loader2, Gem } from "lucide-react";
import { Modal } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";

const MIN = 100;
const MAX = 5000;

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [threshold, setThreshold] = useState(1000);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.user) {
          setThreshold(data.user.lowPopThreshold ?? 1000);
          setFriendCode(data.user.friendCode ?? null);
        }
      })
      .catch(() => showToast("Couldn't load your preferences", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const copy = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      showToast("Friend Code Copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowPopThreshold: threshold }),
      });
      if (!res.ok) throw new Error();
      showToast("Preferences saved", "success");
      onClose();
    } catch {
      showToast("Couldn't save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const pct = ((threshold - MIN) / (MAX - MIN)) * 100;

  return (
    <Modal
      title="Preferences"
      subtitle="Scarcity cutoffs and your playgroup code"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving || loading} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div>
            <p className="label-caps !text-[10px]">Friend Code</p>
            {friendCode ? <p className="mt-1 font-mono text-base font-semibold tracking-wider text-white">{friendCode}</p> : <span className="skeleton mt-1 block h-5 w-28 rounded" />}
          </div>
          <button onClick={copy} disabled={!friendCode} className="btn-ghost !px-3 !py-1.5 !text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="threshold-input" className="flex items-center gap-1.5 text-sm font-medium text-white">
              <Gem className="h-3.5 w-3.5 text-amber-200" /> Low Pop Threshold
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">≤</span>
              <input
                id="threshold-input"
                type="number"
                min={MIN}
                max={MAX}
                step={50}
                value={threshold}
                disabled={loading}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setThreshold(v);
                }}
                onBlur={() => setThreshold((v) => Math.min(MAX, Math.max(MIN, v)))}
                className="input-field !w-24 !py-1 text-right font-mono"
              />
            </div>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">Printings with a circulation at or below this count get the gold Low Pop badge.</p>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={50}
            value={Math.min(MAX, Math.max(MIN, threshold))}
            disabled={loading}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            aria-label="Low pop threshold slider"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-amber-300"
            style={{ background: `linear-gradient(to right, #e8c967 ${pct}%, rgba(255,255,255,0.08) ${pct}%)` }}
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-600">
            <span>{MIN}</span>
            <span>1,000</span>
            <span>{MAX.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
