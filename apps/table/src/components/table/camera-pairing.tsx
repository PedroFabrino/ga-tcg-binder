"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { SeatId } from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import { tableCameraPath, tableCameraUrl } from "@/lib/table-links";

export interface CameraPairingProps {
  code: string;
  seat: SeatId;
  token: string;
  /** True when this Seat already has a Capture Device connected. */
  connected: boolean;
}

/**
 * Pairs the local Seat's phone. The QR carries the local Seat token, never the
 * opponent's; the phone joins as `role: capture`, so it cannot displace the
 * desktop Seat. The same link opens a desktop webcam in a new tab.
 */
export function CameraPairing({ code, seat, token, connected }: CameraPairingProps) {
  const { t } = useTranslation();
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const path = tableCameraPath(code, seat, token);

  useEffect(() => {
    let cancelled = false;
    const url = tableCameraUrl(window.location.origin, code, seat, token);
    setCameraUrl(url);

    QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: { dark: "#070a11", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, seat, token]);

  return (
    <section
      aria-labelledby="camera-title"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="camera-title" className="text-sm font-semibold">
        {t("table.cameraPanelTitle")}
      </h2>
      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden="true"
          className={
            connected
              ? "h-2 w-2 rounded-full bg-emerald-500"
              : "h-2 w-2 rounded-full bg-muted-foreground"
          }
        />
        {connected ? t("table.cameraConnected") : t("table.cameraPairHint")}
      </p>

      <div className="mt-3 flex flex-col items-center gap-2">
        {qr && (
          <img
            src={qr}
            alt={t("table.cameraQrAlt")}
            width={176}
            height={176}
            className="h-44 w-44 rounded bg-white p-2"
          />
        )}
        {cameraUrl && (
          <code className="max-w-full break-all text-center text-[10px] leading-tight text-muted-foreground">
            {cameraUrl}
          </code>
        )}
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          {t("table.cameraOpen")}
        </a>
      </div>
    </section>
  );
}
