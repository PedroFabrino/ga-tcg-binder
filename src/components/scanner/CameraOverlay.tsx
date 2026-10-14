"use client";

import { Camera, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARD_ASPECT } from "@/lib/scanner/contracts";
import type { NormalizedCapture } from "@/lib/scanner/warp";
import { useScannerCamera } from "@/hooks/useScannerCamera";

interface Props {
  enabled?: boolean;
  onCapture: (capture: NormalizedCapture) => void;
}

/** Stage 1/2/3 UI: rear-camera feed, 2.5:3.5 guide, live hints, auto-capture + manual shutter. */
export function CameraOverlay({ enabled = true, onCapture }: Props) {
  const {
    videoRef,
    metrics,
    error,
    cameraReady,
    cvReady,
    permissionDenied,
    requestCamera,
    capture,
  } = useScannerCamera({ enabled, onAutoCapture: onCapture });

  const verdict = metrics?.verdict ?? "no_card";
  const locked = verdict === "ready" || (metrics?.stableFrames ?? 0) > 0;

  const snap = async () => {
    const c = await capture("manual");
    if (c) onCapture(c);
  };

  if (error || permissionDenied) {
    return (
      <div className="mx-auto flex h-[70vh] w-full max-w-md flex-col items-center justify-center rounded-xl bg-slate-900 p-6 text-center text-slate-200">
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

      <div className="absolute inset-x-0 top-3 text-center text-sm font-medium text-white drop-shadow">
        {!cameraReady ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
          </span>
        ) : !cvReady ? (
          <span className="inline-flex items-center gap-2 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Preparing card detector…
          </span>
        ) : (
          metrics?.hint ?? "Align the card inside the guide"
        )}
      </div>

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
