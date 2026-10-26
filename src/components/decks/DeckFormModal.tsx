"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Upload, Save } from "lucide-react";
import { Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

const OMNIDEX_PLACEHOLDER = `# Material Deck
1 Spirit of Water
1 Lorraine, Wandering Warrior

# Main Deck
4 Fracturize
4 Beseech the Winds

# Sideboard
2 Dispel`;

export interface InitialDeckData {
  id: string;
  name: string;
  champion?: string | null;
  omnidexText?: string | null;
}

export interface DeckFormModalProps {
  mode: "create" | "import" | "edit";
  initialDeck?: InitialDeckData;
  onClose: () => void;
  onSaved?: (id: string, name: string) => void;
  onCreated?: (id: string, name: string) => void;
}

export default function DeckFormModal({
  mode,
  initialDeck,
  onClose,
  onSaved,
  onCreated,
}: DeckFormModalProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [name, setName] = useState(initialDeck?.name || "");
  const [champion, setChampion] = useState(initialDeck?.champion || "");
  const [text, setText] = useState(initialDeck?.omnidexText || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = mode === "edit";
  const isImport = mode === "import";
  const isTextForm = isImport || isEdit;
  const canSubmit = Boolean(name.trim() && (!isTextForm || text.trim()));

  const handleFinish = onSaved || onCreated || (() => {});

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      if (isEdit && initialDeck?.id) {
        const res = await fetch(`/api/decks/${initialDeck.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            champion: champion.trim(),
            omnidexText: text,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't update deck");
        handleFinish(initialDeck.id, name.trim());
      } else {
        const res = await fetch("/api/decks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            champion: champion.trim(),
            userId: session?.user?.id,
            ...(isImport ? { omnidexText: text } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.id) throw new Error(data.error || "Couldn't save deck");
        handleFinish(data.id, name.trim());
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Couldn't save deck";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = isEdit
    ? t("decks.editDeck")
    : isImport
    ? t("decks.importModalTitle")
    : t("decks.createModalTitle");

  const modalSubtitle = isEdit
    ? t("decks.editDeckSubtitle")
    : isImport
    ? t("decks.importModalSubtitle")
    : t("decks.createModalSubtitle");

  const submitButtonLabel = isEdit
    ? t("decks.saveChanges")
    : isImport
    ? t("decks.importAndAnalyzeBtn")
    : t("decks.createDeck");

  return (
    <Modal
      title={modalTitle}
      subtitle={modalSubtitle}
      onClose={onClose}
      size={isTextForm ? "lg" : "sm"}
      footer={
        <>
          <Button onClick={onClose} variant="outline">
            {t("decks.cancelBtn")}
          </Button>
          <Button onClick={submit} disabled={submitting || !canSubmit}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Save className="h-4 w-4" />
            ) : isImport ? (
              <Upload className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {submitButtonLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className={`grid gap-4 ${isTextForm ? "sm:grid-cols-2" : ""}`}>
          <div>
            <label htmlFor="deck-name" className="label-caps mb-1.5 block">
              {t("decks.deckNameLabel")}
            </label>
            <Input
              id="deck-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Water Lorraine"
            />
          </div>
          <div>
            <label htmlFor="deck-champion" className="label-caps mb-1.5 block">
              {t("decks.championOptionalLabel")}
            </label>
            <Input
              id="deck-champion"
              value={champion}
              onChange={(e) => setChampion(e.target.value)}
              placeholder="Lorraine, Wandering Warrior"
            />
          </div>
        </div>
        {isTextForm && (
          <div>
            <label htmlFor="deck-text" className="label-caps mb-1.5 block">
              {t("decks.decklistTextLabel")}
            </label>
            <Textarea
              id="deck-text"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={OMNIDEX_PLACEHOLDER}
              className="resize-none font-mono text-xs leading-relaxed"
            />
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
