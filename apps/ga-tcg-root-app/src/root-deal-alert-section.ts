import type { RootCommunityConfig } from "./community-config";

/**
 * Returns the configured channel group (section) that holds per-user deal-alert
 * channels, or `undefined` if the market channels have not been provisioned yet. The app no
 * longer auto-creates a fallback group — that produced a duplicate group next
 * to the one provisioned in the Assistant App GUI.
 */
export async function ensureAlertSection(
  config: Pick<RootCommunityConfig, "getAlertSectionId" | "setAlertSectionId">
): Promise<string | undefined> {
  return config.getAlertSectionId();
}
