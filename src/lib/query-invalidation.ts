import type { QueryClient } from "@tanstack/react-query";
import { deckKeys, collectionKeys, metaKeys, setsKeys } from "./query-keys";

export async function invalidateDeckQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: deckKeys.all }),
    queryClient.invalidateQueries({ queryKey: metaKeys.all }),
    queryClient.invalidateQueries({ queryKey: setsKeys.all }),
  ]);
}

export async function invalidateCollectionQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: collectionKeys.all }),
    queryClient.invalidateQueries({ queryKey: deckKeys.shortages() }),
    queryClient.invalidateQueries({ queryKey: metaKeys.all }),
    queryClient.invalidateQueries({ queryKey: setsKeys.all }),
  ]);
}
