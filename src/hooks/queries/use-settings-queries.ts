"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsKeys } from "@/lib/query-keys";

export interface SettingsResponse {
  user?: {
    id?: string;
    lowPopThreshold?: number | null;
    friendCode?: string | null;
    mypUsername?: string | null;
    mypLogin?: string | null;
    hasSavedMypCredentials?: boolean;
    hasSavedSuperfreteApiKey?: boolean;
    shippingPackagePreset?: string | null;
    shippingPackageHeight?: number | null;
    shippingPackageWidth?: number | null;
    shippingPackageLength?: number | null;
    shippingPackageBaseWeight?: number | null;
    shippingPackageTapeWeight?: number | null;
    shippingCardWeight?: number | null;
    slightlyOverpricedMultiplier?: number | null;
    heavilyOverpricedMultiplier?: number | null;
    mypAutoWatchlistEnabled?: boolean;
    sellerModeEnabled?: boolean;
    hasVendorCapability?: boolean;
    hasShippingCapability?: boolean;
  } | null;
}

export function useSettingsQuery<TData = SettingsResponse>(options?: {
  select?: (data: SettingsResponse) => TData;
  userId?: string | null;
  enabled?: boolean;
}) {
  return useQuery<SettingsResponse, Error, TData>({
    queryKey: settingsKeys.current(options?.userId),
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    select: options?.select,
    enabled: options?.enabled,
  });
}

export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: object) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
