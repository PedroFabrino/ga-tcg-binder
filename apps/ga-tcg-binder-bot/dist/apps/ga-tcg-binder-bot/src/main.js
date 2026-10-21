"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_bot_1 = require("@rootsdk/server-bot");
const market_notifier_1 = require("./market-notifier");
async function onStarting(_state) {
    (0, market_notifier_1.startMarketNotifier)();
}
(async () => {
    await server_bot_1.rootServer.lifecycle.start(onStarting);
})();
