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

export function prepareReorderPayload<T extends DeckItem>(decks: T[]) {
  const competitive = decks.filter((d) => d.section === "competitive");
  const fourFun = decks.filter((d) => d.section !== "competitive");

  return [
    ...competitive.map((d, index) => ({ id: d.id, section: "competitive" as const, priority: index })),
    ...fourFun.map((d, index) => ({ id: d.id, section: "4fun" as const, priority: index })),
  ];
}

export function computeMoveWithinSection<T extends DeckItem>(
  decks: T[],
  deckId: string,
  direction: "up" | "down"
): T[] | null {
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return null;

  const sameSection = decks.filter((d) => d.section === deck.section);
  const otherSection = decks.filter((d) => d.section !== deck.section);
  const index = sameSection.findIndex((d) => d.id === deckId);

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sameSection.length) return null;

  const reordered = [...sameSection];
  const temp = reordered[targetIndex];
  reordered[targetIndex] = reordered[index];
  reordered[index] = temp;

  return deck.section === "competitive"
    ? [...reordered, ...otherSection]
    : [...otherSection, ...reordered];
}

export function computeMoveToOtherSection<T extends DeckItem>(
  decks: T[],
  deckId: string
): T[] | null {
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return null;

  const nextSection: DeckSection = deck.section === "competitive" ? "4fun" : "competitive";
  const remainingInCurrent = decks.filter((d) => d.id !== deckId && d.section === deck.section);
  const targetSectionDecks = decks.filter((d) => d.id !== deckId && d.section === nextSection);

  const updatedTarget = [...targetSectionDecks, { ...deck, section: nextSection }];
  return nextSection === "competitive"
    ? [...updatedTarget, ...remainingInCurrent]
    : [...remainingInCurrent, ...updatedTarget];
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

    const items = prepareReorderPayload(newDecks);

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
    const combined = computeMoveWithinSection(decks, deckId, direction);
    if (combined) {
      reorder(combined);
    }
  };

  const moveToOtherSection = (deckId: string) => {
    const combined = computeMoveToOtherSection(decks, deckId);
    if (combined) {
      reorder(combined);
    }
  };

  return {
    decks,
    setDecks,
    reorder,
    moveWithinSection,
    moveToOtherSection,
  };
}
