import { type ChannelGroupGuid, type RoleOrMemberGuid } from "@rootsdk/server-app";
import { type RootCommunityConfig } from "./community-config";
export declare const MARKET_CHANNEL_NAME = "market";
export declare const GROUP_NAME = "GA Market";
export interface ProvisioningContext {
    rootServer: {
        appId: unknown;
        community: {
            channelGroups: {
                list?(): Promise<Array<{
                    id: string | number;
                    name: string;
                }>>;
                create(params: {
                    name: string;
                    accessRuleCreates?: Array<{
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
                list?(params: {
                    channelGroupId: ChannelGroupGuid;
                }): Promise<Array<{
                    id: string | number;
                    name: string;
                    channelType?: number;
                }>>;
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
    targetGroupId?: string;
}
export declare function provisionCommunityChannels(ctx: ProvisioningContext): Promise<{
    marketChannel: string;
    assistantChannel: string;
}>;
