import { AssistantClient } from "@ga/contracts";
export declare function getAssistantClient(): AssistantClient;
/**
 * Parses and executes a Root slash command from incoming channel messages.
 * Returns the markdown reply string, or null if message is not a recognized command.
 */
export declare function processRootCommand(userId: string, messageContent: string, client?: AssistantClient): Promise<string | null>;
/**
 * Subscribes to Root channel messages and executes assistant commands.
 */
export declare function registerRootCommandHandlers(): void;
