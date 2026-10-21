import { rootServer, type RootBotStartState } from "@rootsdk/server-bot";
import { startMarketNotifier } from "./market-notifier";

async function onStarting(_state: RootBotStartState) {
  startMarketNotifier();
}

(async () => {
  await rootServer.lifecycle.start(onStarting);
})();
