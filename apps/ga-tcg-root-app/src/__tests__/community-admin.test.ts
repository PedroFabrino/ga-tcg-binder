import { describe, expect, it, vi } from "vitest";
import { checkIsCommunityAdmin, type CommunityAdminContext } from "../community-admin";
import { WellKnownRootGuids } from "@rootsdk/server-app";

describe("checkIsCommunityAdmin", () => {
  it("returns false for empty or missing userId", async () => {
    expect(await checkIsCommunityAdmin("")).toBe(false);
  });

  it("returns true when userId matches community ownerUserId", async () => {
    const ctx: CommunityAdminContext = {
      communities: {
        get: vi.fn().mockResolvedValue({ ownerUserId: "owner-123" }),
      },
      communityMembers: {
        get: vi.fn(),
      },
      communityRoles: {
        list: vi.fn(),
      },
    };

    const isAdmin = await checkIsCommunityAdmin("owner-123", ctx);
    expect(isAdmin).toBe(true);
    expect(ctx.communityMembers.get).not.toHaveBeenCalled();
  });

  it("returns true when member holds role with communityManageApps", async () => {
    const ctx: CommunityAdminContext = {
      communities: {
        get: vi.fn().mockResolvedValue({ ownerUserId: "owner-999" }),
      },
      communityMembers: {
        get: vi.fn().mockResolvedValue({
          communityRoleIds: ["role-mod"],
        }),
      },
      communityRoles: {
        list: vi.fn().mockResolvedValue([
          {
            id: "role-mod",
            communityPermission: { communityManageApps: true },
          },
        ]),
      },
    };

    const isAdmin = await checkIsCommunityAdmin("mod-user", ctx);
    expect(isAdmin).toBe(true);
  });

  it("returns true when member holds role with communityFullControl", async () => {
    const ctx: CommunityAdminContext = {
      communities: {
        get: vi.fn().mockResolvedValue({ ownerUserId: "owner-999" }),
      },
      communityMembers: {
        get: vi.fn().mockResolvedValue({
          communityRoleIds: ["role-admin"],
        }),
      },
      communityRoles: {
        list: vi.fn().mockResolvedValue([
          {
            id: "role-admin",
            communityPermission: { communityFullControl: true },
          },
        ]),
      },
    };

    const isAdmin = await checkIsCommunityAdmin("admin-user", ctx);
    expect(isAdmin).toBe(true);
  });

  it("returns true when EveryoneRole has communityManageApps", async () => {
    const ctx: CommunityAdminContext = {
      communities: {
        get: vi.fn().mockResolvedValue({ ownerUserId: "owner-999" }),
      },
      communityMembers: {
        get: vi.fn().mockResolvedValue({
          communityRoleIds: [],
        }),
      },
      communityRoles: {
        list: vi.fn().mockResolvedValue([
          {
            id: WellKnownRootGuids.CommunityRoles.EveryoneRole,
            communityPermission: { communityManageApps: true },
          },
        ]),
      },
    };

    const isAdmin = await checkIsCommunityAdmin("regular-user", ctx);
    expect(isAdmin).toBe(true);
  });

  it("returns false when user is not owner and has no admin permissions", async () => {
    const ctx: CommunityAdminContext = {
      communities: {
        get: vi.fn().mockResolvedValue({ ownerUserId: "owner-999" }),
      },
      communityMembers: {
        get: vi.fn().mockResolvedValue({
          communityRoleIds: ["role-guest"],
        }),
      },
      communityRoles: {
        list: vi.fn().mockResolvedValue([
          {
            id: "role-guest",
            communityPermission: { communityManageApps: false, communityFullControl: false },
          },
        ]),
      },
    };

    const isAdmin = await checkIsCommunityAdmin("guest-user", ctx);
    expect(isAdmin).toBe(false);
  });

  it("returns false safely when an error is thrown", async () => {
    const ctx: CommunityAdminContext = {
      communities: {
        get: vi.fn().mockRejectedValue(new Error("Network failed")),
      },
      communityMembers: {
        get: vi.fn(),
      },
      communityRoles: {
        list: vi.fn(),
      },
    };

    const isAdmin = await checkIsCommunityAdmin("any-user", ctx);
    expect(isAdmin).toBe(false);
  });
});
