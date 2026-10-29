import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { DeckAdvisorSwapCard } from "../DeckAdvisorSwapCard";
import type { DeckAdvisorSwapProposal } from "@ga/contracts";

vi.stubGlobal("React", React);

// Mock useToast
vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe("DeckAdvisorSwapCard UI Component (Ticket 3 - #188)", () => {
  const mockProposal: DeckAdvisorSwapProposal = {
    id: "swap_1",
    title: "Add Palvor Sword Distortion",
    rationale: "Synergy with The Looking Glass relic.",
    netImpact: "immediate",
    cuts: [{ cardName: "Fire Slash", zone: "main", quantity: 2 }],
    adds: [
      {
        cardName: "Palvor Sword",
        zone: "main",
        quantity: 2,
        tier: "binder_available",
      },
    ],
    updatedOmnidexText: "# Main Deck\n2 Palvor Sword\n2 Fire Slash",
  };

  it("renders cuts, adds, zone badges, and immediate sleeving badge in English", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <DeckAdvisorSwapCard proposal={mockProposal} deckId="deck_1" />
      </I18nProvider>
    );

    expect(html).toContain("Add Palvor Sword Distortion");
    expect(html).toContain("Immediate Sleeving (All copies owned in Binder)");
    expect(html).toContain("-2");
    expect(html).toContain("Fire Slash");
    expect(html).toContain("+2");
    expect(html).toContain("Palvor Sword");
    expect(html).toContain("Main Deck");
    expect(html).toContain("Binder Available");
    expect(html).toContain("Rationale:");
    expect(html).toContain("Synergy with The Looking Glass relic.");
    expect(html).toContain("Copy Updated Omnidex");
    expect(html).toContain("Apply Swap to Deck");
  });

  it("renders localized labels and net impact in pt-BR while keeping canonical game zones", () => {
    const ptProposal: DeckAdvisorSwapProposal = {
      ...mockProposal,
      netImpact: "hard_shortage",
      adds: [
        {
          cardName: "Palvor Sword",
          zone: "main",
          quantity: 2,
          tier: "unowned_upgrade",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="pt-BR">
        <DeckAdvisorSwapCard proposal={ptProposal} deckId="deck_1" />
      </I18nProvider>
    );

    expect(html).toContain("Gera Falta Real (Compra necessária)");
    expect(html).toContain("Upgrade Não Possuído");
    expect(html).toContain("Remover");
    expect(html).toContain("Adicionar");
    expect(html).toContain("Motivo:");
    expect(html).toContain("Copiar Omnidex Atualizado");
    expect(html).toContain("Aplicar Troca ao Deck");
    // Canonical Game Nomenclature remains in English:
    expect(html).toContain("Main Deck");
  });

  it("renders store pull-back tier badge properly", () => {
    const storeProposal: DeckAdvisorSwapProposal = {
      ...mockProposal,
      netImpact: "store_pullback",
      adds: [
        {
          cardName: "Grand Crusader Shield",
          zone: "material",
          quantity: 1,
          tier: "store_pullback",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <DeckAdvisorSwapCard proposal={storeProposal} deckId="deck_1" />
      </I18nProvider>
    );

    expect(html).toContain("Requires pulling cards from MyP Store listings");
    expect(html).toContain("MyP Store Pull-Back");
    expect(html).toContain("Material Deck");
  });
});
