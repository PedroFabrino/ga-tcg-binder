"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Ripple } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import { useTrackMuted } from "@/lib/use-track-muted";

export interface FeedPanelProps {
  /** The opponent's stream; null until their Capture Device answers. */
  stream: MediaStream | null;
  /** True while the opponent's Capture Device is connected to the Table. */
  capturePresent: boolean;
  /** Live pointer markers from both Seats. */
  ripples: Ripple[];
  /** True when this Seat may drop a marker (a connected Seat). */
  canRipple: boolean;
  onRipple: (x: number, y: number) => void;
}

/**
 * The opponent's Feed. It never renders the local camera: a Seat's own Feed is
 * only the preview on its Capture Device.
 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function FeedPanel({
  stream,
  capturePresent,
  ripples,
  canRipple,
  onRipple,
}: FeedPanelProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const asleep = useTrackMuted(stream);
  // Key the frame flag by stream so a replacement Feed shows "connecting"
  // immediately instead of flashing the asleep badge over a blank video.
  const [frameStream, setFrameStream] = useState<MediaStream | null>(null);
  const hasFrame = stream !== null && frameStream === stream;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const connecting = stream !== null && !hasFrame;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!canRipple) return;
    const feed = feedRef.current;
    if (!feed) return;
    const rect = feed.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    onRipple(
      clamp01((event.clientX - rect.left) / rect.width),
      clamp01((event.clientY - rect.top) / rect.height)
    );
  }

  return (
    <section
      aria-labelledby="feed-title"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="border-b border-border px-4 py-2">
        <h2 id="feed-title" className="text-sm font-semibold">
          {t("table.feedTitle")}
        </h2>
      </header>
      <div
        ref={feedRef}
        onClick={handleClick}
        title={canRipple ? t("table.rippleHint") : undefined}
        className={`relative aspect-video bg-black ${canRipple ? "cursor-crosshair" : ""}`}
      >
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={t("table.feedTitle")}
              className="h-full w-full object-contain"
              onLoadedData={() => setFrameStream(stream)}
              onPlaying={() => setFrameStream(stream)}
            />
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center">
                <p className="text-sm font-medium text-white/80">{t("table.feedConnecting")}</p>
              </div>
            )}
            {asleep && hasFrame && (
              <div
                role="status"
                className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-amber-400/95 px-3 py-1 text-xs font-medium text-black"
              >
                <span className="h-2 w-2 rounded-full bg-black/70" aria-hidden="true" />
                {t("table.cameraAsleep")}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-white/80">
              {capturePresent ? t("table.feedConnecting") : t("table.feedEmpty")}
            </p>
            {!capturePresent && (
              <p className="max-w-sm text-xs text-white/50">{t("table.feedEmptyHint")}</p>
            )}
          </div>
        )}
        {ripples.map((ripple) => (
          <span
            key={`${ripple.seat}-${ripple.n}-${ripple.at}`}
            role="img"
            aria-label={t("table.rippleMarker", { number: ripple.n })}
            className="pointer-events-none absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-sky-500/90 text-xs font-bold text-white shadow-lg"
            style={{ left: `${ripple.x * 100}%`, top: `${ripple.y * 100}%` }}
          >
            {ripple.n}
          </span>
        ))}
      </div>
    </section>
  );
}
