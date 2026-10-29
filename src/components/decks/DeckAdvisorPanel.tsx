"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Trash2, AlertCircle, Bot, User, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { DeckAdvisorSwapCard } from "./DeckAdvisorSwapCard";
import type { DeckAdvisorMessage, DeckAdvisorChatResponse } from "@ga/contracts";

interface DeckAdvisorPanelProps {
  deckId: string;
  deckName: string;
  onDeckUpdated?: () => void;
}

export default function DeckAdvisorPanel({ deckId, deckName, onDeckUpdated }: DeckAdvisorPanelProps) {
  const { t, locale } = useTranslation();
  const [messages, setMessages] = useState<DeckAdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageKey = `ga_deck_advisor_history_${deckId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (e: unknown) {
      console.warn("[DeckAdvisorPanel] Failed to restore history from localStorage:", e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e: unknown) {
        console.warn("[DeckAdvisorPanel] Failed to save history to localStorage:", e);
      }
    }
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, storageKey]);

  const handleClear = () => {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (e: unknown) {
      console.warn("[DeckAdvisorPanel] Failed to clear history from localStorage:", e);
    }
    setFallbackActive(false);
    setError(null);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    const newMessages: DeckAdvisorMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(`/api/decks/${deckId}/advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, messages: newMessages, locale }),
      });

      if (!res.ok) {
        throw new Error(t("advisor.errorOccurred"));
      }

      const data: DeckAdvisorChatResponse = await res.json();
      if (data.fallbackActivated) {
        setFallbackActive(true);
      }
      setMessages([...newMessages, data.message]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("advisor.errorOccurred");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[650px] rounded-2xl border border-white/[0.08] bg-slate-900/40 backdrop-blur-md overflow-hidden animate-fade-in shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">{t("advisor.title")}</h2>
              {fallbackActive && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  {t("advisor.fallbackActiveBadge")}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-md">{t("advisor.subtitle")}</p>
          </div>
        </div>
        <Button
          onClick={handleClear}
          variant="outline"
          size="sm"
          className="h-8 text-xs text-slate-400 hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {t("advisor.clearChat")}
        </Button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 mb-3 shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)]">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">{t("advisor.emptyChatTitle")}</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-2">{t("advisor.emptyChatSubtitle")}</p>
            <p className="text-[11px] text-slate-500 max-w-xs">{t("advisor.disclaimer")}</p>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-xs leading-relaxed ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-slate-800/80 border border-white/[0.06] text-slate-200 shadow-md"
                }`}
              >
                {m.content}
                {m.role === "assistant" && m.swapProposals && m.swapProposals.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {m.swapProposals.map((proposal) => (
                      <DeckAdvisorSwapCard
                        key={proposal.id}
                        proposal={proposal}
                        deckId={deckId}
                        onDeckUpdated={onDeckUpdated}
                      />
                    ))}
                  </div>
                )}
                {m.role === "assistant" && m.toolsUsed && m.toolsUsed.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex flex-wrap gap-1.5">
                    {m.toolsUsed.includes("query_official_rules") && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                        <BookOpen className="h-3 w-3" />
                        {t("advisor.toolRulesConsulted")}
                      </span>
                    )}
                    {m.toolsUsed.includes("search_candidate_pool") && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                        <Search className="h-3 w-3" />
                        {t("advisor.toolCollectionSearched")}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-200 shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 text-xs items-center text-slate-400">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300 shrink-0">
              <Bot className="h-4 w-4 animate-pulse" />
            </div>
            <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] px-4 py-2.5 text-slate-300 animate-pulse">
              {t("advisor.thinking")}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-white/[0.08] p-3 bg-slate-950/50 flex gap-2 items-center"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("advisor.inputPlaceholder")}
          disabled={loading}
          className="flex-1 bg-slate-900/60 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
        />
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          size="sm"
          className="h-8 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs shadow-md"
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          {t("advisor.send")}
        </Button>
      </form>
    </div>
  );
}
