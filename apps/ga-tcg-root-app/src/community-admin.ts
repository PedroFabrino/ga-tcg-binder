import {
  rootServer,
  WellKnownRootGuids,
  type UserGuid,
} from "@rootsdk/server-app";

export interface CommunityAdminContext {
  communities: {
    get: () => Promise<{ ownerUserId: unknown }>;
  };
  communityMembers: {
    get: (params: { userId: UserGuid }) => Promise<{
      communityRoleIds: Array<unknown>;
    }>;
  };
  communityRoles: {
    list: () => Promise<
      Array<{
        id: unknown;
        communityPermission: {
          communityManageApps?: boolean;
          communityFullControl?: boolean;
        };
      }>
    >;
  };
}

export async function checkIsCommunityAdmin(
  userId: string,
  ctx: CommunityAdminContext = rootServer.community
): Promise<boolean> {
  if (!userId) return false;
  try {
    const community = await ctx.communities.get();
    if (String(community.ownerUserId) === userId) {
      return true;
    }

    const [member, roles] = await Promise.all([
      ctx.communityMembers.get({
        userId: userId as unknown as UserGuid,
      }),
      ctx.communityRoles.list(),
    ]);

    const roleIds = new Set(member.communityRoleIds.map((id) => String(id)));
    roleIds.add(String(WellKnownRootGuids.CommunityRoles.EveryoneRole));

    return roles.some(
      (role) =>
        roleIds.has(String(role.id)) &&
        (Boolean(role.communityPermission?.communityManageApps) ||
          Boolean(role.communityPermission?.communityFullControl))
    );
  } catch (err) {
    console.warn("[community-admin] Failed to check admin permissions:", err);
    return false;
  }
}
