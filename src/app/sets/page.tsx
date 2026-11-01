"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ToastProvider";
import SetsDashboardView from "@/components/sets/SetsDashboardView";
import { useTranslation } from "@/lib/i18n";
import {
  useSetsDashboardQuery,
  useToggleSetHiddenMutation,
} from "@/hooks/queries/use-sets-queries";

export default function SetsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { data: session } = useSession();

  const [target, setTarget] = useState<string>("all");
  const userId = session?.user?.id ?? null;

  const { data, isLoading, isError, refetch, isFetching } = useSetsDashboardQuery(target, userId);
  const toggleMutation = useToggleSetHiddenMutation(target, userId);

  const groups = data?.groups ?? [];
  const availableDecks = data?.availableDecks ?? [];
  const hasPersonalWants = data?.hasPersonalWants ?? false;
  const loading = isLoading && groups.length === 0;
  const error = isError;

  // -------------------- Hide / Unhide --------------------
  const handleToggleHide = useCallback(
    async (groupUuid: string) => {
      const group = groups.find((g) => g.groupUuid === groupUuid);
      if (!group) return;

      const newHidden = !group.isHidden;

      try {
        await toggleMutation.mutateAsync({ groupUuid, isHidden: newHidden });
      } catch {
        showToast(t("common.error"), "error");
      }
    },
    [groups, toggleMutation, showToast, t],
  );

  return (
    <SetsDashboardView
      groups={groups}
      loading={loading}
      error={error}
      onToggleHide={handleToggleHide}
      target={target}
      onTargetChange={setTarget}
      availableDecks={availableDecks}
      hasPersonalWants={hasPersonalWants}
      onRefresh={() => refetch()}
      isRefreshing={isFetching}
    />
  );
}
