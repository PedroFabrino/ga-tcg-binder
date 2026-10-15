import { create } from "zustand";
import type { Finish, MatchResult, ScannedCard } from "../types/card";
import { RAPID_FIRE_CERTAINTY } from "../types/card";
import { DEFAULT_QUALITY_GATE, type QualityGateConfig, type ScanFrameMetrics } from "../types/session";

export interface PendingMatch {
  match: MatchResult;
  finish: Finish;
  startedAt: number;
}

export interface ScannerSettings {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  testFeed: boolean;
  torch: boolean;
  facing: "back" | "front";
  qualityGate: QualityGateConfig;
}

/** UI-only: confirmed cards are marked as sent locally. Swap `emit` for the real desktop send. */
interface ScannerStore {
  settings: ScannerSettings;
  metrics: ScanFrameMetrics | null;
  pending: PendingMatch | null;
  candidates: MatchResult[] | null;
  scanned: ScannedCard[];

  updateSettings: (patch: Partial<ScannerSettings>) => void;
  pushMetrics: (metrics: ScanFrameMetrics | null) => void;
  /** Routes a ranked match list to rapid-fire (>= 90%) or the candidate drawer. */
  proposeMatches: (ranked: MatchResult[]) => void;
  toggleFinish: () => void;
  confirmPending: () => void;
  cancelPending: () => void;
  selectCandidate: (match: MatchResult, finish: Finish) => void;
  dismissCandidates: () => void;
  reset: () => void;
}

import { getActiveWsClient } from "./sessionStore";

const newId = () => `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const useScannerStore = create<ScannerStore>((set, get) => {
  const emit = (match: MatchResult, finish: Finish) => {
    const card: ScannedCard = { id: newId(), match, finish, scannedAt: Date.now(), status: "sending" };
    set((s) => ({ scanned: [card, ...s.scanned] }));

    const ws = getActiveWsClient();
    if (ws) {
      ws.sendCardCommitted({
        editionId: match.editionId,
        cardSlug: match.cardSlug,
        cardName: match.cardName,
        setPrefix: match.setPrefix,
        collectorNumber: match.collectorNumber,
        imageUrl: match.imageUrl ?? "",
        foil: finish === "Foil",
        confidence: match.confidence,
        timestamp: card.scannedAt,
      });
    }

    setTimeout(() => set((s) => ({ scanned: s.scanned.map((c) => (c.id === card.id ? { ...c, status: "sent" } : c)) })), 450);
  };

  return {
    settings: { hapticsEnabled: true, soundEnabled: true, testFeed: false, torch: false, facing: "back", qualityGate: DEFAULT_QUALITY_GATE },
    metrics: null,
    pending: null,
    candidates: null,
    scanned: [],

    updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch, testFeed: false } })),
    pushMetrics: (metrics) => set({ metrics }),

    proposeMatches: (ranked) => {
      const [top] = ranked;
      if (!top || get().pending || get().candidates) return;
      if (top.confidence >= RAPID_FIRE_CERTAINTY) set({ pending: { match: top, finish: "Normal", startedAt: Date.now() } });
      else set({ candidates: ranked.slice(0, 3) });
    },

    toggleFinish: () => set((s) => (s.pending ? { pending: { ...s.pending, finish: s.pending.finish === "Normal" ? "Foil" : "Normal" } } : {})),

    confirmPending: () => {
      const { pending } = get();
      if (!pending) return;
      set({ pending: null });
      emit(pending.match, pending.finish);
    },

    cancelPending: () => set({ pending: null }),

    selectCandidate: (match, finish) => {
      set({ candidates: null });
      emit(match, finish);
    },

    dismissCandidates: () => set({ candidates: null }),
    reset: () => set({ scanned: [], pending: null, candidates: null, metrics: null }),
  };
});
