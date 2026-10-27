import { type UserGuid } from "@rootsdk/server-app";
export interface CommunityAdminContext {
    communities: {
        get: () => Promise<{
            ownerUserId: unknown;
        }>;
    };
    communityMembers: {
        get: (params: {
            userId: UserGuid;
        }) => Promise<{
            communityRoleIds: Array<unknown>;
        }>;
    };
    communityRoles: {
        list: () => Promise<Array<{
            id: unknown;
            communityPermission: {
                communityManageApps?: boolean;
                communityFullControl?: boolean;
            };
        }>>;
    };
}
export declare function checkIsCommunityAdmin(userId: string, ctx?: CommunityAdminContext): Promise<boolean>;
