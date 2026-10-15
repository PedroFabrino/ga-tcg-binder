import { useCallback, useEffect, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from "expo-audio";
import { useScannerStore } from "../store/scannerStore";

const lockSound = require("../../assets/sounds/lock.wav") as number;
const confirmSound = require("../../assets/sounds/confirm.wav") as number;

export interface Feedback {
  lock: () => void;
  confirm: () => void;
  tap: () => void;
  warn: () => void;
}

/** Haptic + audio cues for scanner events, respecting the sound/haptics toggles. */
export function useFeedback(): Feedback {
  const lockPlayer = useAudioPlayer(lockSound);
  const confirmPlayer = useAudioPlayer(confirmSound);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
  }, []);

  const play = useCallback((player: AudioPlayer) => {
    if (!useScannerStore.getState().settings.soundEnabled) return;
    player.seekTo(0).catch(() => {});
    player.play();
  }, []);

  const haptic = useCallback((fn: () => Promise<void>) => {
    if (useScannerStore.getState().settings.hapticsEnabled) fn().catch(() => {});
  }, []);

  return useMemo(
    () => ({
      lock: () => {
        haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        play(lockPlayer);
      },
      confirm: () => {
        haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        play(confirmPlayer);
      },
      tap: () => haptic(() => Haptics.selectionAsync()),
      warn: () => haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    }),
    [haptic, play, lockPlayer, confirmPlayer]
  );
}
