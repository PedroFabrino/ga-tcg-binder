import type { AdminSettingsResponse } from "../types";
import type { Translator } from "@ga/contracts";

export function pickInitialChannelId(settings?: AdminSettingsResponse): string {
  if (!settings) return "";
  const channels = settings.textChannels ?? [];
  const configuredStillExists =
    settings.broadcastChannelId !== "" &&
    channels.some((ch) => ch.id === settings.broadcastChannelId);
  if (configuredStillExists) return settings.broadcastChannelId;
  return channels[0]?.id ?? "";
}

export type AdminFallbackKey =
  | "communityAdmin.saveError"
  | "communityAdmin.provisionError";

export function resolveAdminErrorMessage(
  errorCode: string | undefined,
  t: Translator,
  fallbackKey: AdminFallbackKey = "communityAdmin.saveError"
): string {
  switch (errorCode) {
    case "FORBIDDEN":
      return t("communityAdmin.errors.forbidden");
    case "CHANNEL_NOT_FOUND":
      return t("communityAdmin.errors.channelNotFound");
    case "INVALID_CHANNEL":
      return t("communityAdmin.errors.invalidChannel");
    default:
      return errorCode || t(fallbackKey);
  }
}
