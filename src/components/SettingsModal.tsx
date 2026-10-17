"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Copy, Check, Loader2, Gem, ShieldCheck, Lock, Trash2, Store } from "lucide-react";
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
  const [mypUsername, setMypUsername] = useState("");
  const [mypLogin, setMypLogin] = useState("");
  const [mypPassword, setMypPassword] = useState("");
  const [hasSavedMypCredentials, setHasSavedMypCredentials] = useState(false);
  const [clearingCreds, setClearingCreds] = useState(false);
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
          setMypUsername(data.user.mypUsername ?? "");
          setMypLogin(data.user.mypLogin ?? "");
          setHasSavedMypCredentials(Boolean(data.user.hasSavedMypCredentials));
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
      showToast("Credenciais MyP removidas com sucesso", "success");
    } catch {
      showToast("Não foi possível remover as credenciais", "error");
    } finally {
      setClearingCreds(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: any = {
        lowPopThreshold: threshold,
        userId: session?.user?.id,
        mypUsername: mypUsername.trim() || null,
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
      const json = await res.json();
      if (json.user) {
        setHasSavedMypCredentials(Boolean(json.user.hasSavedMypCredentials));
      }
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
      title="Preferences & Integrations"
      subtitle="Scarcity cutoffs, playgroup code, and MyP Cards automated sync"
      onClose={onClose}
      size="md"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Preferences
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Playgroup Friend Code */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div>
            <p className="label-caps !text-[10px]">Friend Code</p>
            {friendCode ? <p className="mt-1 font-mono text-base font-semibold tracking-wider text-white">{friendCode}</p> : <span className="skeleton mt-1 block h-5 w-28 rounded" />}
          </div>
          <Button onClick={copy} disabled={!friendCode} variant="outline" size="sm">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Low Pop Threshold */}
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

        {/* MyP Cards Watchlist Auto-Sync (Optional) */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-white">MyP Cards Watchlist Auto-Sync</h4>
            </div>
            {hasSavedMypCredentials ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="h-3 w-3" /> Auto-Sync Ativo
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Modo Manual / Browser Bridge</span>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Permite que o sistema sincronize automaticamente suas cartas necessárias com a lista <strong>Quero</strong> do MyP Cards durante o pipeline diário ou pelo botão de sincronização direta.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                MyP Username (Público)
              </label>
              <Input
                type="text"
                placeholder="Ex: Fabrino"
                value={mypUsername}
                onChange={(e) => setMypUsername(e.target.value)}
                disabled={loading}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Login / E-mail MyP
                </label>
                <Input
                  type="text"
                  placeholder="seu_email@exemplo.com"
                  value={mypLogin}
                  onChange={(e) => setMypLogin(e.target.value)}
                  disabled={loading}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Senha MyP (Opcional)
                </label>
                <Input
                  type="password"
                  placeholder={hasSavedMypCredentials ? "•••••••••••• (Salva)" : "Digite a senha para auto-sync"}
                  value={mypPassword}
                  onChange={(e) => setMypPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  className="text-xs"
                />
              </div>
            </div>

            {hasSavedMypCredentials && (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  onClick={handleClearCredentials}
                  disabled={clearingCreds}
                  variant="outline"
                  size="sm"
                  className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 text-xs gap-1.5"
                >
                  {clearingCreds ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Limpar Credenciais Salvas
                </Button>
              </div>
            )}

            <div className="rounded-lg bg-slate-900/60 border border-white/[0.04] p-2.5 text-[11px] text-slate-400 flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                Criptografia <strong>AES-256-GCM</strong> em repouso no Turso. Suas credenciais são descriptografadas exclusivamente em memória durante o ciclo de sincronização e nunca são expostas na interface.
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
