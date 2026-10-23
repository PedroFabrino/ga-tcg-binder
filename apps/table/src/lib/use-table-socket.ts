"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  isTableServerMessage,
  type SeatId,
  type SeatState,
  type SignalTarget,
  type TableClientMessage,
  type TableRole,
} from "@ga/contracts";
import { tableWebSocketUrl } from "./gateway";
import {
  initialTableClientState,
  tableClientActionFromMessage,
  tableClientReducer,
  type TableClientState,
} from "./table-reducer";

export type TableConnectionStatus = "connecting" | "open" | "closed";

/** Errors that a blind reconnect would make worse (e.g. stealing back a displaced Seat). */
const FATAL_RECONNECT_ERRORS = new Set([
  "DISPLACED",
  "INVALID_TOKEN",
  "WRONG_CODE",
  "NO_SUCH_TABLE",
]);

/** Exponential backoff capped at 15s, exported for a fast unit test. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 15_000);
}

/** A direct SIGNAL subscription for the Feed manager; React state is too lossy for SDP. */
export type SignalListener = (from: SignalTarget, data: unknown) => void;

export interface UseTableSocketOptions {
  code: string;
  token: string;
  role: TableRole;
}

export interface UseTableSocketResult {
  state: TableClientState;
  status: TableConnectionStatus;
  send: (message: TableClientMessage) => void;
  patchSeat: (seat: SeatId, patch: Partial<SeatState>) => void;
  reconnect: () => void;
  subscribeSignal: (listener: SignalListener) => () => void;
}

/**
 * One Table socket for this tab. It sends the HELLO on open, folds every server
 * message into the pure reducer, and exposes a manual reconnect. Reconnect is
 * also the Seat take-over action: the newest connection wins (ADR 0002, spec
 * §6.1), so a displaced tab can reclaim its Seat by reconnecting.
 */
export function useTableSocket(options: UseTableSocketOptions): UseTableSocketResult {
  const { code, token, role } = options;
  const [state, dispatch] = useReducer(tableClientReducer, initialTableClientState);
  const [status, setStatus] = useState<TableConnectionStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const signalListenersRef = useRef(new Set<SignalListener>());
  const lastErrorRef = useRef<{ code: string } | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribeSignal = useCallback((listener: SignalListener) => {
    signalListenersRef.current.add(listener);
    return () => {
      signalListenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("closed");
      return;
    }
    let socket: WebSocket;
    try {
      socket = new WebSocket(tableWebSocketUrl(code));
    } catch {
      setStatus("closed");
      return;
    }
    socketRef.current = socket;
    setStatus("connecting");

    const handleOpen = () => {
      setStatus("open");
      retryCountRef.current = 0;
      const hello: TableClientMessage = {
        type: "TABLE_HELLO",
        code: code.toUpperCase(),
        token,
        role,
      };
      socket.send(JSON.stringify(hello));
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isTableServerMessage(parsed)) return;
      if (parsed.type === "TABLE_ERROR") {
        lastErrorRef.current = { code: parsed.code };
      }
      if (parsed.type === "SIGNAL") {
        // Deliver SDP and ICE directly. The reducer keeps only the last signal,
        // so an effect keyed on React state would drop a burst of candidates.
        signalListenersRef.current.forEach((listener) => {
          try {
            listener(parsed.from, parsed.data);
          } catch (error) {
            console.warn("[table] signal listener failed", error);
          }
        });
      }
      const action = tableClientActionFromMessage(parsed);
      if (action) dispatch(action);
    };

    const handleClose = () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      setStatus("closed");

      // Network loss reconnects on its own. A displaced or invalid Seat stays
      // closed until the player explicitly takes over or fixes the link.
      if (lastErrorRef.current && FATAL_RECONNECT_ERRORS.has(lastErrorRef.current.code)) {
        return;
      }
      const delay = reconnectDelayMs(retryCountRef.current);
      retryCountRef.current += 1;
      retryTimerRef.current = setTimeout(() => setAttempt((value) => value + 1), delay);
    };

    const handleError = () => {
      // The browser follows `error` with `close`; connection state lives there.
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      socketRef.current = null;
      socket.close();
    };
  }, [code, token, role, attempt]);

  const send = useCallback((message: TableClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const patchSeat = useCallback((seat: SeatId, patch: Partial<SeatState>) => {
    dispatch({ type: "PATCH", seat, patch });
  }, []);

  const reconnect = useCallback(() => {
    lastErrorRef.current = null;
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    dispatch({ type: "CLEAR_ERROR" });
    setAttempt((value) => value + 1);
  }, []);

  return { state, status, send, patchSeat, reconnect, subscribeSignal };
}
