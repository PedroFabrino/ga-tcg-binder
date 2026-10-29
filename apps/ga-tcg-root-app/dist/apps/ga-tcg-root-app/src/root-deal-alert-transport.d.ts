import { rootServer } from "@rootsdk/server-app";
import { type DirectMessageSink } from "./deal-alert-sink";
/**
 * The narrow slice of the Root server SDK the deal-alert transport needs.
 * Kept as an interface so tests can inject a fake without loading the SDK.
 */
export interface RootDealAlertAccessRule {
    roleOrMemberId: string;
    overlay?: {
        channelView?: boolean;
        channelCreateMessage?: boolean;
        channelViewMessageHistory?: boolean;
        channelFullControl?: boolean;
    };
}
export interface RootDealAlertApi {
    everyoneRoleId: string;
    /** The bot's own id; used to grant the bot access to the channels it creates. */
    botId: string;
    createChannel(request: {
        channelGroupId: string;
        name: string;
        channelType: number;
        useChannelGroupPermission: boolean;
        accessRuleCreates: RootDealAlertAccessRule[];
    }): Promise<{
        id: string;
    }>;
    createChannelGroup(name: string): Promise<{
        id: string;
    }>;
    /** Best-effort grant of `channelFullControl` to the bot on a channel group. */
    grantBotFullControl(channelGroupId: string): Promise<void>;
    /** Resolves a member's display name, or throws if the member is unknown. */
    getMemberName(userId: string): Promise<string>;
    createMessage(request: {
        channelId: string;
        content: string;
    }): Promise<{
        id: string;
    }>;
    /** Resolves the channel if it still exists, or throws when it does not. */
    getChannel(id: string): Promise<{
        id: string;
    }>;
    /** Lists channels in a group so orphaned/duplicate wantlist channels can be cleaned up. */
    listChannels?(channelGroupId: string): Promise<Array<{
        id: string;
        name: string;
    }>>;
    deleteMessage(request: {
        channelId: string;
        id: string;
    }): Promise<void>;
    deleteChannel(id: string): Promise<void>;
    sendNotification(request: {
        userIds: string[];
        title: string;
        description?: string;
    }): Promise<void>;
}
/** Default adapter over `rootServer.community`. */
export declare function createRootServerDealAlertApi(root?: typeof rootServer): RootDealAlertApi;
export interface RootDealAlertTransportOptions {
    /** The bot-only channel section (channel group) that holds per-user channels. */
    channelGroupId: string;
    api: RootDealAlertApi;
    /** `ChannelType.Text` by default. */
    channelType?: number;
}
/**
 * Root delivery for Deal Alerts: one private channel per recipient under the
 * bot-only section, a rolling message inside it, and a short in-app
 * notification ping. Access rules deny `channelView` to everyone and grant it
 * to the recipient so other members cannot see the channel.
 */
export declare function createRootDealAlertTransport({ channelGroupId, api, channelType, }: RootDealAlertTransportOptions): DirectMessageSink;
