"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ToastProvider";
import { useTranslation } from "@/lib/i18n";
import type { SettingsUpdateInput } from "@/lib/validation/watchlist-schemas";
import {
  SHIPPING_PACKAGE_PRESETS,
  type ShippingPackagePreset,
} from "@/services/superfrete-helpers";
import { useSettingsQuery } from "@/hooks/queries/use-settings-queries";
import { settingsKeys } from "@/lib/query-keys";

export function useSettingsManager() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useSettingsQuery({
    userId: session?.user?.id ?? null,
  });

  const [threshold, setThreshold] = useState<number>(1000);
  const [friendCode, setFriendCode] = useState<string>("");
  const [mypUsername, setMypUsername] = useState<string>("");
  const [mypLogin, setMypLogin] = useState<string>("");
  const [mypPassword, setMypPassword] = useState<string>("");
  const [mypAutoWatchlistEnabled, setMypAutoWatchlistEnabled] = useState<boolean>(false);
  const [sellerModeEnabled, setSellerModeEnabled] = useState<boolean>(false);
  const [hasVendorCapability, setHasVendorCapability] = useState<boolean>(false);
  const [hasShippingCapability, setHasShippingCapability] = useState<boolean>(false);
  const [hasSavedMypCredentials, setHasSavedMypCredentials] = useState<boolean>(false);
  const [hasSavedSuperfreteApiKey, setHasSavedSuperfreteApiKey] = useState<boolean>(false);
  const [superfreteApiKey, setSuperfreteApiKey] = useState<string>("");
  const [shippingPackagePreset, setShippingPackagePreset] = useState<ShippingPackagePreset>("standard-box");
  const [shippingPackageHeight, setShippingPackageHeight] = useState<number>(2);
  const [shippingPackageWidth, setShippingPackageWidth] = useState<number>(21);
  const [shippingPackageLength, setShippingPackageLength] = useState<number>(30);
  const [shippingPackageBaseWeight, setShippingPackageBaseWeight] = useState<number>(200);
  const [shippingPackageTapeWeight, setShippingPackageTapeWeight] = useState<number>(5);
  const [shippingCardWeight, setShippingCardWeight] = useState<number>(3);
  const [slightlyOverpriced, setSlightlyOverpriced] = useState<number>(1.2);
  const [heavilyOverpriced, setHeavilyOverpriced] = useState<number>(2.0);
  const [saving, setSaving] = useState(false);
  const [clearingCreds, setClearingCreds] = useState(false);
  const [clearingSuperfrete, setClearingSuperfrete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data?.user) {
      const user = data.user;
      setThreshold(user.lowPopThreshold ?? 1000);
      setFriendCode(user.friendCode ?? "");
      setMypUsername(user.mypUsername ?? "");
      setMypLogin(user.mypLogin ?? "");
      setHasSavedMypCredentials(Boolean(user.hasSavedMypCredentials));
      setHasSavedSuperfreteApiKey(Boolean(user.hasSavedSuperfreteApiKey));
      setShippingPackagePreset((user.shippingPackagePreset as ShippingPackagePreset) ?? "standard-box");
      setShippingPackageHeight(user.shippingPackageHeight ?? 2);
      setShippingPackageWidth(user.shippingPackageWidth ?? 21);
      setShippingPackageLength(user.shippingPackageLength ?? 30);
      setShippingPackageBaseWeight(user.shippingPackageBaseWeight ?? 200);
      setShippingPackageTapeWeight(user.shippingPackageTapeWeight ?? 5);
      setShippingCardWeight(user.shippingCardWeight ?? 3);
      setSlightlyOverpriced(user.slightlyOverpricedMultiplier ?? 1.2);
      setHeavilyOverpriced(user.heavilyOverpricedMultiplier ?? 2.0);
      setMypAutoWatchlistEnabled(Boolean(user.mypAutoWatchlistEnabled));
      setSellerModeEnabled(Boolean(user.sellerModeEnabled));
      setHasVendorCapability(Boolean(user.hasVendorCapability));
      setHasShippingCapability(Boolean(user.hasShippingCapability));
    }
  }, [data]);

  const loading = isLoading && !data;

  const copyFriendCode = useCallback(async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      showToast(t("common.success"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("common.error"), "error");
    }
  }, [friendCode, showToast, t]);

  const handleClearCredentials = useCallback(async () => {
    setClearingCreds(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearMypCredentials: true,
          userId: session?.user?.id,
        }),
      });
      if (!res.ok) throw new Error();
      setHasSavedMypCredentials(false);
      setMypLogin("");
      setMypPassword("");
      setMypAutoWatchlistEnabled(false);
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      showToast(t("settings.clearedToast"), "success");
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setClearingCreds(false);
    }
  }, [queryClient, session?.user?.id, showToast, t]);

  const handleClearSuperfrete = useCallback(async () => {
    setClearingSuperfrete(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearSuperfreteApiKey: true,
          userId: session?.user?.id,
        }),
      });
      if (!res.ok) throw new Error();
      setHasSavedSuperfreteApiKey(false);
      setSuperfreteApiKey("");
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      showToast(t("settings.superfreteClearedToast"), "success");
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setClearingSuperfrete(false);
    }
  }, [queryClient, session?.user?.id, showToast, t]);

  const handleSelectPackagePreset = useCallback((preset: ShippingPackagePreset) => {
    setShippingPackagePreset(preset);
    if (preset !== "custom" && SHIPPING_PACKAGE_PRESETS[preset]) {
      const config = SHIPPING_PACKAGE_PRESETS[preset];
      setShippingPackageHeight(config.heightCm);
      setShippingPackageWidth(config.widthCm);
      setShippingPackageLength(config.lengthCm);
      setShippingPackageBaseWeight(config.baseWeightG);
      setShippingPackageTapeWeight(config.tapeWeightG);
      setShippingCardWeight(config.cardWeightG);
    }
  }, []);

  const save = useCallback(async (onSuccess?: () => void) => {
    setSaving(true);
    try {
      const body: SettingsUpdateInput = {
        lowPopThreshold: threshold,
        mypUsername: mypUsername.trim() || null,
        mypAutoWatchlistEnabled,
        sellerModeEnabled,
        slightlyOverpricedMultiplier: slightlyOverpriced,
        heavilyOverpricedMultiplier: heavilyOverpriced,
        shippingPackagePreset,
        shippingPackageHeight,
        shippingPackageWidth,
        shippingPackageLength,
        shippingPackageBaseWeight,
        shippingPackageTapeWeight,
        shippingCardWeight,
      };

      if (superfreteApiKey.trim()) {
        body.superfreteApiKey = superfreteApiKey.trim();
      }

      if (mypPassword.trim()) {
        body.mypPassword = mypPassword.trim();
        body.mypLogin = mypLogin.trim() || mypUsername.trim();
      } else if (mypLogin.trim()) {
        body.mypLogin = mypLogin.trim();
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as {
        user?: {
          hasSavedMypCredentials?: boolean;
          hasSavedSuperfreteApiKey?: boolean;
          sellerModeEnabled?: boolean;
          hasVendorCapability?: boolean;
          hasShippingCapability?: boolean;
        };
      };
      if (json.user) {
        setHasSavedMypCredentials(Boolean(json.user.hasSavedMypCredentials));
        setHasSavedSuperfreteApiKey(Boolean(json.user.hasSavedSuperfreteApiKey));
        setSellerModeEnabled(Boolean(json.user.sellerModeEnabled));
        setHasVendorCapability(Boolean(json.user.hasVendorCapability));
        setHasShippingCapability(Boolean(json.user.hasShippingCapability));
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      showToast(t("settings.savedToast"), "success");
      onSuccess?.();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  }, [
    queryClient,
    threshold,
    mypUsername,
    mypAutoWatchlistEnabled,
    sellerModeEnabled,
    slightlyOverpriced,
    heavilyOverpriced,
    shippingPackagePreset,
    shippingPackageHeight,
    shippingPackageWidth,
    shippingPackageLength,
    shippingPackageBaseWeight,
    shippingPackageTapeWeight,
    shippingCardWeight,
    superfreteApiKey,
    mypPassword,
    mypLogin,
    showToast,
    t,
  ]);

  return {
    threshold,
    setThreshold,
    friendCode,
    mypUsername,
    setMypUsername,
    mypLogin,
    setMypLogin,
    mypPassword,
    setMypPassword,
    mypAutoWatchlistEnabled,
    setMypAutoWatchlistEnabled,
    sellerModeEnabled,
    setSellerModeEnabled,
    hasVendorCapability,
    hasShippingCapability,
    hasSavedMypCredentials,
    hasSavedSuperfreteApiKey,
    superfreteApiKey,
    setSuperfreteApiKey,
    shippingPackagePreset,
    setShippingPackagePreset,
    shippingPackageHeight,
    setShippingPackageHeight,
    shippingPackageWidth,
    setShippingPackageWidth,
    shippingPackageLength,
    setShippingPackageLength,
    shippingPackageBaseWeight,
    setShippingPackageBaseWeight,
    shippingPackageTapeWeight,
    setShippingPackageTapeWeight,
    shippingCardWeight,
    setShippingCardWeight,
    handleSelectPackagePreset,
    slightlyOverpriced,
    setSlightlyOverpriced,
    heavilyOverpriced,
    setHeavilyOverpriced,
    loading,
    saving,
    clearingCreds,
    clearingSuperfrete,
    copied,
    copyFriendCode,
    handleClearCredentials,
    handleClearSuperfrete,
    save,
  };
}
