"use strict";
// TODO: delete this example code if not needed
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeExample = initializeExample;
// Use "@rootsdk/server-bot" to import the Root API types
const server_bot_1 = require("@rootsdk/server-bot");
// Initialize your Bot (set up your database, subscribe to community events, etc.)
function initializeExample() {
    // Example: subscribe to be notified when members post new messages to any channel your Bot can see
    server_bot_1.rootServer.community.channelMessages.on(server_bot_1.ChannelMessageEvent.ChannelMessageCreated, onMessage);
}
// Example: process channel messages that start with "/echo ", send back the incoming text
async function onMessage(evt) {
    // Ignore Root System messages - they aren't of interest to the Bot, nor will they have any 'messageContent'
    if (evt.messageType === server_bot_1.MessageType.System)
        return;
    const prefix = "/echo ";
    // You receive all messages, only respond to ones that start with "/echo "
    if (!evt.messageContent?.startsWith(prefix))
        return;
    // Retrieve the incoming message text without the "/echo " prefix
    const incomingText = evt.messageContent
        ?.substring(prefix.length)
        .trim();
    // Prepare the response - echo the incoming text to the same channel as the incoming message
    const createMessageRequest = {
        channelId: evt.channelId,
        content: incomingText,
    };
    try {
        // Send the response to the community
        const cm = await server_bot_1.rootServer.community.channelMessages.create(createMessageRequest);
    }
    catch (xcpt) {
        // Handle Root-generated exceptions
        if (xcpt instanceof server_bot_1.RootApiException) {
            // 'errorCode' tells you what went wrong.
            // E.g., perhaps your Bot doesn't have permission to create messages.
            console.error("RootApiException:", xcpt.errorCode);
        }
        else if (xcpt instanceof Error) {
            console.error("Unexpected error:", xcpt.message);
        }
        else {
            console.error("Unknown error:", xcpt);
        }
    }
}
