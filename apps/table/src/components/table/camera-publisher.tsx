"use client";

import { useEffect, useMemo } from "react";
import {
  isSignalPayload,
  type FeedSignaling,
  type IceServerConfig,
  type SeatId,
  type TranslationKey,
} from "@ga/contracts";
import { useTranslation } from "@/lib/i18n";
import type { SeatSession } from "@/lib/table-session";
import { useTableSocket } from "@/lib/use-table-socket";
import { FeedConnection } from "@/lib/webrtc";

const MAX_VIDEO_BITRATE = 2_500_000;

const CAMERA_ERROR_KEYS: Record<string, TranslationKey> = {
  INVALID_TOKEN: "table.errors.invalidToken",
  WRONG_CODE: "table.errors.wrongCode",
  NO_SUCH_TABLE: "table.errors.noSuchTable",
  NO_TARGET: "table.errors.noTarget",
};

function cameraErrorKey(code: string): TranslationKey {
  return CAMERA_ERROR_KEYS[code] ?? "table.errors.generic";
}

export interface CameraPublisherProps {
  code: string;
  session: SeatSession;
  stream: MediaStream;
  iceServers: IceServerConfig[];
}

/**
 * The Capture Device's signaling socket. It joins only after the camera and ICE
 * servers are ready, so the receiver's offer always has an answerer waiting,
 * and it targets the opponent's Seat only.
 */
export function CameraPublisher({ code, session, stream, iceServers }: CameraPublisherProps) {
  const { t } = useTranslation();
  const { state, status, send, subscribeSignal, reconnect } = useTableSocket({
    code,
    token: session.token,
    role: "capture",
  });
  const otherSeat: SeatId = session.seat === "p1" ? "p2" : "p1";

  const signaling = useMemo<FeedSignaling>(
    () => ({
      send: (payload) =>
        send({
          type: "SIGNAL",
          to: { seat: otherSeat, role: "seat" },
          data: payload,
        }),
      onSignal: (handler) =>
        subscribeSignal((from, data) => {
          if (from.seat === otherSeat && from.role === "seat" && isSignalPayload(data)) {
            handler(data);
          }
        }),
    }),
    [otherSeat, send, subscribeSignal]
  );

  useEffect(() => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    track.contentHint = "detail";
    const connection = new FeedConnection({
      role: "publisher",
      signaling,
      iceServers,
      maxVideoBitrate: MAX_VIDEO_BITRATE,
    });
    connection.addTrack(track, stream);

    return () => connection.close();
  }, [iceServers, signaling, stream]);

  const opponentPresent = state.participants.some(
    (participant) => participant.seat === otherSeat && participant.role === "seat"
  );
  const label =
    status === "open"
      ? opponentPresent
        ? t("table.cameraReady")
        : t("table.cameraWaitingOpponent")
      : status === "connecting"
        ? t("table.connecting")
        : t("table.disconnected");
  const dotClass =
    status === "open"
      ? opponentPresent
        ? "h-2 w-2 rounded-full bg-emerald-500"
        : "h-2 w-2 rounded-full bg-amber-400"
      : status === "connecting"
        ? "h-2 w-2 rounded-full bg-muted-foreground"
        : "h-2 w-2 rounded-full bg-destructive";

  return (
    <section className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={dotClass} />
          {label}
        </span>
        {status === "closed" && (
          <button
            type="button"
            onClick={reconnect}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            {t("table.reconnect")}
          </button>
        )}
      </div>
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {t(cameraErrorKey(state.error.code))}
        </p>
      )}
    </section>
  );
}
