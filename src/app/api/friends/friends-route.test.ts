import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class FriendValidationError extends Error {}
  class FriendNotFoundError extends Error {}

  return {
    addFriendByCodeService: vi.fn(),
    auth: vi.fn(),
    ensureDefaultUserAndSeed: vi.fn(),
    FriendNotFoundError,
    FriendValidationError,
    getFriendsListService: vi.fn(),
  };
});

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/services/friend", () => ({
  addFriendByCodeService: mocks.addFriendByCodeService,
  FriendNotFoundError: mocks.FriendNotFoundError,
  FriendValidationError: mocks.FriendValidationError,
  getFriendsListService: mocks.getFriendsListService,
}));
vi.mock("@/services/seed", () => ({
  DEFAULT_USER_ID: "default-user",
  ensureDefaultUserAndSeed: mocks.ensureDefaultUserAndSeed,
}));

import { GET, POST } from "./route";

describe("Friends API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates GET to the friend service using the query user ID", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "session-user" } });
    mocks.getFriendsListService.mockResolvedValue({ currentUser: null, friends: [] });

    const response = await GET(new NextRequest("http://localhost/api/friends?userId=query-user"));

    expect(response.status).toBe(200);
    expect(mocks.ensureDefaultUserAndSeed).toHaveBeenCalledOnce();
    expect(mocks.getFriendsListService).toHaveBeenCalledWith("query-user");
    await expect(response.json()).resolves.toEqual({ currentUser: null, friends: [] });
  });

  it("delegates POST to the friend service with the authenticated user", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "session-user" } });
    mocks.addFriendByCodeService.mockResolvedValue({ success: true, friend: { id: "friend" } });

    const response = await POST(new NextRequest("http://localhost/api/friends", {
      method: "POST",
      body: JSON.stringify({ friendCode: " GA-FRIEND " }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.ensureDefaultUserAndSeed).toHaveBeenCalledOnce();
    expect(mocks.addFriendByCodeService).toHaveBeenCalledWith("session-user", "GA-FRIEND");
    await expect(response.json()).resolves.toEqual({ success: true, friend: { id: "friend" } });
  });

  it("preserves client error statuses returned by friend validation", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "session-user" } });
    mocks.addFriendByCodeService.mockRejectedValue(new mocks.FriendNotFoundError("No collector found with that friend code"));

    const response = await POST(new NextRequest("http://localhost/api/friends", {
      method: "POST",
      body: JSON.stringify({ friendCode: "GA-MISSING" }),
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "No collector found with that friend code" });
  });
});
