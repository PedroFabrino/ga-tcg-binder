import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../App";
import type { IAssistantRpcClient, StatusResponse } from "../types";
import { USER_LOCALE_STORAGE_KEY } from "../locale";

describe("App shell", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => store.set(key, String(val))),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it("renders header in English when locale is en", () => {
    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockReturnValue(new Promise(() => {})), // stays pending
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn(),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn(),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const html = renderToStaticMarkup(<App client={mockClient} locale="en" />);

    expect(html).toContain("Grand Archive Collector Assistant");
    expect(html).toContain("Refresh");
    expect(html).toContain('aria-pressed="true">EN</button>');
    expect(html).toContain('aria-pressed="false">PT-BR</button>');
    expect(html).toContain("Powered by Grand Archive Binder");
  });

  it("renders header in Portuguese when locale is pt-BR", () => {
    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockReturnValue(new Promise(() => {})),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn(),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn(),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const html = renderToStaticMarkup(<App client={mockClient} locale="pt-BR" />);

    expect(html).toContain("Assistente de Colecionador Grand Archive");
    expect(html).toContain("Atualizar");
    expect(html).toContain('aria-pressed="false">EN</button>');
    expect(html).toContain('aria-pressed="true">PT-BR</button>');
  });

  it("prioritizes localStorage language override", () => {
    localStorage.setItem(USER_LOCALE_STORAGE_KEY, "pt-BR");
    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockReturnValue(new Promise(() => {})),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn(),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn(),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const html = renderToStaticMarkup(<App client={mockClient} locale="en" />);

    expect(html).toContain("Assistente de Colecionador Grand Archive");
    expect(html).toContain('aria-pressed="true">PT-BR</button>');
  });

  it("synchronizes with linked status collector locale", () => {
    const linkedStatus: StatusResponse = {
      isLinked: true,
      collectorId: "col-1",
      collectorName: "Astraea",
      friendCode: "AST-123",
      notificationsEnabled: true,
      dealAlertMode: "hard",
      alertChannelId: "chan-1",
      isAdmin: false,
      locale: "pt-BR",
    };

    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockResolvedValue(linkedStatus),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn().mockResolvedValue({ decks: [] }),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn(),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const html = renderToStaticMarkup(
      <App client={mockClient} locale="en" initialStatus={linkedStatus} />
    );

    expect(html).toContain("Assistente de Colecionador Grand Archive");
    expect(html).toContain('aria-pressed="true">PT-BR</button>');
  });

  it("renders entire linked dashboard in English when locale is en", () => {
    const linkedStatus: StatusResponse = {
      isLinked: true,
      collectorId: "col-1",
      collectorName: "Astraea",
      friendCode: "AST-123",
      notificationsEnabled: true,
      dealAlertMode: "hard",
      alertChannelId: "chan-1",
      isAdmin: false,
      locale: "en",
    };

    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockResolvedValue(linkedStatus),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn().mockResolvedValue({ decks: [] }),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn().mockResolvedValue({ wants: [] }),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const html = renderToStaticMarkup(
      <App client={mockClient} locale="en" initialStatus={linkedStatus} />
    );

    expect(html).toContain("Connected Binder Account");
    expect(html).toContain("Market Deal Alerts");
    expect(html).toContain("Constructed Decks &amp; Shortages");
    expect(html).toContain("Personal Wishlist &amp; Wants");
    expect(html).not.toContain("Conta do Fichário Conectada");
    expect(html).not.toContain("Alertas de Ofertas de Mercado");
  });

  it("renders entire linked dashboard in Portuguese when locale is pt-BR", () => {
    const linkedStatus: StatusResponse = {
      isLinked: true,
      collectorId: "col-1",
      collectorName: "Astraea",
      friendCode: "AST-123",
      notificationsEnabled: true,
      dealAlertMode: "hard",
      alertChannelId: "chan-1",
      isAdmin: false,
      locale: "pt-BR",
    };

    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockResolvedValue(linkedStatus),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn().mockResolvedValue({ decks: [] }),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn().mockResolvedValue({ wants: [] }),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const html = renderToStaticMarkup(
      <App client={mockClient} locale="pt-BR" initialStatus={linkedStatus} />
    );

    expect(html).toContain("Conta do Fichário Conectada");
    expect(html).toContain("Alertas de Ofertas de Mercado");
    expect(html).toContain("Decks Construídos &amp; Cartas Faltantes");
    expect(html).toContain("Lista de Desejos Pessoal");
    expect(html).not.toContain("Connected Binder Account");
    expect(html).not.toContain("Market Deal Alerts");
  });

  it("renders NomenclatureGuideCard at bottom of page with anchor targets", () => {
    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockReturnValue(new Promise(() => {})),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn(),
      registerAccount: vi.fn(),
      autocomplete: vi.fn(),
      getPersonalWants: vi.fn(),
      addWant: vi.fn(),
      removeWant: vi.fn(),
      importDeck: vi.fn(),
      updateDeck: vi.fn(),
      getAdminSettings: vi.fn(),
      setBroadcastChannel: vi.fn(),
      provisionMarketChannels: vi.fn(),
    };

    const enHtml = renderToStaticMarkup(<App client={mockClient} locale="en" />);
    expect(enHtml).toContain("Grand Archive Domain Nomenclature");
    expect(enHtml).toContain('id="nomenclature-shortages"');
    expect(enHtml).toContain('id="nomenclature-hardShortages"');
    expect(enHtml).toContain('id="nomenclature-sharedShortages"');
    expect(enHtml).toContain('id="nomenclature-alertScope"');
    expect(enHtml).toContain('id="nomenclature-wantlist"');
    expect(enHtml).toContain('id="nomenclature-omnidexFormat"');

    const ptHtml = renderToStaticMarkup(<App client={mockClient} locale="pt-BR" />);
    expect(ptHtml).toContain("Nomenclatura do Domínio Grand Archive");
    expect(ptHtml).toContain('id="nomenclature-shortages"');
  });
});
