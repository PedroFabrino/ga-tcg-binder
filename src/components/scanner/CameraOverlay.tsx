"use client";

import { Camera, Loader2 } from "lucide-react";
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
  const { videoRef, metrics, error, cvReady, capture } = useScannerCamera({ enabled, onAutoCapture: onCapture });
  const verdict = metrics?.verdict ?? "no_card";
  const locked = verdict === "ready" || (metrics?.stableFrames ?? 0) > 0;

  const snap = async () => {
    const c = await capture("manual");
    if (c) onCapture(c);
  };

  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} playsInline muted className="h-[70vh] w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`h-[84%] rounded-lg border-2 transition-colors ${locked ? "border-emerald-400" : "border-white/70"}`}
          style={{ aspectRatio: String(CARD_ASPECT), boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
        />
      </div>
      <div className="absolute inset-x-0 top-3 text-center text-sm font-medium text-white drop-shadow">
        {!cvReady ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing scanner…
          </span>
        ) : (
          metrics?.hint ?? "Align the card inside the guide"
        )}
      </div>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <Button size="lg" className="h-16 w-16 rounded-full" onClick={snap} aria-label="Capture card">
          <Camera className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
