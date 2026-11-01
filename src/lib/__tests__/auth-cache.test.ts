import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { signOutAndClearCache } from "../auth-cache";
import * as nextAuthReact from "next-auth/react";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

describe("Auth Cache Management", () => {
  it("clears queryClient cache completely before signing out", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["settings", "current", { userId: "user-123" }], {
      secretData: "sensitive",
    });

    expect(queryClient.getQueryData(["settings", "current", { userId: "user-123" }])).toEqual({
      secretData: "sensitive",
    });

    const clearSpy = vi.spyOn(queryClient, "clear");

    await signOutAndClearCache(queryClient);

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(nextAuthReact.signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["settings", "current", { userId: "user-123" }])).toBeUndefined();
  });
});
