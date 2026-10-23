"use client";

import { useMemo } from "react";
import {
  isSignalPayload,
  type FeedSignaling,
  type IceServerConfig,
  type SeatId,
  type TableRole,
} from "@ga/contracts";
import { useFeedReceiver } from "./use-feed-receiver";
import { useIceServers } from "./use-ice-servers";
import { HANDSHAKE_ERROR_CODES } from "./table-errors";
import { useTableSocket } from "./use-table-socket";

const EMPTY_ICE_SERVERS: IceServerConfig[] = [];

export interface UseTableFeedOptions {
  code: string;
  token: string;
  seat: SeatId;
  role?: TableRole;
}

/**
 * The socket plus the opponent Feed for one Seat. The receiving desktop offers
 * and the opponent's Capture Device answers; this Seat never renders its own
 * camera. Shared by the Table and the control-free `/stage` surface.
 */
export function useTableFeed({ code, token, seat, role = "seat" }: UseTableFeedOptions) {
  const socket = useTableSocket({ code, token, role });
  const { state, status, send, subscribeSignal } = socket;
  const iceServers = useIceServers();
  const otherSeat: SeatId = seat === "p1" ? "p2" : "p1";
  const blockingError = state.error !== null && HANDSHAKE_ERROR_CODES.has(state.error.code);

  const signaling = useMemo<FeedSignaling>(
    () => ({
      send: (payload) =>
        send({
          type: "SIGNAL",
          to: { seat: otherSeat, role: "capture" },
          data: payload,
        }),
      onSignal: (handler) =>
        subscribeSignal((from, data) => {
          if (from.seat === otherSeat && from.role === "capture" && isSignalPayload(data)) {
            handler(data);
          }
        }),
    }),
    [otherSeat, send, subscribeSignal]
  );

  const opponentCapture = state.participants.some(
    (participant) => participant.seat === otherSeat && participant.role === "capture"
  );
  const localCapture = state.participants.some(
    (participant) => participant.seat === seat && participant.role === "capture"
  );
  const remoteStream = useFeedReceiver({
    enabled: status === "open" && !blockingError && iceServers !== null && opponentCapture,
    signaling,
    iceServers: iceServers ?? EMPTY_ICE_SERVERS,
  });

  return {
    ...socket,
    iceServers,
    otherSeat,
    blockingError,
    opponentCapture,
    localCapture,
    remoteStream,
  };
}
