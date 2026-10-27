import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { AccountLinkCard } from "./components/AccountLinkCard";
import { DealAlertCard } from "./components/DealAlertCard";
import { DecksDashboardCard } from "./components/DecksDashboardCard";
import { WantlistCard } from "./components/WantlistCard";
import { CommunityAdminCard } from "./components/CommunityAdminCard";
import type { IAssistantRpcClient, StatusResponse, DeckSummary } from "./types";

export interface AppProps {
  client: IAssistantRpcClient;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage = "Request timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

export const App: React.FC<AppProps> = ({ client }) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchStatusAndDecks = useCallback(async () => {
    try {
      setErrorBanner(null);
      const res = await withTimeout(
        client.getStatus(),
        8000,
        "Connection to assistant service timed out"
      );
      setStatus(res);
      if (res.isLinked) {
        try {
          const deckRes = await withTimeout(
            client.getDecks(),
            8000,
            "Failed to load decks"
          );
          setDecks(deckRes.decks || []);
        } catch (deckErr) {
          console.warn("Failed to load decks:", deckErr);
          setDecks([]);
        }
      } else {
        setDecks([]);
      }
    } catch (err) {
      console.warn("Failed to retrieve assistant status:", err);
      setStatus((prev) => prev ?? {
        isLinked: false,
        collectorId: "",
        collectorName: "",
        friendCode: "",
        notificationsEnabled: false,
        dealAlertMode: "all",
        alertChannelId: "",
        isAdmin: false,
      });
      setErrorBanner(
        "Unable to connect to the Assistant Service. Click Refresh to retry."
      );
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

  const handleRegister = async () => {
    const res = await client.registerAccount();
    if (res.success) {
      await fetchStatusAndDecks();
    }
    return { success: res.success, error: res.error };
  };

  const handleImportDeck = async (
    data: string | { url?: string; text?: string }
  ) => {
    const payload =
      typeof data === "string"
        ? { url: data, text: "" }
        : { url: data.url || "", text: data.text || "" };
    const res = await client.importDeck(payload);
    if (res.success) {
      await fetchStatusAndDecks();
    }
    return { success: res.success, error: res.error };
  };

  const handleUpdateDeck = async (
    deckId: string,
    data: { name?: string; url?: string; text?: string }
  ) => {
    const res = await client.updateDeck({
      deckId,
      url: data.url || "",
      text: data.text || "",
      name: data.name || "",
      champion: "",
    });
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

        {errorBanner && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="flex-1">{errorBanner}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-44 rounded-xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
            <div className="h-44 rounded-xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
            <div className="h-56 rounded-xl bg-white/[0.02] border border-white/[0.08] animate-pulse" />
          </div>
        ) : (
          <main className="space-y-6">
            <CommunityAdminCard
              isAdmin={status?.isAdmin ?? false}
              client={client}
            />

            <AccountLinkCard
              isLinked={status?.isLinked ?? false}
              collectorName={status?.collectorName ?? ""}
              friendCode={status?.friendCode ?? ""}
              onLink={handleLink}
              onRegister={handleRegister}
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
              onImportDeck={handleImportDeck}
              onUpdateDeck={handleUpdateDeck}
            />

            <WantlistCard
              isLinked={status?.isLinked ?? false}
              client={client}
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
