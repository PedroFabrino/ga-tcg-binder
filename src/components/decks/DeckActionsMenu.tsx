"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export interface DeckActionsMenuProps {
  deckName: string;
  isCompetitive: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  onToggleSection?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}

export function DeckActionsMenu({
  deckName,
  isCompetitive,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onToggleSection,
  onEdit,
  onDelete,
}: DeckActionsMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        aria-label={`${t("decks.deckActionsMenu")} - ${deckName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("decks.deckActionsMenu")}
          className="absolute right-0 top-full z-40 mt-1 min-w-[180px] origin-top-right rounded-xl border border-white/[0.12] bg-slate-900/95 p-1 shadow-2xl backdrop-blur-md animate-fade-in"
        >
          {onMoveUp && (
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveUp}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                onMoveUp(e);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("decks.moveUp")}
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span>{t("decks.moveUp")}</span>
            </button>
          )}

          {onMoveDown && (
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveDown}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                onMoveDown(e);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("decks.moveDown")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>{t("decks.moveDown")}</span>
            </button>
          )}

          {onToggleSection && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                onToggleSection(e);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label={isCompetitive ? t("decks.moveTo4Fun") : t("decks.moveToCompetitive")}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>{isCompetitive ? t("decks.moveTo4Fun") : t("decks.moveToCompetitive")}</span>
            </button>
          )}

          {(onEdit || onDelete) && (
            <div className="my-1 border-t border-white/[0.08]" />
          )}

          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                onEdit(e);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
              aria-label={`${t("decks.editDeck")} ${deckName}`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{t("decks.editDeck")}</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                onDelete(e);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
              aria-label={`${t("decks.deleteDeck")} ${deckName}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t("decks.deleteDeck")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
