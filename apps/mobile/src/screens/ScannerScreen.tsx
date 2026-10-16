import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
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
import { useFeedback } from "../lib/feedback";
import { useScannerStore } from "../store/scannerStore";
import { useSessionStore } from "../store/sessionStore";
import { getActiveWsClient } from "../store/sessionStore";
import { colors, radius, space, type } from "../theme";
import { PressableScale } from "../components/shared/Button";
import { FEATURES } from "../config/features";

function ActiveScanner() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const feedback = useFeedback();
  const qualityGate = useScannerStore((s) => s.settings.qualityGate);
  const metrics = useScannerStore((s) => s.metrics);
  const pending = useScannerStore((s) => s.pending);
  const candidates = useScannerStore((s) => s.candidates);
  const scannedCount = useScannerStore((s) => s.scanned.length);
  const pushMetrics = useScannerStore((s) => s.pushMetrics);
  const proposeMatches = useScannerStore((s) => s.proposeMatches);

  const guideWidth = Math.min(width * 0.68, (height * 0.46) / 1.4, 320);
  const locked = !!pending || metrics?.verdict === "ready";

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lastDebug, setLastDebug] = useState<any>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const cameraRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const lastPending = useRef<number | null>(null);
  const lastCandidates = useRef<typeof candidates>(null);
  const lastCount = useRef(scannedCount);

  // Single Frame Capture Trigger (Explicit user action - no flickering shutter intervals)
  const triggerScan = useCallback(async () => {
    if (isProcessingRef.current || pending || candidates || !cameraRef.current) return;

    try {
      isProcessingRef.current = true;
      setIsAnalyzing(true);
      setScanMessage("Analyzing card...");
      feedback.tap();

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        shutterSound: false,
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
        const guideHeight = (guideWidth * 3.5) / 2.5;
        const guideLeft = (width - guideWidth) / 2;
        const guideTop = (height - guideHeight) / 2;

        const cropRect = {
          x: Math.max(0, guideLeft / width),
          y: Math.max(0, guideTop / height),
          width: Math.min(1, guideWidth / width),
          height: Math.min(1, guideHeight / height),
        };

        const res = await ws.processFrame(photo.base64, cropRect);
        const matches = res.candidates || [];
        const debug = res.debug;
        if (debug) setLastDebug(debug);

        console.log("\n================ [SCAN DEBUG REPORT] ================");
        console.log(`[Scan] Frame captured: base64 len = ${photo.base64.length}`);
        console.log(`[Scan] Perceptual Hash (dHash): ${debug?.phash || "N/A"}`);
        console.log(`[Scan] OCR Header Extracted: "${debug?.headerText || ""}"`);
        console.log(`[Scan] OCR Footer Extracted: "${debug?.footerText || ""}"`);
        console.log(`[Scan] Specular Glare: ${((debug?.glareRatio || 0) * 100).toFixed(1)}%`);
        console.log(`[Scan] Confirmed Matches (>=50%): ${matches.length}`);
        if (debug?.topCandidates && debug.topCandidates.length > 0) {
          console.log(`[Scan] Top Candidate Rankings:`);
          debug.topCandidates.slice(0, 5).forEach((c: any, i: number) => {
            console.log(`   #${i + 1}: ${c.cardName} (${c.setPrefix} #${c.collectorNumber}) -> ${c.confidence}% (visual=${(c.sVisual * 100).toFixed(1)}%, ocr=${c.sOcr !== null ? (c.sOcr * 100).toFixed(1) + "%" : "null"})`);
          });
        }
        console.log("=====================================================\n");

        if (matches && matches.length > 0) {
          const normalized = matches.map((m) => ({
            ...m,
            element: (((m as any).element || "NORM") as any),
            imageUrl: m.imageUrl || null,
          }));
          setScanMessage(null);
          proposeMatches(normalized);
        } else {
          setScanMessage("No card detected. Align card in frame and hold steady.");
          feedback.warn();
        }
      }
    } catch (err) {
      console.warn("[ScannerScreen] Scan capture error:", err);
      setScanMessage("Capture error. Please try again.");
    } finally {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [pending, candidates, feedback, pushMetrics, proposeMatches]);

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
      <CameraViewfinder active={focused} guideWidth={guideWidth} onToggle={feedback.tap} cameraRef={cameraRef}>
        <TargetGuideOverlay width={guideWidth} locked={locked} />
      </CameraViewfinder>

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + space(1) }]}>
        <ScannerHeader onTap={feedback.tap} />
        <QualityGateHUD metrics={metrics} config={qualityGate} idleHint={scanMessage || "Align card inside frame & tap scan"} />
      </View>

      <View pointerEvents="box-none" style={styles.bottom}>
        {!pending && !candidates && (
          <View style={styles.scanActionRow}>
            <View style={styles.scanControls}>
              <View style={styles.scanSpacer} />
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

              {lastDebug?.cardImageBase64 ? (
                <PressableScale
                  onPress={() => setShowDebugModal(true)}
                  style={styles.debugThumbButton}
                  accessibilityLabel="Inspect Last Normalized Frame"
                >
                  <Image source={{ uri: lastDebug.cardImageBase64 }} style={styles.debugThumbImage} />
                  <Text style={styles.debugThumbText}>Crop</Text>
                </PressableScale>
              ) : (
                <View style={styles.scanSpacer} />
              )}
            </View>

            <Text style={[styles.scanHint, !!scanMessage && styles.scanHintNotice]}>
              {isAnalyzing ? "Analyzing card..." : scanMessage || "Tap button to scan card"}
            </Text>
          </View>
        )}
        {!pending && <RecentScans />}
        <RapidFirePill onTap={feedback.tap} />
      </View>

      <CandidateDrawer onTap={feedback.tap} />

      {/* Normalized Frame Inspection Modal */}
      <Modal
        visible={showDebugModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDebugModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Normalized Card (630x880)</Text>
              <TouchableOpacity onPress={() => setShowDebugModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {lastDebug?.cardImageBase64 && (
                <Image
                  source={{ uri: lastDebug.cardImageBase64 }}
                  style={styles.modalCardImage}
                  resizeMode="contain"
                />
              )}

              <Text style={styles.modalSectionTitle}>Header OCR Strip (1040x150)</Text>
              {lastDebug?.headerImageBase64 && (
                <View style={styles.modalStripWrapper}>
                  <Image
                    source={{ uri: lastDebug.headerImageBase64 }}
                    style={styles.modalStripImage}
                    resizeMode="contain"
                  />
                </View>
              )}
              <Text style={styles.modalOcrText}>"{lastDebug?.headerText || "(none)"}"</Text>

              <Text style={styles.modalSectionTitle}>Footer OCR Strip (1200x110)</Text>
              {lastDebug?.footerImageBase64 && (
                <View style={styles.modalStripWrapper}>
                  <Image
                    source={{ uri: lastDebug.footerImageBase64 }}
                    style={styles.modalStripImage}
                    resizeMode="contain"
                  />
                </View>
              )}
              <Text style={styles.modalOcrText}>"{lastDebug?.footerText || "(none)"}"</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function ScannerScreen() {
  if (!FEATURES.scanner) return null;
  const status = useSessionStore((s) => s.status);
  if (status === "DISCONNECTED" || status === "CONNECTING") return <PairingView />;
  return <ActiveScanner />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: space(2), gap: space(1.5) },
  bottom: { position: "absolute", left: 0, right: 0, bottom: space(2), paddingHorizontal: space(2), gap: space(1) },
  scanActionRow: { alignItems: "center", justifyContent: "center", marginBottom: space(1.5), gap: space(1) },
  scanControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: space(2),
  },
  scanSpacer: {
    width: 44,
  },
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
  debugThumbButton: {
    width: 44,
    height: 60,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.emerald,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: space(2),
  },
  debugThumbImage: {
    width: "100%",
    height: "100%",
  },
  debugThumbText: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    color: colors.emeraldBright,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  scanHint: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  scanHintNotice: {
    color: colors.amber,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: space(3),
  },
  modalContent: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...type.body,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  modalCloseBtn: {
    padding: space(1),
  },
  modalCloseText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  modalBody: {
    padding: space(2),
    alignItems: "center",
    gap: space(1.5),
  },
  modalCardImage: {
    width: 200,
    height: 280,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#000",
  },
  modalSectionTitle: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 11,
    alignSelf: "flex-start",
    marginTop: space(1),
  },
  modalStripWrapper: {
    width: "100%",
    height: 36,
    backgroundColor: "#000",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modalStripImage: {
    width: "100%",
    height: "100%",
  },
  modalOcrText: {
    fontFamily: "monospace",
    color: colors.emeraldBright,
    fontSize: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: space(1.5),
    paddingVertical: space(0.5),
    borderRadius: radius.sm,
    alignSelf: "stretch",
    textAlign: "center",
  },
});
