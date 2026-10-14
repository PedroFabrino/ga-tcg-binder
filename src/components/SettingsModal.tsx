"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Copy, Check, Loader2, Gem } from "lucide-react";
import { Modal } from "@/components/common";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const MIN = 100;
const MAX = 5000;

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [threshold, setThreshold] = useState(1000);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const userIdQuery = session?.user?.id ? `?userId=${encodeURIComponent(session.user.id)}` : "";
    fetch(`/api/settings${userIdQuery}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.user) {
          setThreshold(data.user.lowPopThreshold ?? 1000);
          setFriendCode(data.user.friendCode ?? null);
        }
      })
      .catch(() => showToast("Couldn't load your preferences", "error"))
      .finally(() => setLoading(false));
  }, [session?.user?.id, showToast]);

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
        body: JSON.stringify({ lowPopThreshold: threshold, userId: session?.user?.id }),
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

  return (
    <Modal
      title="Preferences"
      subtitle="Scarcity cutoffs and your playgroup code"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div>
            <p className="label-caps !text-[10px]">Friend Code</p>
            {friendCode ? <p className="mt-1 font-mono text-base font-semibold tracking-wider text-white">{friendCode}</p> : <span className="skeleton mt-1 block h-5 w-28 rounded" />}
          </div>
          <Button onClick={copy} disabled={!friendCode} variant="outline" size="sm">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="threshold-input" className="flex items-center gap-1.5 text-sm font-medium text-white">
              <Gem className="h-3.5 w-3.5 text-amber-200" /> Low Pop Threshold
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">≤</span>
              <Input
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
                className="w-24 py-1 text-right font-mono"
              />
            </div>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">Printings with a circulation at or below this count get the gold Low Pop badge.</p>
          <Slider
            min={MIN}
            max={MAX}
            step={50}
            value={[Math.min(MAX, Math.max(MIN, threshold))]}
            disabled={loading}
            onValueChange={([v]) => setThreshold(v)}
            aria-label="Low pop threshold slider"
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
