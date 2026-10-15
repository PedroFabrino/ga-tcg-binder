import { create } from "zustand";
import type { ScanSession, SessionState, PairingPayload } from "../types/session";
import { MobileWsClient } from "../lib/wsClient";

interface SessionStore {
  status: SessionState;
  session: ScanSession | null;
  pairingPayload: PairingPayload | null;
  latencyMs: number | null;
  reconnectAttempt: number;
  error: string | null;
  pair: (payload: PairingPayload) => void;
  simulatePairing: () => void;
  disconnect: () => void;
  clearError: () => void;
}

let activeWsClient: MobileWsClient | null = null;

export function getActiveWsClient(): MobileWsClient | null {
  return activeWsClient;
}

export const useSessionStore = create<SessionStore>((set, get) => {
  return {
    status: "DISCONNECTED",
    session: null,
    pairingPayload: null,
    latencyMs: null,
    reconnectAttempt: 0,
    error: null,

    pair: (payload: PairingPayload) => {
      if (get().status === "CONNECTING") return;
      set({ status: "CONNECTING", pairingPayload: payload, error: null });

      if (activeWsClient) {
        activeWsClient.disconnect();
      }

      activeWsClient = new MobileWsClient({
        onStatusChange: (status, desktopName) => {
          set((s) => ({
            status,
            session:
              status === "ACTIVE_SCANNING"
                ? {
                    sessionId: payload.sessionId,
                    desktopName: desktopName || "Desktop Receiver",
                    pairedAt: s.session?.pairedAt || Date.now(),
                  }
                : s.session,
            error: null,
          }));
        },
        onLatencyUpdate: (ms) => set({ latencyMs: ms }),
        onError: (err) => set({ error: err }),
      });

      activeWsClient.connect(payload);
    },

    simulatePairing: () => {
      if (activeWsClient) {
        activeWsClient.disconnect();
        activeWsClient = null;
      }
      set({
        status: "ACTIVE_SCANNING",
        session: {
          sessionId: `sess_${Math.random().toString(36).slice(2, 8)}`,
          desktopName: "Simulated Desktop",
          pairedAt: Date.now(),
        },
        latencyMs: 24,
        error: null,
      });
    },

    disconnect: () => {
      if (activeWsClient) {
        activeWsClient.disconnect();
        activeWsClient = null;
      }
      set({
        status: "DISCONNECTED",
        session: null,
        pairingPayload: null,
        latencyMs: null,
        reconnectAttempt: 0,
        error: null,
      });
    },

    clearError: () => set({ error: null }),
  };
});
