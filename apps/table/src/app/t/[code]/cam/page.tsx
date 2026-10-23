"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CameraPublisher } from "@/components/table/camera-publisher";
import { useTranslation } from "@/lib/i18n";
import {
  browserStorage,
  parseSeatSession,
  readSeatSession,
  type SeatSession,
} from "@/lib/table-session";
import { useCamera } from "@/lib/use-camera";
import { useIceServers } from "@/lib/use-ice-servers";
import { useTrackMuted } from "@/lib/use-track-muted";
import { useWakeLock } from "@/lib/use-wake-lock";

function CameraShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-3 p-3 md:p-5">
      {children}
    </main>
  );
}

function LoadingPage() {
  const { t } = useTranslation();
  return (
    <CameraShell>
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </CameraShell>
  );
}

function NoSeat({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <CameraShell>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("table.cameraTitle")}</h1>
        <span className="font-mono text-sm text-muted-foreground">{code}</span>
      </header>
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{t("table.noSeatTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("table.noSeatHint")}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("table.backHome")}
        </Link>
      </section>
    </CameraShell>
  );
}

function CameraScreen({ code, session }: { code: string; session: SeatSession }) {
  const { t } = useTranslation();
  const { stream, status, retry } = useCamera();
  const wakeLock = useWakeLock();
  const iceServers = useIceServers();
  const localAsleep = useTrackMuted(stream);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wakeLockLabel =
    wakeLock === "active"
      ? t("table.cameraWakeLockOn")
      : wakeLock === "requesting"
        ? t("table.cameraWakeLockRequesting")
        : t("table.cameraWakeLockUnavailable");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <CameraShell>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold">{t("table.cameraTitle")}</h1>
          <span className="text-sm text-muted-foreground">
            {t("table.roomCode")}: <span className="font-mono">{code}</span>
          </span>
        </div>
      </header>

      <section className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={t("table.cameraTitle")}
              className="h-full w-full object-contain"
            />
            {localAsleep && (
              <div
                role="status"
                className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-amber-400/95 px-3 py-1 text-xs font-medium text-black"
              >
                <span className="h-2 w-2 rounded-full bg-black/70" aria-hidden="true" />
                {t("table.cameraAsleep")}
              </div>
            )}
          </>
        ) : status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-white">{t("table.cameraUnavailableTitle")}</p>
            <p className="max-w-sm text-xs text-white/60">
              {t("table.cameraUnavailableHint")}
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
            >
              {t("table.cameraRetry")}
            </button>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-white/70">{t("table.cameraRequesting")}</p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{wakeLockLabel}</span>
        {stream && <span>{t("table.cameraHint")}</span>}
      </div>

      {stream && iceServers ? (
        <CameraPublisher code={code} session={session} stream={stream} iceServers={iceServers} />
      ) : stream ? (
        <p className="text-xs text-muted-foreground">{t("table.connecting")}</p>
      ) : null}
    </CameraShell>
  );
}

function CameraPageContent() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = String(params?.code ?? "").toUpperCase();
  const [session, setSession] = useState<SeatSession | null>(() => parseSeatSession(search));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = parseSeatSession(search);
    if (fromUrl) {
      setSession((current) =>
        current && current.seat === fromUrl.seat && current.token === fromUrl.token
          ? current
          : fromUrl
      );
    } else if (!session) {
      const resolved = readSeatSession(code, search, browserStorage());
      if (resolved) setSession(resolved);
    }
    setReady(true);
  }, [code, search, session]);

  if (!ready && !session) return <LoadingPage />;
  if (!session) return <NoSeat code={code} />;

  return (
    <CameraScreen
      key={`${code}:${session.seat}:${session.token}`}
      code={code}
      session={session}
    />
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <CameraPageContent />
    </Suspense>
  );
}
