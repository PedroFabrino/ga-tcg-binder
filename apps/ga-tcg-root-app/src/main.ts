import { rootServer, type RootBotStartState } from "@rootsdk/server-bot";
import { startMarketNotifier } from "./market-notifier";
import { startDealAlertNotifier } from "./deal-alert-notifier";
import { registerRootCommandHandlers } from "./command-handlers";
import { createCommunityConfig } from "./community-config";
import { logCommunityContext } from "./channel-diagnostics";

async function onStarting(state: RootBotStartState) {
  console.log(`[root] Starting bot in community ${state.communityId}`);

  const config = createCommunityConfig(rootServer.dataStore.appData);
  const [sectionId, broadcastChannelId] = await Promise.all([
    config.getAlertSectionId(),
    config.getBroadcastChannelId(),
  ]);
  void logCommunityContext({ sectionId, broadcastChannelId });

  startMarketNotifier();
  startDealAlertNotifier();
  registerRootCommandHandlers();
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
