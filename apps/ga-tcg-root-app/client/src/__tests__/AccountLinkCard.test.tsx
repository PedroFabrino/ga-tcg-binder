import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountLinkCard } from "../components/AccountLinkCard";

describe("AccountLinkCard", () => {
  it("renders unlinked state with code input and portal button", () => {
    const html = renderToStaticMarkup(
      <AccountLinkCard
        isLinked={false}
        collectorName=""
        friendCode=""
        onLink={vi.fn()}
        portalUrl="https://ga-tcg-binder.vercel.app/settings/linked-accounts"
      />
    );

    expect(html).toContain("Link GA Binder Account");
    expect(html).toContain("Unlinked");
    expect(html).toContain("6-DIGIT CODE");
    expect(html).toContain("Link Account");
    expect(html).toContain("Get Code");
    expect(html).toContain("https://ga-tcg-binder.vercel.app/settings/linked-accounts");
  });

  it("renders linked state with collector name and friend code", () => {
    const html = renderToStaticMarkup(
      <AccountLinkCard
        isLinked={true}
        collectorName="Astraea"
        friendCode="AST-999"
        onLink={vi.fn()}
      />
    );

    expect(html).toContain("Connected Binder Account");
    expect(html).toContain("Connected");
    expect(html).toContain("Astraea");
    expect(html).toContain("AST-999");
    expect(html).not.toContain("6-DIGIT CODE");
  });

  it("renders Portuguese translations when locale is pt-BR", () => {
    const unlinkedHtml = renderToStaticMarkup(
      <AccountLinkCard
        isLinked={false}
        collectorName=""
        friendCode=""
        onLink={vi.fn()}
        locale="pt-BR"
      />
    );

    expect(unlinkedHtml).toContain("Vincular Conta do GA Binder");
    expect(unlinkedHtml).toContain("Não vinculado");
    expect(unlinkedHtml).toContain("CÓDIGO DE 6 DÍGITOS");
    expect(unlinkedHtml).toContain("Vincular Conta");
    expect(unlinkedHtml).toContain("Obter Código");

    const linkedHtml = renderToStaticMarkup(
      <AccountLinkCard
        isLinked={true}
        collectorName="Astraea"
        friendCode="AST-999"
        onLink={vi.fn()}
        locale="pt-BR"
      />
    );

    expect(linkedHtml).toContain("Conta do Fichário Conectada");
    expect(linkedHtml).toContain("Conectado");
    expect(linkedHtml).toContain("Colecionador");
    expect(linkedHtml).toContain("Friend Code");
  });
});
