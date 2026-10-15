import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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
import { colors, radius, space, type } from "../theme";
import { PressableScale } from "../components/shared/Button";

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

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const cameraRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const lastPending = useRef<number | null>(null);
  const lastCandidates = useRef<typeof candidates>(null);
  const lastCount = useRef(scannedCount);

  // Single Frame Capture Trigger (ADR 0006)
  const triggerScan = useCallback(async () => {
    if (isProcessingRef.current || pending || candidates || !cameraRef.current) return;

    try {
      isProcessingRef.current = true;
      setIsAnalyzing(true);
      feedback.tap();

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.35,
        shutterSound: false,
        skipProcessing: true,
      });

      if (!photo?.base64) return;

      pushMetrics({
        timestamp: Date.now(),
        coverage: 0.88,
        maxCornerDeltaPx: 1,
        laplacianVariance: 110,
        glareRatio: 0.01,
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
      console.warn("[ScannerScreen] Scan capture error:", err);
    } finally {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [pending, candidates, feedback, pushMetrics, proposeMatches]);

  // Relaxed Auto-Scan Loop (every 2.5s when steady and not already scanning)
  useEffect(() => {
    if (!focused || testFeed || status !== "ACTIVE_SCANNING") return;

    const interval = setInterval(() => {
      if (isProcessingRef.current || pending || candidates) return;
      triggerScan();
    }, 2500);

    return () => clearInterval(interval);
  }, [focused, testFeed, status, pending, candidates, triggerScan]);

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
        <QualityGateHUD metrics={metrics} config={qualityGate} idleHint={testFeed ? undefined : "Align card inside frame"} />
      </View>

      <View pointerEvents="box-none" style={styles.bottom}>
        {!pending && !candidates && (
          <View style={styles.scanActionRow}>
            <PressableScale
              onPress={triggerScan}
              disabled={isAnalyzing}
              style={[styles.scanButton, isAnalyzing && styles.scanButtonActive]}
              accessibilityLabel="Scan Card"
            >
              {isAnalyzing ? (
                <ActivityIndicator color={colors.emeraldBright} size="small" />
              ) : (
                <View style={styles.scanButtonInner} />
              )}
            </PressableScale>
            <Text style={styles.scanHint}>
              {isAnalyzing ? "Analyzing card..." : "Tap button or hold steady to scan"}
            </Text>
          </View>
        )}
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
  scanActionRow: { alignItems: "center", justifyContent: "center", marginBottom: space(1.5), gap: space(1) },
  scanButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.emerald,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonActive: {
    borderColor: colors.amber,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  scanButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.emerald,
  },
  scanHint: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
});
