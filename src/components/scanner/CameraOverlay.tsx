"use client";

import { useEffect, useState } from "react";
import { Camera, Loader2, RefreshCw, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARD_ASPECT } from "@/lib/scanner/contracts";
import type { NormalizedCapture } from "@/lib/scanner/warp";
import { useScannerCamera } from "@/hooks/useScannerCamera";
import { getDebugLogs, subscribeDebugLogs, type LogEntry } from "@/lib/scanner/debug-client";

interface Props {
  enabled?: boolean;
  onCapture: (capture: NormalizedCapture) => void;
  onToggleLogs?: () => void;
}

/** Stage 1/2/3 UI: rear-camera feed, 2.5:3.5 guide, live hints, auto-capture + manual shutter. */
export function CameraOverlay({ enabled = true, onCapture, onToggleLogs }: Props) {
  const {
    videoRef,
    metrics,
    error,
    cameraReady,
    cvReady,
    cameraStage,
    permissionDenied,
    requestCamera,
    capture,
  } = useScannerCamera({ enabled, onAutoCapture: onCapture });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    setLogs(getDebugLogs());
    return subscribeDebugLogs((updated) => setLogs(updated));
  }, []);

  const verdict = metrics?.verdict ?? "no_card";
  const locked = verdict === "ready" || (metrics?.stableFrames ?? 0) > 0;

  const snap = async () => {
    const c = await capture("manual");
    if (c) onCapture(c);
  };

  if (error || permissionDenied) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center rounded-xl bg-slate-900 p-6 text-center text-slate-200">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <Camera className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Camera Access Required</h3>
        <p className="mb-6 max-w-xs text-sm text-slate-400">
          {error || "Please allow camera access in your browser to scan physical cards."}
        </p>
        <Button onClick={requestCamera} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
          <RefreshCw className="h-4 w-4" /> Grant Camera Permission
        </Button>

        {/* Diagnostic logs */}
        <div className="mt-8 w-full text-left">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200"
          >
            <Terminal className="h-3.5 w-3.5" />
            Diagnostics ({logs.length} events)
            {showLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showLogs && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded bg-black/60 p-2 font-mono text-[11px] text-slate-300">
              {logs.map((l, i) => (
                <div key={i} className={`py-0.5 ${l.level === "error" ? "text-rose-400" : l.level === "warn" ? "text-amber-400" : ""}`}>
                  <span className="text-slate-500">[{l.time}]</span> [{l.stage}] {l.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="h-[70vh] w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`h-[84%] rounded-lg border-2 transition-colors ${
            locked ? "border-emerald-400" : "border-white/70"
          }`}
          style={{ aspectRatio: String(CARD_ASPECT), boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
        />
      </div>

      {/* Top status bar */}
      <div className="absolute inset-x-0 top-3 z-10 px-4 flex items-center justify-between text-sm font-medium text-white drop-shadow">
        <div className="flex-1 text-center">
          {!cameraReady ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera ({cameraStage})…
            </span>
          ) : (
            metrics?.hint ?? "Align the card inside the guide"
          )}
        </div>

        {/* Small debug toggle */}
        <button
          type="button"
          onClick={() => {
            if (onToggleLogs) onToggleLogs();
            else setShowLogs((s) => !s);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 p-2 text-white/80 backdrop-blur hover:bg-black/70 hover:text-white active:scale-95"
          title="Toggle Diagnostics"
          aria-label="Toggle Diagnostics"
        >
          <Terminal className="h-4 w-4" />
        </button>
      </div>

      {/* Live in-screen debug log overlay */}
      {showLogs && (
        <div className="absolute inset-x-2 top-12 z-20 max-h-48 overflow-y-auto rounded-lg bg-black/85 p-2 font-mono text-[10px] text-slate-300 shadow-xl backdrop-blur">
          <div className="mb-1 font-bold text-slate-400 flex justify-between">
            <span>LIVE SCANNER TELEMETRY</span>
            <span className="text-emerald-400">Stage: {cameraStage}</span>
          </div>
          {logs.map((l, i) => (
            <div key={i} className={`py-0.5 ${l.level === "error" ? "text-rose-400" : l.level === "warn" ? "text-amber-400" : ""}`}>
              <span className="text-slate-500">[{l.time}]</span> [{l.stage}] {l.message}
            </div>
          ))}
        </div>
      )}

      {/* Shutter button */}
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <Button
          size="lg"
          disabled={!cameraReady}
          className="h-16 w-16 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
          onClick={snap}
          aria-label="Capture card"
        >
          <Camera className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
