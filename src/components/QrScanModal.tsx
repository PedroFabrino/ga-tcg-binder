"use client";

import { useEffect, useState } from "react";
import { X, QrCode, Smartphone, Check, Loader2, RefreshCw } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [confirming, setConfirming] = useState(false);

  // Initialize session
  useEffect(() => {
    let active = true;

    async function initSession() {
      try {
        setLoading(true);
        const res = await fetch("/api/scanner/session", { method: "POST" });
        const data = await res.json();
        if (active && data.token) {
          setToken(data.token);
          setQrCodeUrl(data.qrCodeDataUrl);
          setPairingUrl(data.pairingUrl);
        }
      } catch (err) {
        console.error("Failed to init scanner session:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    initSession();

    return () => {
      active = false;
    };
  }, []);

  // Poll for detections
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scanner/session/${token}`);
        if (res.ok) {
          const data = await res.json();
          if (data.detections) {
            setDetections(data.detections);
          }
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [token]);

  const confirmCards = async (indices: number[]) => {
    if (!token || indices.length === 0) return;
    try {
      setConfirming(true);
      const res = await fetch("/api/scanner/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, indices }),
      });
      if (res.ok) {
        // Refresh session
        const sessRes = await fetch(`/api/scanner/session/${token}`);
        const sessData = await sessRes.json();
        if (sessData.detections) {
          setDetections(sessData.detections);
        }
      }
    } catch (err) {
      console.error("Confirm error:", err);
    } finally {
      setConfirming(false);
    }
  };

  const unconfirmedIndices = detections
    .map((d, idx) => (!d.confirmed && d.editionId ? idx : -1))
    .filter((idx) => idx !== -1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">QR-Paired Mobile Scanner</h2>
            <p className="text-xs text-slate-400">
              Scan with your phone camera to stream card detections directly onto this screen.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-400">Generating temporary pairing token...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-4">
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="Scanner Pairing QR Code"
                  className="h-52 w-52 rounded-lg bg-white p-2 shadow-inner"
                />
              )}
              <p className="mt-3 text-center text-xs text-slate-400">
                Point phone camera at this QR code. No login required on mobile.
              </p>
              {pairingUrl && (
                <a
                  href={pairingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 text-xs text-indigo-400 underline hover:text-indigo-300"
                >
                  Or open mobile scanner test tab ↗
                </a>
              )}
            </div>

            <div className="flex flex-col h-72">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Live Detections ({detections.length})
                </span>
                {unconfirmedIndices.length > 0 && (
                  <button
                    disabled={confirming}
                    onClick={() => confirmCards(unconfirmedIndices)}
                    className="flex items-center space-x-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    <span>Confirm All ({unconfirmedIndices.length})</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-2">
                {detections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <QrCode className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500">
                      Waiting for incoming card frames from paired device...
                    </p>
                  </div>
                ) : (
                  detections.map((det, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">
                          {det.cardName || det.rawText}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {det.setPrefix ? `${det.setPrefix} ${det.collectorNumber}` : "Detected Code"}
                          {" • "}
                          <span className="text-indigo-400 font-mono">
                            {(det.confidence * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>

                      {det.confirmed ? (
                        <span className="flex items-center space-x-1 text-emerald-400 text-xs font-medium">
                          <Check className="h-3.5 w-3.5" />
                          <span>Added</span>
                        </span>
                      ) : det.editionId ? (
                        <button
                          disabled={confirming}
                          onClick={() => confirmCards([index])}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          + Add
                        </button>
                      ) : (
                        <span className="text-amber-400 text-[11px]">Unmatched</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
