"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_bot_1 = require("@rootsdk/server-bot");
const example_1 = require("./example"); // TODO: remove this line when you no longer need the example code
async function onStarting(state) {
    (0, example_1.initializeExample)(); // TODO: remove this line when you no longer need the example code
}
(async () => {
    await server_bot_1.rootServer.lifecycle.start(onStarting);
})();
