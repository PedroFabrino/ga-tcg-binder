import React, { useState } from "react";
import { Link2, ShieldCheck, ExternalLink, Loader2, AlertCircle } from "lucide-react";

export interface AccountLinkCardProps {
  isLinked: boolean;
  collectorName: string;
  friendCode: string;
  onLink: (code: string) => Promise<{ success: boolean; error?: string }>;
  portalUrl?: string;
}

export const AccountLinkCard: React.FC<AccountLinkCardProps> = ({
  isLinked,
  collectorName,
  friendCode,
  onLink,
  portalUrl = "https://ga-tcg-binder.vercel.app/settings/linked-accounts",
}) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter your 6-character pairing code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await onLink(trimmed);
      if (!res.success) {
        if (res.error === "INVALID_CODE") {
          setError("Invalid code. Check for typos and try again.");
        } else if (res.error === "EXPIRED_CODE") {
          setError("Code has expired. Generate a fresh one in the portal.");
        } else {
          setError(res.error || "Failed to link account. Please try again.");
        }
      } else {
        setCode("");
      }
    } catch {
      setError("Network or RPC error. Please retry.");
    } finally {
      setLoading(false);
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
              {isLinked ? "Connected Binder Account" : "Link GA Binder Account"}
            </h2>
            <p className="text-xs text-slate-400">
              {isLinked
                ? "Synchronized with Grand Archive Binder"
                : "Pair your Root account to enable deck tracking and deal alerts"}
            </p>
          </div>
        </div>

        {isLinked ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Unlinked
          </span>
        )}
      </div>

      <div className="pt-4">
        {isLinked ? (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-black/20 rounded-lg p-4 border border-white/[0.04]">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Collector</span>
              <p className="text-lg font-bold text-slate-100">{collectorName || "Collector"}</p>
            </div>
            {friendCode && (
              <div className="space-y-1 text-right">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Friend Code</span>
                <p className="text-sm font-mono text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                  {friendCode}
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Open GA Binder in your browser, visit <strong>Settings &gt; Linked Accounts</strong>, and generate a 6-character pairing code.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="6-DIGIT CODE"
                disabled={loading}
                className="w-full sm:w-48 px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/[0.12] text-slate-100 text-center font-mono text-base tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || code.trim().length === 0}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Link Account
              </button>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-medium text-sm transition"
              >
                Get Code
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
