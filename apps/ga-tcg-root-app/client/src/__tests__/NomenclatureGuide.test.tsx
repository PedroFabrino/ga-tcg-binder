import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InfoTermBadge } from "../components/InfoTermBadge";
import { NomenclatureGuideCard } from "../components/NomenclatureGuideCard";

describe("InfoTermBadge", () => {
  it("renders accessible button and tooltip for shortages", () => {
    const html = renderToStaticMarkup(
      <InfoTermBadge term="shortages" locale="en" />
    );

    expect(html).toContain('aria-label="Info: Shortages (Cartas Necessárias)"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain(
      "Cards missing from your inventory to complete one or more constructed decks."
    );
    expect(html).toContain("Learn more in the Nomenclature Guide below");
  });

  it("renders Portuguese tooltip when locale is pt-BR", () => {
    const html = renderToStaticMarkup(
      <InfoTermBadge term="hardShortages" locale="pt-BR" />
    );

    expect(html).toContain(
      "Cartas que você não possui em quantidade suficiente no acervo"
    );
    expect(html).toContain("Saiba mais no Guia de Nomenclatura abaixo");
  });
});

describe("NomenclatureGuideCard", () => {
  it("renders all 6 terms in English", () => {
    const html = renderToStaticMarkup(
      <NomenclatureGuideCard locale="en" />
    );

    expect(html).toContain("Grand Archive Domain Nomenclature");
    expect(html).toContain("id=\"nomenclature-shortages\"");
    expect(html).toContain("id=\"nomenclature-hardShortages\"");
    expect(html).toContain("id=\"nomenclature-sharedShortages\"");
    expect(html).toContain("id=\"nomenclature-alertScope\"");
    expect(html).toContain("id=\"nomenclature-wantlist\"");
    expect(html).toContain("id=\"nomenclature-omnidexFormat\"");

    expect(html).toContain("Shortages (Cartas Necessárias)");
    expect(html).toContain("Hard Shortages (Compra Necessária)");
    expect(html).toContain("Shared Shortages (Revezamento entre Decks)");
    expect(html).toContain("Alert Scope (Escopo de Alertas)");
    expect(html).toContain("Personal Wantlist (Lista de Desejos)");
    expect(html).toContain("Omnidex Format (Formato Omnidex)");
  });

  it("renders all 6 terms in Portuguese", () => {
    const html = renderToStaticMarkup(
      <NomenclatureGuideCard locale="pt-BR" />
    );

    expect(html).toContain("Nomenclatura do Domínio Grand Archive");
    expect(html).toContain("Glossário de referência para inventário");
    expect(html).toContain("Exemplo: Se você precisa de 4 cópias");
    expect(html).toContain("Exemplo: 2 decks precisam de 4x &#x27;Fireball&#x27;");
  });

  it("applies highlight styling to the active term", () => {
    const html = renderToStaticMarkup(
      <NomenclatureGuideCard locale="en" highlightedTerm="hardShortages" />
    );

    expect(html).toContain('id="nomenclature-hardShortages"');
    expect(html).toContain("border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-500/40");
  });
});
