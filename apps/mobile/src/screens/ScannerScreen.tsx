import { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CandidateDrawer } from "../components/scanner/CandidateDrawer";
import { CameraViewfinder } from "../components/scanner/CameraViewfinder";
import { QualityGateHUD } from "../components/scanner/QualityGateHUD";
import { RapidFirePill } from "../components/scanner/RapidFirePill";
import { RecentScans } from "../components/scanner/RecentScans";
import { ScannerHeader } from "../components/scanner/ScannerHeader";
import { TargetGuideOverlay } from "../components/scanner/TargetGuideOverlay";
import { PairingView } from "../components/pairing/PairingView";
import { useSimulatedFeed } from "../hooks/useSimulatedFeed";
import { useFeedback } from "../lib/feedback";
import { useScannerStore } from "../store/scannerStore";
import { useSessionStore } from "../store/sessionStore";
import { getActiveWsClient } from "../store/sessionStore";
import { colors, space } from "../theme";

function ActiveScanner() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const feedback = useFeedback();
  const status = useSessionStore((s) => s.status);
  const testFeed = useScannerStore((s) => s.settings.testFeed);
  const qualityGate = useScannerStore((s) => s.settings.qualityGate);
  const metrics = useScannerStore((s) => s.metrics);
  const pending = useScannerStore((s) => s.pending);
  const candidates = useScannerStore((s) => s.candidates);
  const scannedCount = useScannerStore((s) => s.scanned.length);
  const pushMetrics = useScannerStore((s) => s.pushMetrics);
  const proposeMatches = useScannerStore((s) => s.proposeMatches);

  const guideWidth = Math.min(width * 0.68, (height * 0.46) / 1.4, 320);
  const pose = useSimulatedFeed(focused && testFeed && status === "ACTIVE_SCANNING");
  const locked = !!pending || metrics?.verdict === "ready";

  const cameraRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const lastPending = useRef<number | null>(null);
  const lastCandidates = useRef<typeof candidates>(null);
  const lastCount = useRef(scannedCount);

  // Real camera continuous capture loop (ADR 0006)
  useEffect(() => {
    if (!focused || testFeed || status !== "ACTIVE_SCANNING") return;

    const interval = setInterval(async () => {
      // Don't capture if user is currently reviewing a match or selecting a candidate
      if (isProcessingRef.current || pending || candidates) return;
      if (!cameraRef.current) return;

      try {
        isProcessingRef.current = true;
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.65,
          skipProcessing: true,
        });

        if (!photo?.base64) return;

        pushMetrics({
          timestamp: Date.now(),
          coverage: 0.85,
          maxCornerDeltaPx: 1,
          laplacianVariance: 95,
          glareRatio: 0.02,
          stableFrames: 3,
          verdict: "ready",
        });

        const ws = getActiveWsClient();
        if (ws) {
          const matches = await ws.processFrame(photo.base64);
          if (matches && matches.length > 0) {
            const normalized = matches.map((m) => ({
              ...m,
              element: (((m as any).element || "NORM") as any),
              imageUrl: m.imageUrl || null,
            }));
            proposeMatches(normalized);
          }
        }
      } catch (err) {
        // Silently continue scanning on frame drops
      } finally {
        isProcessingRef.current = false;
      }
    }, 750);

    return () => clearInterval(interval);
  }, [focused, testFeed, status, pending, candidates, pushMetrics, proposeMatches]);

  useEffect(() => {
    if (pending && pending.startedAt !== lastPending.current) feedback.lock();
    lastPending.current = pending?.startedAt ?? null;
  }, [pending, feedback]);

  useEffect(() => {
    if (candidates && candidates !== lastCandidates.current) feedback.warn();
    lastCandidates.current = candidates;
  }, [candidates, feedback]);

  useEffect(() => {
    if (scannedCount > lastCount.current) feedback.confirm();
    lastCount.current = scannedCount;
  }, [scannedCount, feedback]);

  return (
    <View style={styles.root}>
      <CameraViewfinder active={focused} guideWidth={guideWidth} pose={pose} onToggle={feedback.tap} cameraRef={cameraRef}>
        <TargetGuideOverlay width={guideWidth} locked={locked} />
      </CameraViewfinder>

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + space(1) }]}>
        <ScannerHeader onTap={feedback.tap} />
        <QualityGateHUD metrics={metrics} config={qualityGate} idleHint={testFeed ? undefined : "Point at a card to scan"} />
      </View>

      <View pointerEvents="box-none" style={styles.bottom}>
        {!pending && <RecentScans />}
        <RapidFirePill onTap={feedback.tap} />
      </View>

      <CandidateDrawer onTap={feedback.tap} />
    </View>
  );
}

export function ScannerScreen() {
  const status = useSessionStore((s) => s.status);
  if (status === "DISCONNECTED" || status === "CONNECTING") return <PairingView />;
  return <ActiveScanner />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: space(2), gap: space(1.5) },
  bottom: { position: "absolute", left: 0, right: 0, bottom: space(2), paddingHorizontal: space(2), gap: space(1) },
});
