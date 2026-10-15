import { create } from "zustand";
import type { ScanSession, SessionState } from "../types/session";

/**
 * UI-only placeholder: transitions are simulated with timers so every screen can be exercised.
 * Replace `pair` / `disconnect` and the latency ticker with the real WebSocket session.
 */
interface SessionStore {
  status: SessionState;
  session: ScanSession | null;
  latencyMs: number | null;
  reconnectAttempt: number;
  error: string | null;
  pair: (sessionId: string, desktopName?: string) => void;
  simulatePairing: () => void;
  disconnect: () => void;
  clearError: () => void;
}

let ticker: ReturnType<typeof setInterval> | null = null;
const stopTicker = () => {
  if (ticker) clearInterval(ticker);
  ticker = null;
};

export const useSessionStore = create<SessionStore>((set, get) => {
  const activate = (sessionId: string, desktopName: string) => {
    set({ status: "ACTIVE_SCANNING", session: { sessionId, desktopName, pairedAt: Date.now() }, latencyMs: 24, error: null });
    stopTicker();
    ticker = setInterval(() => {
      if (get().status === "ACTIVE_SCANNING") set({ latencyMs: 18 + Math.round(Math.random() * 40) });
    }, 3000);
  };

  return {
    status: "DISCONNECTED",
    session: null,
    latencyMs: null,
    reconnectAttempt: 0,
    error: null,

    pair: (sessionId, desktopName = "Desktop Binder") => {
      if (get().status === "CONNECTING") return;
      set({ status: "CONNECTING", error: null });
      setTimeout(() => {
        if (get().status === "CONNECTING") activate(sessionId, desktopName);
      }, 900);
    },

    simulatePairing: () => activate(`sess_${Math.random().toString(36).slice(2, 8)}`, "Simulated Desktop"),

    disconnect: () => {
      stopTicker();
      set({ status: "DISCONNECTED", session: null, latencyMs: null, reconnectAttempt: 0 });
    },

    clearError: () => set({ error: null }),
  };
});
