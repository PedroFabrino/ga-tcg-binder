"use client";

import { useQuery } from "@tanstack/react-query";
import { collectionKeys, settingsKeys } from "@/lib/query-keys";
import { readVendorCapability } from "@/lib/settings-capabilities";
import type { CollectionItem } from "@/components/collection/types";

export function useCollectionQuery(view: string, userId?: string | null) {
  return useQuery<CollectionItem[]>({
    queryKey: collectionKeys.view(view, userId),
    queryFn: async () => {
      const userParam = userId ? `&userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/collection?view=${view}${userParam}`);
      if (!res.ok) throw new Error("Failed to fetch collection");
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    },
  });
}

export function useVendorCapabilityQuery() {
  return useQuery<boolean>({
    queryKey: settingsKeys.current(),
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return false;
      const data = await res.json();
      return readVendorCapability(data);
    },
  });
}
