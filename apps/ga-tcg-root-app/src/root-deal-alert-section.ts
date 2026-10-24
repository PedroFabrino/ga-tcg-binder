import type { RootCommunityConfig } from "./community-config";
import type { RootDealAlertApi } from "./root-deal-alert-transport";

const SECTION_NAME = "GA Alerts";

/**
 * Returns the channel group (section) that holds per-user deal-alert channels,
 * creating and persisting it on first use. The id lives in the per-community
 * config, so the section is created once and reused across runs.
 */
export async function ensureAlertSection(
  api: Pick<RootDealAlertApi, "createChannelGroup">,
  config: Pick<RootCommunityConfig, "getAlertSectionId" | "setAlertSectionId">
): Promise<string> {
  const existing = await config.getAlertSectionId();
  if (existing) {
    return existing;
  }

  const created = await api.createChannelGroup(SECTION_NAME);
  await config.setAlertSectionId(created.id);
  return created.id;
}
