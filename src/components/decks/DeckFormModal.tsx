"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Upload } from "lucide-react";
import { Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

const OMNIDEX_PLACEHOLDER = `# Material Deck
1 Spirit of Water
1 Lorraine, Wandering Warrior

# Main Deck
4 Fracturize
4 Beseech the Winds

# Sideboard
2 Dispel`;

export default function DeckFormModal({
  mode,
  onClose,
  onCreated,
}: {
  mode: "create" | "import";
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}) {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [champion, setChampion] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isImport = mode === "import";
  const canSubmit = name.trim() && (!isImport || text.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
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
      onCreated(data.id, name.trim());
    } catch (err: any) {
      setError(err.message || "Couldn't save deck");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isImport ? "Import Omnidex Decklist" : "Create New Deck"}
      subtitle={isImport ? "Paste a list from Omnidex, Silvie.gg or GrandArchiveStats." : "Start an empty list and fill it in later."}
      onClose={onClose}
      size={isImport ? "lg" : "sm"}
      footer={
        <>
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button onClick={submit} disabled={submitting || !canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isImport ? <Upload className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isImport ? "Import & Analyze" : "Create Deck"}
          </Button>
        </>
      }
          >
      <div className="space-y-4">
        <div className={`grid gap-4 ${isImport ? "sm:grid-cols-2" : ""}`}>
          <div>
            <label htmlFor="deck-name" className="label-caps mb-1.5 block">Deck Name</label>
            <Input id="deck-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Water Lorraine" />
          </div>
          <div>
            <label htmlFor="deck-champion" className="label-caps mb-1.5 block">Champion (optional)</label>
            <Input id="deck-champion" value={champion} onChange={(e) => setChampion(e.target.value)} placeholder="Lorraine, Wandering Warrior" />
          </div>
        </div>
        {isImport && (
          <div>
            <label htmlFor="deck-text" className="label-caps mb-1.5 block">Decklist Text</label>
            <Textarea id="deck-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={OMNIDEX_PLACEHOLDER} className="resize-none font-mono text-xs leading-relaxed" />
          </div>
        )}
        {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      </div>
    </Modal>
  );
}
