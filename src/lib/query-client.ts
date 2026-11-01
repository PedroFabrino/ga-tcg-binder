import { QueryClient } from "@tanstack/react-query";

export const DEFAULT_STALE_TIME_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_GC_TIME_MS = 60 * 60 * 1000; // 60 minutes

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
