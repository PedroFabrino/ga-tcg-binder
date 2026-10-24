import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import CollectionExportModal from "../CollectionExportModal";
import type { CollectionItem } from "../types";

vi.stubGlobal("React", React);

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
}));

function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: "item-1",
    editionId: "ed-1",
    cardSlug: "fracturize",
    cardName: "Fracturize",
    element: "NORM",
    class: "WARRIOR",
    type: "ACTION",
    setPrefix: "DOA",
    setName: "Dawn of Ashes",
    collectorNumber: "001",
    rarity: 1,
    imageUrl: "https://example.com/fracturize.jpg",
    foil: false,
    quantity: 4,
    isDedicated: false,
    population: 1000,
    isLowPop: false,
    activeDeckUsages: 1,
    idleQuantity: 3,
    ...overrides,
  };
}

function renderModal(props: React.ComponentProps<typeof CollectionExportModal>) {
  return renderToStaticMarkup(
    <I18nProvider>
      <CollectionExportModal {...props} />
    </I18nProvider>,
  );
}

describe("CollectionExportModal", () => {
  it("renders export modal with Omnidex and CSV format selectors and buttons", () => {
    const html = renderModal({
      onClose: vi.fn(),
      currentItems: [makeItem()],
    });

    expect(html).toContain("Export Collection");
    expect(html).toContain("Omnidex (.txt)");
    expect(html).toContain("CSV (.csv)");
    expect(html).toContain("Copy to Clipboard");
    expect(html).toContain("Download .TXT");
  });

  it("renders Omnidex preview text by default with set prefix and collector number", () => {
    const html = renderModal({
      onClose: vi.fn(),
      currentItems: [
        makeItem({ cardName: "Fracturize", quantity: 4, setPrefix: "DOA", collectorNumber: "001" }),
      ],
    });

    expect(html).toContain("4x Fracturize [DOA 001]");
  });

  it("displays empty state when collection items list is empty", () => {
    const html = renderModal({
      onClose: vi.fn(),
      currentItems: [],
    });

    expect(html).toContain("No cards available to export.");
  });

  it("shows scope switcher when current view is filtered", () => {
    const html = renderModal({
      onClose: vi.fn(),
      currentItems: [makeItem({ quantity: 2 })],
      isFiltered: true,
    });

    expect(html).toContain("Scope:");
    expect(html).toContain("Current Filter");
  });
});
