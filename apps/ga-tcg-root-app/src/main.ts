import { rootServer, type RootBotStartState } from "@rootsdk/server-bot";
import { startMarketNotifier } from "./market-notifier";
import { startDealAlertNotifier } from "./deal-alert-notifier";
import { registerRootCommandHandlers } from "./command-handlers";

async function onStarting(_state: RootBotStartState) {
  startMarketNotifier();
  startDealAlertNotifier();
  registerRootCommandHandlers();
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
