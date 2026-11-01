import type { QueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

export async function signOutAndClearCache(
  queryClient: QueryClient,
  options?: Parameters<typeof signOut>[0]
) {
  queryClient.clear();
  return signOut(options);
}
