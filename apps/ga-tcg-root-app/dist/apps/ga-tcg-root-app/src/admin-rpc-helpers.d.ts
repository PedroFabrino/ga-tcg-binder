import { type ChannelGroupGuid } from "@rootsdk/server-app";
import { type RootCommunityConfig } from "./community-config";
import type { AdminSettingsResponse, CommunityChannelOption, CommunityChannelGroupOption, ProvisionMarketChannelsRequest, ProvisionMarketChannelsResponse, SetBroadcastChannelRequest, SetBroadcastChannelResponse } from "@ga/gen-shared";
export interface AdminRpcHelperDeps {
    isCommunityAdmin?: (userId: string) => Promise<boolean>;
    listChannelGroups?: () => Promise<Array<{
        id: unknown;
        name: string;
    }>>;
    listChannels?: (params: {
        channelGroupId: ChannelGroupGuid;
    }) => Promise<Array<{
        id: unknown;
        name: string;
        channelType: number;
    }>>;
    config?: RootCommunityConfig;
    provisionChannels?: (targetGroupId?: string) => Promise<{
        marketChannel: string;
        assistantChannel: string;
    }>;
}
export declare function fetchCommunityChannelGroups(deps?: AdminRpcHelperDeps): Promise<CommunityChannelGroupOption[]>;
export declare function fetchCommunityTextChannels(deps?: AdminRpcHelperDeps): Promise<CommunityChannelOption[]>;
export declare function getAdminSettingsHelper(userId: string, config: RootCommunityConfig, deps?: AdminRpcHelperDeps): Promise<AdminSettingsResponse>;
export declare function setBroadcastChannelHelper(userId: string, request: SetBroadcastChannelRequest, config: RootCommunityConfig, deps?: AdminRpcHelperDeps): Promise<SetBroadcastChannelResponse>;
export declare function provisionMarketChannelsHelper(userId: string, config: RootCommunityConfig, request?: ProvisionMarketChannelsRequest, deps?: AdminRpcHelperDeps): Promise<ProvisionMarketChannelsResponse>;
