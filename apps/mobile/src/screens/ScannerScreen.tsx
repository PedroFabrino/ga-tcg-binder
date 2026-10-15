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

  const guideWidth = Math.min(width * 0.68, (height * 0.46) / 1.4, 320);
  const pose = useSimulatedFeed(focused && testFeed && status === "ACTIVE_SCANNING");
  const locked = !!pending || metrics?.verdict === "ready";

  const lastPending = useRef<number | null>(null);
  const lastCandidates = useRef<typeof candidates>(null);
  const lastCount = useRef(scannedCount);

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
      <CameraViewfinder active={focused} guideWidth={guideWidth} pose={pose} onToggle={feedback.tap}>
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
