import { useEffect, useRef, useState } from "react";
import type { Card, Edition, MatchResult } from "../types/card";
import { MOCK_CARDS } from "../lib/mockCards";
import { evaluateFrame, type RawFrame } from "../lib/qualityGate";
import { useScannerStore } from "../store/scannerStore";

const TICK_MS = 140;
const HIGH_CONFIDENCE_ODDS = 0.72;

type Phase = "empty" | "approach" | "blurry" | "glare" | "steady" | "present" | "remove";

export interface SubjectPose {
  card: Card | null;
  edition: Edition | null;
  visible: boolean;
  dx: number;
  dy: number;
  rotate: number;
  glare: number;
  blur: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]): T | undefined => items[Math.floor(Math.random() * items.length)];

function rawFor(phase: Phase): RawFrame {
  switch (phase) {
    case "empty":
    case "remove":
      return { coverage: rand(0.05, 0.4), maxCornerDeltaPx: rand(10, 40), laplacianVariance: rand(20, 60), glareRatio: rand(0, 0.04) };
    case "approach":
      return { coverage: rand(0.68, 0.86), maxCornerDeltaPx: rand(12, 28), laplacianVariance: rand(55, 110), glareRatio: rand(0.01, 0.06) };
    case "blurry":
      return { coverage: rand(0.75, 0.88), maxCornerDeltaPx: rand(1, 6), laplacianVariance: rand(28, 62), glareRatio: rand(0.01, 0.05) };
    case "glare":
      return { coverage: rand(0.75, 0.88), maxCornerDeltaPx: rand(1, 6), laplacianVariance: rand(90, 150), glareRatio: rand(0.15, 0.32) };
    case "steady":
    case "present":
      return { coverage: rand(0.78, 0.9), maxCornerDeltaPx: rand(0.4, 4), laplacianVariance: rand(96, 170), glareRatio: rand(0.01, 0.08) };
  }
}

function poseFor(phase: Phase, card: Card | null, edition: Edition | null, frame: RawFrame): SubjectPose {
  const jitter = Math.min(frame.maxCornerDeltaPx, 30) / 30;
  const base = { card, edition, glare: 0, blur: false };
  switch (phase) {
    case "empty":
      return { ...base, visible: false, dx: 0, dy: 220, rotate: -8 };
    case "remove":
      return { ...base, visible: false, dx: 160, dy: 40, rotate: 10 };
    case "approach":
      return { ...base, visible: true, dx: rand(-26, 26) * jitter, dy: rand(-20, 30) * jitter, rotate: rand(-6, 6) * jitter };
    case "blurry":
      return { ...base, visible: true, blur: true, dx: rand(-3, 3), dy: rand(-3, 3), rotate: rand(-1, 1) };
    case "glare":
      return { ...base, visible: true, glare: 0.55, dx: rand(-2, 2), dy: rand(-2, 2), rotate: rand(-1, 1) };
    case "steady":
    case "present":
      return { ...base, visible: true, dx: rand(-1.5, 1.5), dy: rand(-1.5, 1.5), rotate: rand(-0.6, 0.6) };
  }
}

function toMatch(card: Card, edition: Edition, confidence: number): MatchResult {
  return {
    editionId: edition.id,
    cardSlug: card.slug,
    cardName: card.name,
    element: card.element,
    setPrefix: edition.setPrefix,
    collectorNumber: edition.collectorNumber,
    imageUrl: edition.imageUrl,
    confidence,
    sVisual: Math.min(1, confidence / 100),
    sOcr: confidence >= 90 ? rand(0.85, 0.99) : rand(0.3, 0.7),
    signals: { collectorMatch: confidence >= 90, ocrFallback: confidence < 90 },
  };
}

function rankFor(card: Card, edition: Edition): MatchResult[] {
  if (Math.random() < HIGH_CONFIDENCE_ODDS) return [toMatch(card, edition, Math.round(rand(91, 99)))];
  const top = Math.round(rand(64, 86));
  const others = MOCK_CARDS.filter((c) => c.slug !== card.slug)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  const lookalikes = others.flatMap((c, i) => {
    const e = c.editions[0];
    return e ? [toMatch(c, e, Math.round(top - rand(6, 14) - i * 8))] : [];
  });
  return [toMatch(card, edition, top), ...lookalikes];
}

function scriptFor(): Phase[] {
  const hiccup = pick<Phase[]>([[], [], ["glare", "glare", "glare", "glare"], ["blurry", "blurry", "blurry"]]) ?? [];
  return [...Array<Phase>(5).fill("empty"), ...Array<Phase>(4).fill("approach"), ...hiccup, ...Array<Phase>(3).fill("steady")];
}

const IDLE_POSE: SubjectPose = { card: null, edition: null, visible: false, dx: 0, dy: 220, rotate: -8, glare: 0, blur: false };

/** Synthetic camera feed: walks mock cards through the quality gate so every scanner state can be seen. */
export function useSimulatedFeed(enabled: boolean): SubjectPose {
  const [pose, setPose] = useState<SubjectPose>(IDLE_POSE);
  const ref = useRef({ script: scriptFor(), step: 0, stable: 0, removeLeft: 0, card: null as Card | null, edition: null as Edition | null });

  useEffect(() => {
    const store = useScannerStore;
    if (!enabled) {
      store.getState().pushMetrics(null);
      setPose(IDLE_POSE);
      return;
    }

    const nextSubject = () => {
      const s = ref.current;
      s.card = pick(MOCK_CARDS) ?? null;
      s.edition = s.card ? pick(s.card.editions) ?? null : null;
      s.script = scriptFor();
      s.step = 0;
      s.stable = 0;
    };
    nextSubject();

    const id = setInterval(() => {
      const s = ref.current;
      const { pending, candidates, settings, proposeMatches, pushMetrics } = store.getState();

      let phase: Phase;
      if (s.removeLeft > 0) {
        phase = "remove";
        s.removeLeft -= 1;
        if (s.removeLeft === 0) nextSubject();
      } else if (s.step >= s.script.length) {
        phase = "present";
        if (!pending && !candidates) s.removeLeft = 6;
      } else {
        phase = s.script[s.step] ?? "steady";
        s.step += 1;
      }

      const raw = rawFor(phase);
      const { verdict, stableFrames } = evaluateFrame(raw, s.stable, settings.qualityGate);
      s.stable = stableFrames;
      pushMetrics({ ...raw, timestamp: Date.now(), stableFrames, verdict });
      setPose(poseFor(phase, s.card, s.edition, raw));

      const scriptDone = phase === "steady" && s.step >= s.script.length;
      if (scriptDone && verdict === "ready" && s.card && s.edition) proposeMatches(rankFor(s.card, s.edition));
      else if (scriptDone) s.script.push("steady");
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled]);

  return pose;
}
