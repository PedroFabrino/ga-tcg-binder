"use client";

import { useEffect, useState } from "react";
import { QrCode, Check, Loader2, ExternalLink, Smartphone, Wifi } from "lucide-react";
import { Modal } from "@/components/common";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

interface Detection {
  rawText: string;
  cardName?: string;
  cardSlug?: string;
  editionId?: string;
  setPrefix?: string;
  collectorNumber?: string;
  confidence: number;
  timestamp: number;
  confirmed?: boolean;
}

export default function QrScanModal({ onClose }: { onClose: () => void }) {
  if (!FEATURES.scanner) return null;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/scanner/session", { method: "POST" });
        const data = await res.json();
        if (!active) return;
        if (!data.token) throw new Error();
        setToken(data.token);
        setQrCodeUrl(data.qrCodeDataUrl);
        setPairingUrl(data.pairingUrl);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refresh = async (t: string) => {
    const res = await fetch(`/api/scanner/session/${t}`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.detections)) setDetections(data.detections);
  };

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => refresh(token).catch(() => {}), 1500);
    return () => clearInterval(interval);
  }, [token]);

  const confirmCards = async (indices: number[]) => {
    if (!token || indices.length === 0) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/scanner/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, indices }),
      });
      if (!res.ok) throw new Error();
      const first = detections[indices[0]];
      showToast(indices.length === 1 ? `Added 1x ${first?.cardName || first?.rawText} to Binder` : `Added ${indices.length} cards to Binder`, "success");
      await refresh(token);
    } catch {
      showToast("Couldn't add scanned cards", "error");
    } finally {
      setConfirming(false);
    }
  };

  const pending = detections.map((d, i) => (!d.confirmed && d.editionId ? i : -1)).filter((i) => i !== -1);
  const paired = detections.length > 0;

  return (
    <Modal
      title="Scan with Phone"
      subtitle="Pair your phone camera to stream cards straight into your binder"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{pending.length} ready to add</span>
          <Button onClick={() => confirmCards(pending)} disabled={confirming || pending.length === 0} variant="accent">
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirm & Add to Binder
          </Button>
        </div>
      }
          >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          <p className="text-sm text-slate-400">Creating a secure pairing code...</p>
        </div>
      ) : failed ? (
        <p className="py-16 text-center text-sm text-rose-300">Couldn't start a scanning session. Close and try again.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="relative rounded-2xl bg-white p-3 shadow-[0_0_60px_-12px_rgba(6,182,212,0.5)]">
              {qrCodeUrl && <img src={qrCodeUrl} alt="Pairing QR code for phone scanner" className="h-48 w-48" />}
            </div>
            <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${paired ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-white/[0.08] text-slate-400"}`} role="status">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${paired ? "bg-emerald-400" : "bg-cyan-400"}`}/>
                <span className={`relative inline-flex h-2 w-2 rounded-full ${paired ? "bg-emerald-400" : "bg-cyan-400"}`}/>
              </span>
              {paired ? "Phone connected" : "Waiting for phone..."}
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">Open your phone camera and point it at the code. No sign-in needed.</p>
            <div className="mt-2 flex flex-col items-center gap-1">
              <a
                href="/scan/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 py-1 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10"
              >
                Open Scanner Dashboard <ExternalLink className="h-3 w-3" />
              </a>
              {pairingUrl && (
                <a href={pairingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-400">
                  Legacy web scanner <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex min-h-[18rem] flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-caps">Live Queue</span>
              <span className="font-mono text-[11px] text-slate-500">{detections.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
              {detections.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
                  <Smartphone className="h-7 w-7 text-slate-600" />
                  <p className="text-xs text-slate-500">Cards you scan will appear here instantly.</p>
                </div>
              ) : (
                detections.map((d, i) => (
                  <div key={`${d.timestamp}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs animate-fade-in">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{d.cardName || d.rawText}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="font-mono">{d.setPrefix ? `${d.setPrefix} #${d.collectorNumber}` : "Unrecognized"}</span>
                        <span className="flex items-center gap-1 font-mono text-cyan-300/80"><Wifi className="h-2.5 w-2.5" />{Math.round(d.confidence * 100)}%</span>
                      </div>
                    </div>
                    {d.confirmed ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300"><Check className="h-3.5 w-3.5" /> Added</span>
                    ) : d.editionId ? (
                      <button onClick={() => confirmCards([i])} disabled={confirming} className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-all hover:border-cyan-400/40 hover:text-cyan-200 active:scale-95">
                        Add
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-300">No match</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
