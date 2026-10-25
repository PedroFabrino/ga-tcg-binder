import type { RootCommunityConfig } from "./community-config";

/**
 * Returns the configured channel group (section) that holds per-user deal-alert
 * channels, or `undefined` if `/setup` has not configured one yet. The bot no
 * longer auto-creates a fallback group — that produced a duplicate group next
 * to the one `/setup` creates.
 */
export async function ensureAlertSection(
  config: Pick<RootCommunityConfig, "getAlertSectionId" | "setAlertSectionId">
): Promise<string | undefined> {
  return config.getAlertSectionId();
}
