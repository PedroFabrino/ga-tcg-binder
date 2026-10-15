"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Loader2, Terminal, X, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CameraOverlay } from "@/components/scanner/CameraOverlay";
import { CandidateList } from "@/components/scanner/CandidateList";
import { RapidScanDrawer, type QueuedScan } from "@/components/scanner/RapidScanDrawer";
import type { CardMatchResult, CardVariant } from "@/lib/scanner/contracts";
import { extractFeatures } from "@/lib/scanner/extract";
import type { NormalizedCapture } from "@/lib/scanner/warp";
import { getDebugLogs, logScanner, subscribeDebugLogs, type LogEntry } from "@/lib/scanner/debug-client";

const RAPID_THRESHOLD = 90;
const AUTO_COOLDOWN_MS = 2500;

async function postJson(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/** Mobile paired scanner: no login, results sync to the desktop session via the token. */
export default function MobileScanPage() {
  const token = (useParams()?.token as string) || "";
  const [rapid, setRapid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<CardMatchResult[] | null>(null);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);
  const cooldownUntil = useRef(0);

  useEffect(() => {
    setLogs(getDebugLogs());
    return subscribeDebugLogs((updated) => setLogs(updated));
  }, []);

  const enqueue = useCallback(
    async (candidate: CardMatchResult, variant: CardVariant) => {
      const { item } = await postJson("/api/scanner/queue", "POST", {
        token,
        editionId: candidate.editionId,
        foil: variant === "foil",
        confidence: candidate.confidence,
      });
      setQueue((q) => [...q, { key: item.timestamp, candidate, variant }]);
    },
    [token]
  );

  const handleCapture = useCallback(
    async (capture: NormalizedCapture) => {
      if (busyRef.current) return;
      if (capture.source === "auto" && Date.now() < cooldownUntil.current) return;
      busyRef.current = true;
      setBusy(true);
      setError("");

      logScanner("handle_capture", `Frame capture received (source: ${capture.source})`);

      try {
        const payload = await extractFeatures(capture.canvas, capture.blob, capture.source);
        logScanner("identify_send", "Requesting match from server", { phash: payload.phash });

        const { candidates: found } = await postJson("/api/scanner/identify", "POST", {
          token,
          phash: payload.phash,
          headerText: payload.ocr.headerText,
          footerText: payload.ocr.footerText,
        });

        logScanner("identify_done", `Match completed: ${found?.length ?? 0} candidates`, {
          topCandidate: found?.[0]?.cardName,
          confidence: found?.[0]?.confidence,
        });

        const top: CardMatchResult | undefined = found[0];
        if (rapid && top && top.confidence >= RAPID_THRESHOLD) {
          logScanner("rapid_enqueue", `Enqueuing ${top.cardName} (${top.confidence}%)`);
          await enqueue(top, "normal");
        } else {
          setCandidates(found);
        }
      } catch (e: any) {
        logScanner("identify_error", `Identification failed: ${e.message}`, { error: e }, "error");
        setError(e.message);
      } finally {
        cooldownUntil.current = Date.now() + AUTO_COOLDOWN_MS;
        busyRef.current = false;
        setBusy(false);
      }
    },
    [token, rapid, enqueue]
  );

  const select = async (c: CardMatchResult, variant: CardVariant) => {
    try {
      await enqueue(c, variant);
      setCandidates(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const undo = async (key: number) => {
    await postJson("/api/scanner/queue", "PATCH", { token, timestamp: key, remove: true }).catch((e) => setError(e.message));
    setQueue((q) => q.filter((i) => i.key !== key));
  };

  const changeVariant = async (key: number, variant: CardVariant) => {
    await postJson("/api/scanner/queue", "PATCH", { token, timestamp: key, foil: variant === "foil" }).catch((e) =>
      setError(e.message)
    );
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, variant } : i)));
  };

  return (
    <main className="min-h-screen bg-slate-950 p-3 pb-40 text-slate-200">
      <div className="mx-auto flex max-w-md items-center justify-between py-2">
        <h1 className="text-base font-semibold">Card Scanner</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-300">
            <Zap className="h-3.5 w-3.5 text-amber-300" /> Rapid
            <Switch checked={rapid} onCheckedChange={setRapid} />
          </label>
          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            title="Toggle Diagnostics"
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span>Logs</span>
          </button>
        </div>
      </div>

      {candidates ? (
        <CandidateList candidates={candidates} onSelect={select} onRetake={() => setCandidates(null)} />
      ) : (
        <CameraOverlay onCapture={handleCapture} onToggleLogs={() => setShowLogs((s) => !s)} />
      )}

      {busy && (
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Identifying…
        </p>
      )}
      {error && <p className="mt-3 text-center text-sm text-rose-400">{error}</p>}

      {/* Floating Diagnostics Dialog */}
      {showLogs && (
        <div className="fixed inset-x-2 top-14 z-50 max-h-[65vh] overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Terminal className="h-4 w-4" /> Scanner Telemetry ({logs.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 max-h-[50vh] space-y-1 overflow-y-auto font-mono text-[10px]">
            {logs.length === 0 ? (
              <p className="py-2 text-center text-slate-500">No events logged yet.</p>
            ) : (
              logs.map((l, i) => (
                <div
                  key={i}
                  className={`rounded p-1 ${
                    l.level === "error"
                      ? "bg-rose-950/40 text-rose-300"
                      : l.level === "warn"
                      ? "bg-amber-950/40 text-amber-300"
                      : "text-slate-300"
                  }`}
                >
                  <span className="text-slate-500">[{l.time}]</span>{" "}
                  <span className="font-bold text-slate-400">[{l.stage}]</span> {l.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <RapidScanDrawer items={queue} onUndo={undo} onChangeVariant={changeVariant} />
    </main>
  );
}
