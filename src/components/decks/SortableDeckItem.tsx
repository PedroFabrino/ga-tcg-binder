"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DeckSummaryCard, type DeckSummaryItem } from "./DeckSummaryCard";
import { DeckSummaryRow } from "./DeckSummaryRow";

export interface SortableDeckItemProps {
  deck: DeckSummaryItem;
  missing: number | null | undefined;
  index: number;
  layout: "grid" | "list";
  isEditing?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  onToggleSection?: (e: React.MouseEvent) => void;
  onEdit: (deck: DeckSummaryItem, e: React.MouseEvent) => void;
  onDelete: (deck: DeckSummaryItem) => void;
}

export function SortableDeckItem(props: SortableDeckItemProps) {
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
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (props.layout === "list") {
    return (
      <div ref={setNodeRef} style={style}>
        <DeckSummaryRow
          deck={props.deck}
          missing={props.missing}
          index={props.index}
          isEditing={props.isEditing}
          canMoveUp={props.canMoveUp}
          canMoveDown={props.canMoveDown}
          dragHandleProps={{ ...attributes, ...listeners }}
          onMoveUp={props.onMoveUp}
          onMoveDown={props.onMoveDown}
          onToggleSection={props.onToggleSection}
          onEdit={(e) => props.onEdit(props.deck, e)}
          onDelete={() => props.onDelete(props.deck)}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <DeckSummaryCard
        deck={props.deck}
        missing={props.missing}
        index={props.index}
        isEditing={props.isEditing}
        canMoveUp={props.canMoveUp}
        canMoveDown={props.canMoveDown}
        dragHandleProps={{ ...attributes, ...listeners }}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
        onToggleSection={props.onToggleSection}
        onEdit={(e) => props.onEdit(props.deck, e)}
        onDelete={() => props.onDelete(props.deck)}
      />
    </div>
  );
}
