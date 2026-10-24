import { rootServer, type RootBotStartState } from "@rootsdk/server-bot";
import { startMarketNotifier } from "./market-notifier";
import {
  startDealAlertNotifier,
  readRootDealAlertSectionId,
  readRootDealAlertBotRoleId,
} from "./deal-alert-notifier";
import { registerRootCommandHandlers } from "./command-handlers";
import { logCommunityContext } from "./channel-diagnostics";

async function onStarting(state: RootBotStartState) {
  console.log(`[root] Starting bot in community ${state.communityId}`);
  void logCommunityContext({
    sectionId: readRootDealAlertSectionId(),
    botRoleId: readRootDealAlertBotRoleId(),
  });
  startMarketNotifier();
  startDealAlertNotifier();
  registerRootCommandHandlers();
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
