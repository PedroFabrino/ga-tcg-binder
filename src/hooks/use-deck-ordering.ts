"use client";

import { useState } from "react";
import { type DeckSection } from "@ga/contracts";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/lib/i18n";

export interface DeckItem {
  id: string;
  section: DeckSection;
  priority: number;
  createdAt?: Date | string | null;
}

export function useDeckOrdering<T extends DeckItem>(
  initialDecks: T[],
  onSaveSuccess?: () => void
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [decks, setDecks] = useState<T[]>(initialDecks);

  const reorder = async (newDecks: T[]) => {
    const previous = [...decks];
    setDecks(newDecks);

    // Number priority sequentially within each section
    const competitive = newDecks.filter((d) => d.section === "competitive");
    const fourFun = newDecks.filter((d) => d.section !== "competitive");

    const items = [
      ...competitive.map((d, index) => ({ id: d.id, section: "competitive" as const, priority: index })),
      ...fourFun.map((d, index) => ({ id: d.id, section: "4fun" as const, priority: index })),
    ];

    try {
      const res = await fetch("/api/decks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Reorder failed with status ${res.status}`);
      }
      onSaveSuccess?.();
    } catch (err: unknown) {
      console.warn("[useDeckOrdering] Failed to persist deck order:", err);
      setDecks(previous);
      showToast(t("decks.reorderError"), "error");
    }
  };

  const moveWithinSection = (deckId: string, direction: "up" | "down") => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;

    const sameSection = decks.filter((d) => d.section === deck.section);
    const otherSection = decks.filter((d) => d.section !== deck.section);
    const index = sameSection.findIndex((d) => d.id === deckId);

    if (direction === "up" && index > 0) {
      const reordered = [...sameSection];
      const temp = reordered[index - 1];
      reordered[index - 1] = reordered[index];
      reordered[index] = temp;
      const combined = deck.section === "competitive"
        ? [...reordered, ...otherSection]
        : [...otherSection, ...reordered];
      reorder(combined);
    } else if (direction === "down" && index < sameSection.length - 1) {
      const reordered = [...sameSection];
      const temp = reordered[index + 1];
      reordered[index + 1] = reordered[index];
      reordered[index] = temp;
      const combined = deck.section === "competitive"
        ? [...reordered, ...otherSection]
        : [...otherSection, ...reordered];
      reorder(combined);
    }
  };

  const moveToOtherSection = (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;

    const nextSection: DeckSection = deck.section === "competitive" ? "4fun" : "competitive";
    const remainingInCurrent = decks.filter((d) => d.id !== deckId && d.section === deck.section);
    const targetSectionDecks = decks.filter((d) => d.id !== deckId && d.section === nextSection);

    const updatedTarget = [...targetSectionDecks, { ...deck, section: nextSection }];
    const combined = nextSection === "competitive"
      ? [...updatedTarget, ...remainingInCurrent]
      : [...remainingInCurrent, ...updatedTarget];

    reorder(combined);
  };

  return {
    decks,
    setDecks,
    reorder,
    moveWithinSection,
    moveToOtherSection,
  };
}
