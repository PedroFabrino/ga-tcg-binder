"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DeckSummaryCard, DeckSummaryItem } from "./DeckSummaryCard";

interface SortableDeckCardProps {
  deck: DeckSummaryItem;
  missing: number | null | undefined;
  index: number;
  isEditing?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  onToggleSection?: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SortableDeckCard(props: SortableDeckCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.deck.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DeckSummaryCard
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

interface SortableDeckGridProps {
  decks: DeckSummaryItem[];
  shortages: Record<string, number | null>;
  loadingEditId: string | null;
  onReorder: (newDecks: DeckSummaryItem[]) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleSection: (id: string) => void;
  onEdit: (deck: DeckSummaryItem, e: React.MouseEvent) => void;
  onDelete: (deck: DeckSummaryItem, e: React.MouseEvent) => void;
}

export function SortableDeckGrid({
  decks,
  shortages,
  loadingEditId,
  onReorder,
  onMoveUp,
  onMoveDown,
  onToggleSection,
  onEdit,
  onDelete,
}: SortableDeckGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = decks.findIndex((d) => d.id === active.id);
      const newIndex = decks.findIndex((d) => d.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(decks, oldIndex, newIndex));
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={decks.map((d) => d.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck, idx) => (
            <SortableDeckCard
              key={deck.id}
              deck={deck}
              missing={shortages[deck.id]}
              index={idx}
              isEditing={loadingEditId === deck.id}
              canMoveUp={idx > 0}
              canMoveDown={idx < decks.length - 1}
              onMoveUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMoveUp(deck.id);
              }}
              onMoveDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMoveDown(deck.id);
              }}
              onToggleSection={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSection(deck.id);
              }}
              onEdit={(e) => onEdit(deck, e)}
              onDelete={(e) => onDelete(deck, e)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
