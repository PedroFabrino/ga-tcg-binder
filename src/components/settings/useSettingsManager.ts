"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "../ToastProvider";
import { useTranslation } from "@/lib/i18n";
import type { SettingsUpdateInput } from "@/lib/validation/watchlist-schemas";

export function useSettingsManager() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [threshold, setThreshold] = useState<number>(1000);
  const [friendCode, setFriendCode] = useState<string>("");
  const [mypUsername, setMypUsername] = useState<string>("");
  const [mypLogin, setMypLogin] = useState<string>("");
  const [mypPassword, setMypPassword] = useState<string>("");
  const [mypAutoWatchlistEnabled, setMypAutoWatchlistEnabled] = useState<boolean>(false);
  const [hasSavedMypCredentials, setHasSavedMypCredentials] = useState<boolean>(false);
  const [hasSavedSuperfreteApiKey, setHasSavedSuperfreteApiKey] = useState<boolean>(false);
  const [superfreteApiKey, setSuperfreteApiKey] = useState<string>("");
  const [slightlyOverpriced, setSlightlyOverpriced] = useState<number>(1.2);
  const [heavilyOverpriced, setHeavilyOverpriced] = useState<number>(2.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingCreds, setClearingCreds] = useState(false);
  const [clearingSuperfrete, setClearingSuperfrete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setThreshold(data.user.lowPopThreshold ?? 1000);
          setFriendCode(data.user.friendCode ?? "");
          setMypUsername(data.user.mypUsername ?? "");
          setMypLogin(data.user.mypLogin ?? "");
          setHasSavedMypCredentials(Boolean(data.user.hasSavedMypCredentials));
          setHasSavedSuperfreteApiKey(Boolean(data.user.hasSavedSuperfreteApiKey));
          setSlightlyOverpriced(data.user.slightlyOverpricedMultiplier ?? 1.2);
          setHeavilyOverpriced(data.user.heavilyOverpricedMultiplier ?? 2.0);
          setMypAutoWatchlistEnabled(Boolean(data.user.mypAutoWatchlistEnabled));
        }
      })
      .catch(() => showToast(t("common.error"), "error"))
      .finally(() => setLoading(false));
  }, [showToast, t]);

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
      showToast(t("settings.clearedToast"), "success");
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setClearingCreds(false);
    }
  }, [session?.user?.id, showToast, t]);

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
      showToast(t("settings.superfreteClearedToast"), "success");
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setClearingSuperfrete(false);
    }
  }, [session?.user?.id, showToast, t]);

  const save = useCallback(async (onSuccess?: () => void) => {
    setSaving(true);
    try {
      const body: SettingsUpdateInput = {
        lowPopThreshold: threshold,
        mypUsername: mypUsername.trim() || null,
        mypAutoWatchlistEnabled,
        slightlyOverpricedMultiplier: slightlyOverpriced,
        heavilyOverpricedMultiplier: heavilyOverpriced,
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
        user?: { hasSavedMypCredentials?: boolean; hasSavedSuperfreteApiKey?: boolean };
      };
      if (json.user) {
        setHasSavedMypCredentials(Boolean(json.user.hasSavedMypCredentials));
        setHasSavedSuperfreteApiKey(Boolean(json.user.hasSavedSuperfreteApiKey));
      }
      showToast(t("settings.savedToast"), "success");
      onSuccess?.();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  }, [
    threshold,
    mypUsername,
    mypAutoWatchlistEnabled,
    slightlyOverpriced,
    heavilyOverpriced,
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
    hasSavedMypCredentials,
    hasSavedSuperfreteApiKey,
    superfreteApiKey,
    setSuperfreteApiKey,
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
