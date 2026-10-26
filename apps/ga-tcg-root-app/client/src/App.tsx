import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { AccountLinkCard } from "./components/AccountLinkCard";
import { DealAlertCard } from "./components/DealAlertCard";
import { DecksDashboardCard } from "./components/DecksDashboardCard";
import type { IAssistantRpcClient, StatusResponse, DeckSummary } from "./types";

export interface AppProps {
  client: IAssistantRpcClient;
}

export const App: React.FC<AppProps> = ({ client }) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatusAndDecks = useCallback(async () => {
    try {
      const res = await client.getStatus();
      setStatus(res);
      if (res.isLinked) {
        const deckRes = await client.getDecks();
        setDecks(deckRes.decks || []);
      } else {
        setDecks([]);
      }
    } catch (err) {
      console.warn("Failed to retrieve assistant status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client]);

  useEffect(() => {
    fetchStatusAndDecks();
  }, [fetchStatusAndDecks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatusAndDecks();
  };

  const handleLink = async (code: string) => {
    const res = await client.linkAccount({ code });
    if (res.success) {
      await fetchStatusAndDecks();
    }
    return { success: res.success, error: res.error };
  };

  const handleUpdatePreferences = async (enabled: boolean, mode: "all" | "hard") => {
    const res = await client.setPreferences({
      notificationsEnabled: enabled,
      dealAlertMode: mode,
    });
    if (res.success) {
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              notificationsEnabled: res.notificationsEnabled,
              dealAlertMode: res.dealAlertMode,
              alertChannelId: res.alertChannelId,
            }
          : null
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* App Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Grand Archive Collector Assistant
              </h1>
              <p className="text-xs text-slate-400">
                Deck shortages, wishlists, and automated marketplace deal alerts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-xs font-medium text-slate-300 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            Refresh
          </button>
        </header>

        {loading ? (
          <div className="space-y-4">
            <div className="h-44 rounded-xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
            <div className="h-44 rounded-xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
            <div className="h-56 rounded-xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
          </div>
        ) : (
          <main className="space-y-6">
            <AccountLinkCard
              isLinked={status?.isLinked ?? false}
              collectorName={status?.collectorName ?? ""}
              friendCode={status?.friendCode ?? ""}
              onLink={handleLink}
            />

            <DealAlertCard
              isLinked={status?.isLinked ?? false}
              notificationsEnabled={status?.notificationsEnabled ?? false}
              dealAlertMode={status?.dealAlertMode ?? "all"}
              alertChannelId={status?.alertChannelId ?? ""}
              onUpdatePreferences={handleUpdatePreferences}
            />

            <DecksDashboardCard
              isLinked={status?.isLinked ?? false}
              decks={decks}
              loading={refreshing}
            />
          </main>
        )}

        <footer className="text-center pt-6 border-t border-white/[0.04] text-xs text-slate-500">
          Powered by Grand Archive Binder • Official Game Nomenclature in canonical English
        </footer>
      </div>
    </div>
  );
};

export default App;
