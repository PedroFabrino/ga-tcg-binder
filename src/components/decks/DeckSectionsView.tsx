"use client";

import React from "react";
import { Crown, BookOpen } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type DeckSummaryItem } from "./DeckSummaryCard";
import { SortableDeckItem } from "./SortableDeckItem";
import { useTranslation } from "@/lib/i18n";
import { type DeckSection } from "@ga/contracts";

function EmptySectionDropZone({
  id,
  message,
}: {
  id: string;
  message: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-dashed py-8 text-center text-xs transition-colors ${
        isOver
          ? "border-cyan-400 bg-cyan-500/10 text-cyan-300"
          : "border-white/[0.08] text-slate-500"
      }`}
    >
      {message}
    </div>
  );
}

interface DeckSectionsViewProps {
  decks: DeckSummaryItem[];
  shortages: Record<string, number | null>;
  loadingEditId: string | null;
  layout?: "grid" | "list";
  onReorder: (newDecks: DeckSummaryItem[]) => void;
  onMove: (deckId: string, direction: "up" | "down") => void;
  onToggleSection: (deckId: string) => void;
  onEdit: (deck: DeckSummaryItem, e: React.MouseEvent) => void;
  onDelete: (deck: DeckSummaryItem) => void;
}

export function DeckSectionsView({
  decks,
  shortages,
  loadingEditId,
  layout = "grid",
  onReorder,
  onMove,
  onToggleSection,
  onEdit,
  onDelete,
}: DeckSectionsViewProps) {
  const { t } = useTranslation();
  const competitiveDecks = decks.filter((d) => d.section === "competitive");
  const fourFunDecks = decks.filter((d) => d.section !== "competitive");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeDeck = decks.find((d) => d.id === active.id);
    if (!activeDeck) return;

    // 1. Dropped into empty drop zones
    if (over.id === "droppable-competitive") {
      if (activeDeck.section !== "competitive") {
        const remainingFun = fourFunDecks.filter((d) => d.id !== activeDeck.id);
        const updatedComp = [{ ...activeDeck, section: "competitive" as DeckSection }, ...competitiveDecks];
        onReorder([...updatedComp, ...remainingFun]);
      }
      return;
    }

    if (over.id === "droppable-4fun") {
      if (activeDeck.section === "competitive") {
        const remainingComp = competitiveDecks.filter((d) => d.id !== activeDeck.id);
        const updatedFun = [{ ...activeDeck, section: "4fun" as DeckSection }, ...fourFunDecks];
        onReorder([...remainingComp, ...updatedFun]);
      }
      return;
    }

    // 2. Dropped over another deck
    const overDeck = decks.find((d) => d.id === over.id);
    if (!overDeck) return;

    if (activeDeck.section === overDeck.section) {
      // Reorder within the same section
      const sameSection = decks.filter((d) => d.section === activeDeck.section);
      const otherSection = decks.filter((d) => d.section !== activeDeck.section);
      const oldIndex = sameSection.findIndex((d) => d.id === active.id);
      const newIndex = sameSection.findIndex((d) => d.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(sameSection, oldIndex, newIndex);
        const combined = activeDeck.section === "competitive"
          ? [...reordered, ...otherSection]
          : [...otherSection, ...reordered];
        onReorder(combined);
      }
    } else {
      // Cross-section drop: move activeDeck to target section at overDeck's index
      const targetSection: DeckSection = overDeck.section;
      const remainingSource = decks.filter((d) => d.id !== activeDeck.id && d.section === activeDeck.section);
      const targetSectionDecks = decks.filter((d) => d.id !== activeDeck.id && d.section === targetSection);
      const dropIndex = targetSectionDecks.findIndex((d) => d.id === over.id);

      const updatedActive = { ...activeDeck, section: targetSection };
      const insertedTarget = [
        ...targetSectionDecks.slice(0, dropIndex),
        updatedActive,
        ...targetSectionDecks.slice(dropIndex),
      ];

      const combined = targetSection === "competitive"
        ? [...insertedTarget, ...remainingSource]
        : [...remainingSource, ...insertedTarget];
      onReorder(combined);
    }
  };

  const sortingStrategy = layout === "list" ? verticalListSortingStrategy : rectSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
        {/* Competitive Decks Section */}
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
                <Crown className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
                {t("decks.sectionCompetitive")}
              </h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-400">
                {competitiveDecks.length}
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              {t("decks.sectionCompetitiveDesc")}
            </p>
          </div>

          {competitiveDecks.length === 0 ? (
            <EmptySectionDropZone
              id="droppable-competitive"
              message={t("decks.emptyCompetitiveSection")}
            />
          ) : (
            <SortableContext
              id="sortable-competitive"
              items={competitiveDecks.map((d) => d.id)}
              strategy={sortingStrategy}
            >
              <div
                className={
                  layout === "list"
                    ? "space-y-2"
                    : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                }
              >
                {competitiveDecks.map((deck, idx) => (
                  <SortableDeckItem
                    key={deck.id}
                    deck={deck}
                    missing={shortages[deck.id]}
                    index={idx}
                    layout={layout}
                    isEditing={loadingEditId === deck.id}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < competitiveDecks.length - 1}
                    onMoveUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMove(deck.id, "up");
                    }}
                    onMoveDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMove(deck.id, "down");
                    }}
                    onToggleSection={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleSection(deck.id);
                    }}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>

        {/* 4Fun Decks Section */}
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-300">
                <BookOpen className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
                {t("decks.section4Fun")}
              </h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-400">
                {fourFunDecks.length}
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              {t("decks.section4FunDesc")}
            </p>
          </div>

          {fourFunDecks.length === 0 ? (
            <EmptySectionDropZone
              id="droppable-4fun"
              message={t("decks.empty4FunSection")}
            />
          ) : (
            <SortableContext
              id="sortable-4fun"
              items={fourFunDecks.map((d) => d.id)}
              strategy={sortingStrategy}
            >
              <div
                className={
                  layout === "list"
                    ? "space-y-2"
                    : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                }
              >
                {fourFunDecks.map((deck, idx) => (
                  <SortableDeckItem
                    key={deck.id}
                    deck={deck}
                    missing={shortages[deck.id]}
                    index={idx}
                    layout={layout}
                    isEditing={loadingEditId === deck.id}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < fourFunDecks.length - 1}
                    onMoveUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMove(deck.id, "up");
                    }}
                    onMoveDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMove(deck.id, "down");
                    }}
                    onToggleSection={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleSection(deck.id);
                    }}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </div>
    </DndContext>
  );
}
