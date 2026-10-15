import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { X } from "lucide-react-native";
import { SESSION_CODE_LENGTH, normalizeSessionCode } from "../../lib/pairing";
import { useSessionStore } from "../../store/sessionStore";
import { colors, radius, space, type } from "../../theme";
import { Button, PressableScale } from "../shared/Button";

export function ManualPairModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pair = useSessionStore((s) => s.pair);
  const [code, setCode] = useState("");
  const [gatewayHost, setGatewayHost] = useState("192.168.0.201:3001");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setCode("");
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [visible]);

  const submit = () => {
    if (code.length !== SESSION_CODE_LENGTH) return setError(`Enter all ${SESSION_CODE_LENGTH} characters of the code.`);
    let host = gatewayHost.trim();
    if (!host) host = "192.168.0.201:3001";
    const endpoint = host.startsWith("ws://") || host.startsWith("wss://") ? host : `ws://${host}`;
    onClose();
    pair({
      action: "pair_scanner",
      sessionId: code,
      wsEndpoint: endpoint,
      token: code,
    });
  };

  const cells = Array.from({ length: SESSION_CODE_LENGTH }, (_, i) => code[i] ?? "");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Enter session code</Text>
            <PressableScale onPress={onClose} style={styles.close} accessibilityLabel="Close" hitSlop={8}>
              <X size={18} color={colors.textMuted} />
            </PressableScale>
          </View>
          <Text style={styles.body}>Type the 6-character code shown under the QR code on your desktop.</Text>

          <Pressable onPress={() => inputRef.current?.focus()} style={styles.cells} accessibilityLabel="Session code">
            {cells.map((char, i) => (
              <View key={i} style={[styles.cell, char !== "" && styles.cellFilled, i === code.length && styles.cellActive]}>
                <Text style={styles.cellText}>{char}</Text>
              </View>
            ))}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => {
              setCode(normalizeSessionCode(t));
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={SESSION_CODE_LENGTH}
            style={styles.hiddenInput}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <View style={styles.gatewaySection}>
            <Text style={styles.gatewayLabel}>Desktop Gateway Server (Host:Port):</Text>
            <TextInput
              value={gatewayHost}
              onChangeText={setGatewayHost}
              placeholder="192.168.0.201:3001"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.gatewayInput}
            />
          </View>

          <View style={styles.errorSlot}>{error && <Text style={styles.error}>{error}</Text>}</View>
          <Button label="Connect" onPress={submit} disabled={code.length !== SESSION_CODE_LENGTH} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3),
    paddingBottom: space(5),
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space(2) },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...type.title, color: colors.text },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  body: { ...type.body, color: colors.textMuted, marginTop: space(1) },
  cells: { flexDirection: "row", gap: space(1), marginTop: space(3) },
  cell: {
    flex: 1,
    aspectRatio: 0.82,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { borderColor: colors.borderStrong },
  cellActive: { borderColor: colors.emerald },
  cellText: { fontSize: 24, lineHeight: 29, fontWeight: "600", color: colors.text, ...type.mono },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  errorSlot: { minHeight: space(5), justifyContent: "center" },
  error: { ...type.body, color: colors.red },
  gatewaySection: {
    marginTop: space(3),
    marginBottom: space(1),
  },
  gatewayLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: space(1),
  },
  gatewayInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    color: colors.text,
    fontSize: 13,
    ...type.mono,
  },
});
