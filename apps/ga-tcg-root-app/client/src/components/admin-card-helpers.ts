import type { AdminSettingsResponse } from "../types";
import type { Translator } from "@ga/contracts";

export function pickInitialChannelId(settings?: AdminSettingsResponse): string {
  if (!settings) return "";
  if (settings.broadcastChannelId) return settings.broadcastChannelId;
  return settings.textChannels?.[0]?.id ?? "";
}

export function resolveAdminErrorMessage(
  errorCode: string | undefined,
  t: Translator
): string {
  switch (errorCode) {
    case "FORBIDDEN":
      return t("communityAdmin.errors.forbidden");
    case "CHANNEL_NOT_FOUND":
      return t("communityAdmin.errors.channelNotFound");
    case "INVALID_CHANNEL":
      return t("communityAdmin.errors.invalidChannel");
    default:
      return errorCode || t("communityAdmin.saveError");
  }
}
