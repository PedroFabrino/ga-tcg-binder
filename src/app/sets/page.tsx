"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import SetsDashboardView from "@/components/sets/SetsDashboardView";
import { applyHiddenFlag } from "@/lib/sets-view";
import { useTranslation } from "@/lib/i18n";
import type { FeaturedSetSummary } from "@ga/contracts";

export default function SetsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<FeaturedSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Serialize concurrent hide/unhide toggles per group
  const pendingToggles = useRef<Map<string, Promise<void>>>(new Map());

  // -------------------- Fetch --------------------
  const fetchSets = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch("/api/sets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGroups((data as { groups: FeaturedSetSummary[] }).groups ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  // -------------------- Hide / Unhide --------------------
  const handleToggleHide = useCallback(
    async (groupUuid: string) => {
      const previous =
        pendingToggles.current.get(groupUuid) ?? Promise.resolve();

      const togglePromise = previous.then(async () => {
        const group = groups.find((g) => g.groupUuid === groupUuid);
        if (!group) return;

        const newHidden = !group.isHidden;

        // Optimistic update using pure helper
        setGroups((prev) => applyHiddenFlag(prev, groupUuid, newHidden));

        try {
          const res = await fetch("/api/sets/hide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupUuid, isHidden: newHidden }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch {
          // Rollback
          setGroups((prev) =>
            applyHiddenFlag(prev, groupUuid, !newHidden),
          );
          showToast(t("common.error"), "error");
        }
      });

      pendingToggles.current.set(groupUuid, togglePromise);

      void togglePromise.finally(() => {
        if (pendingToggles.current.get(groupUuid) === togglePromise) {
          pendingToggles.current.delete(groupUuid);
        }
      });
    },
    [groups, showToast, t],
  );

  return (
    <SetsDashboardView
      groups={groups}
      loading={loading}
      error={error}
      onToggleHide={handleToggleHide}
    />
  );
}
