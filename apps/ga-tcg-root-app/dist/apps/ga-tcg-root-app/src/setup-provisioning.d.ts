import { type ChannelGroupGuid, type RoleOrMemberGuid } from "@rootsdk/server-app";
import { type RootCommunityConfig } from "./community-config";
export declare const MARKET_CHANNEL_NAME = "market";
export declare const ASSISTANT_CHANNEL_NAME = "assistant";
export declare const GROUP_NAME = "GA Market";
export interface ProvisioningContext {
    rootServer: {
        appId: unknown;
        community: {
            channelGroups: {
                create(params: {
                    name: string;
                    accessRuleCreates: Array<{
                        roleOrMemberId: RoleOrMemberGuid;
                        overlay: {
                            channelFullControl: boolean;
                        };
                    }>;
                }): Promise<{
                    id: string | number;
                }>;
            };
            channels: {
                create(params: {
                    channelGroupId: ChannelGroupGuid;
                    name: string;
                    channelType: number;
                    useChannelGroupPermission: boolean;
                }): Promise<{
                    id: string | number;
                }>;
            };
        };
    };
    config: RootCommunityConfig;
}
export declare function provisionCommunityChannels(ctx: ProvisioningContext): Promise<{
    marketChannel: string;
    assistantChannel: string;
}>;
