import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import DeckFormModal from "../DeckFormModal";

vi.stubGlobal("React", React);

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "test-user-1" } } }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
}));

describe("DeckFormModal", () => {
  it("renders create mode with empty fields and create action", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <DeckFormModal
          mode="create"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("Create New Deck");
    expect(html).toContain("Deck Name");
    expect(html).toContain("Create Deck");
  });

  it("renders edit mode with prefilled deck data and save action", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <DeckFormModal
          mode="edit"
          initialDeck={{
            id: "deck-123",
            name: "Water Lorraine",
            champion: "Lorraine, Wandering Warrior",
            omnidexText: "# Material Deck\n1 Spirit of Water",
          }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("Edit Deck");
    expect(html).toContain("Water Lorraine");
    expect(html).toContain("Lorraine, Wandering Warrior");
    expect(html).toContain("1 Spirit of Water");
    expect(html).toContain("Save Changes");
  });
});
