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

    expect(html).toContain('aria-label="Info: Shortages"');
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

    expect(html).toContain('aria-label="Informações: Compra Necessária"');
    expect(html).toContain(
      "Cartas das quais você não possui cópias suficientes no fichário nem para montar um único deck."
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
    expect(html).toContain('id="nomenclature-term-shortages"');
    expect(html).toContain('id="nomenclature-term-hardShortages"');
    expect(html).toContain('id="nomenclature-term-sharedShortages"');
    expect(html).toContain('id="nomenclature-term-alertScope"');
    expect(html).toContain('id="nomenclature-term-wantlist"');
    expect(html).toContain('id="nomenclature-term-omnidexFormat"');

    expect(html).toContain("Shortages");
    expect(html).toContain("Hard Shortages");
    expect(html).toContain("Shared Shortages");
    expect(html).toContain("Alert Scope");
    expect(html).toContain("Personal Wantlist");
    expect(html).toContain("Omnidex Format");
  });

  it("renders all 6 terms in Portuguese", () => {
    const html = renderToStaticMarkup(
      <NomenclatureGuideCard locale="pt-BR" />
    );

    expect(html).toContain("Nomenclatura do Domínio Grand Archive");
    expect(html).toContain("Glossário de referência para inventário");
    expect(html).toContain("Cartas Necessárias");
    expect(html).toContain("Compra Necessária");
    expect(html).toContain("Revezamento entre Decks");
    expect(html).toContain("Escopo de Alertas");
    expect(html).toContain("Lista de Desejos Pessoal");
    expect(html).toContain("Formato Omnidex");
    expect(html).toContain("Exemplo: Um deck precisa de 4x &#x27;Fireball&#x27;");
  });

  it("applies highlight styling to the active term", () => {
    const html = renderToStaticMarkup(
      <NomenclatureGuideCard locale="en" highlightedTerm="hardShortages" />
    );

    expect(html).toContain('id="nomenclature-term-hardShortages"');
    expect(html).toContain("border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-500/40");
  });
});
