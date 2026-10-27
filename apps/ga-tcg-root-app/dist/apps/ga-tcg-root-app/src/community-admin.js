"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIsCommunityAdmin = checkIsCommunityAdmin;
const server_app_1 = require("@rootsdk/server-app");
async function checkIsCommunityAdmin(userId, ctx = server_app_1.rootServer.community) {
    if (!userId)
        return false;
    try {
        const community = await ctx.communities.get();
        if (String(community.ownerUserId) === userId) {
            return true;
        }
        const [member, roles] = await Promise.all([
            ctx.communityMembers.get({
                userId: userId,
            }),
            ctx.communityRoles.list(),
        ]);
        const roleIds = new Set(member.communityRoleIds.map((id) => String(id)));
        roleIds.add(String(server_app_1.WellKnownRootGuids.CommunityRoles.EveryoneRole));
        return roles.some((role) => roleIds.has(String(role.id)) &&
            (Boolean(role.communityPermission?.communityManageApps) ||
                Boolean(role.communityPermission?.communityFullControl)));
    }
    catch (err) {
        console.warn(`[community-admin] Failed to check admin status for user ${userId}:`, err);
        return false;
    }
}
