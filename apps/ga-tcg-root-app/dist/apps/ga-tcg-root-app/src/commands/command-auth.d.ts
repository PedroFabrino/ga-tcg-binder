import type { RootBotApi } from "../root-bot-api";
export declare function handleLinkCommand(argString: string, userId: string, client: RootBotApi): Promise<string>;
export declare function handleRegisterCommand(userId: string, client: RootBotApi): Promise<string>;
