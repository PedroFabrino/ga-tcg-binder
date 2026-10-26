import { describe, it, expect, vi } from "vitest";
import { processRootCommand } from "../command-handlers";
import type { RootBotApi } from "../root-bot-api";

describe("Root Command Handlers - Discord Parity Features", () => {
  const mockUserId = "root-user-123";

  it("handles /help command", async () => {
    const res = await processRootCommand(mockUserId, "/help", {} as RootBotApi);
    expect(res).toContain("Grand Archive Assistant Commands");
    expect(res).toContain("/register");
    expect(res).toContain("/decks add");
    expect(res).toContain("/wantlist add");
  });

  it("handles /register for newly registered collector", async () => {
    const mockClient = {
      register: vi.fn().mockResolvedValue({
        success: true,
        created: true,
        collector: {
          id: "col-1",
          name: "Alice",
          friendCode: "GA-XYZ789",
        },
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/register", mockClient);
    expect(mockClient.register).toHaveBeenCalledWith(mockUserId);
    expect(res).toContain("Account Created Successfully!");
    expect(res).toContain("GA-XYZ789");
  });

  it("handles /decks add <url>", async () => {
    const mockClient = {
      importDeck: vi.fn().mockResolvedValue({
        success: true,
        deck: { id: "d-1", name: "Rai Aggro" },
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(
      mockUserId,
      "/decks add https://omnidex.gg/deck/123",
      mockClient
    );
    expect(mockClient.importDeck).toHaveBeenCalledWith(mockUserId, {
      url: "https://omnidex.gg/deck/123",
    });
    expect(res).toContain('Deck "Rai Aggro" Imported Successfully!');
  });

  it("handles /decks update <deck> <url>", async () => {
    const mockClient = {
      getDecks: vi.fn().mockResolvedValue({
        decks: [{ id: "d-1", name: "Rai Aggro" }],
      }),
      updateDeck: vi.fn().mockResolvedValue({
        success: true,
        deck: { id: "d-1", name: "Rai Aggro" },
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(
      mockUserId,
      "/decks update Rai Aggro https://omnidex.gg/deck/456",
      mockClient
    );
    expect(mockClient.updateDeck).toHaveBeenCalledWith(mockUserId, {
      deckId: "d-1",
      url: "https://omnidex.gg/deck/456",
    });
    expect(res).toContain('Deck "Rai Aggro" Updated Successfully!');
  });

  it("handles /decks add with raw decklist text", async () => {
    const mockClient = {
      importDeck: vi.fn().mockResolvedValue({
        success: true,
        deck: { id: "d-2", name: "Merlin Combo" },
      }),
    } as unknown as RootBotApi;

    const rawDeckText = "Material Deck\n1 Spirit of Fire\n\nMain Deck\n4 Fireball";
    const res = await processRootCommand(
      mockUserId,
      `/decks add ${rawDeckText}`,
      mockClient
    );
    expect(mockClient.importDeck).toHaveBeenCalledWith(mockUserId, {
      text: rawDeckText,
    });
    expect(res).toContain('Deck "Merlin Combo" Imported Successfully!');
  });

  it("handles /decks update <deck> with raw decklist text", async () => {
    const mockClient = {
      getDecks: vi.fn().mockResolvedValue({
        decks: [{ id: "d-1", name: "Rai Aggro" }],
      }),
      updateDeck: vi.fn().mockResolvedValue({
        success: true,
        deck: { id: "d-1", name: "Rai Aggro" },
      }),
    } as unknown as RootBotApi;

    const rawDeckText = "Material Deck\n1 Spirit of Fire\n\nMain Deck\n4 Fireball";
    const res = await processRootCommand(
      mockUserId,
      `/decks update Rai Aggro\n${rawDeckText}`,
      mockClient
    );
    expect(mockClient.updateDeck).toHaveBeenCalledWith(mockUserId, {
      deckId: "d-1",
      text: rawDeckText,
    });
    expect(res).toContain('Deck "Rai Aggro" Updated Successfully!');
  });

  it("handles /shortages with no arguments to list user decks", async () => {
    const mockClient = {
      getDecks: vi.fn().mockResolvedValue({
        collectorId: "col-1",
        collectorName: "Alice",
        decks: [
          {
            id: "d-1",
            name: "Fire Deck",
            completionPercentage: 80,
            hardShortageCount: 2,
            sharedShortageCount: 1,
          },
        ],
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/shortages", mockClient);
    expect(res).toContain("Shortages Overview");
    expect(res).toContain("/shortages Fire Deck");
  });

  it("handles /shortages with suggestions when deck is not found", async () => {
    const mockClient = {
      getShortages: vi.fn().mockRejectedValue(new Error("Deck not found")),
      autocomplete: vi.fn().mockResolvedValue({
        results: [{ name: "Fire Aggro" }],
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/shortages Fire", mockClient);
    expect(res).toContain('Deck "Fire" Not Found');
    expect(res).toContain("Did you mean one of these active decks?");
    expect(res).toContain("/shortages Fire Aggro");
  });

  it("handles /collection without query to show portfolio summary", async () => {
    const mockClient = {
      getPortfolio: vi.fn().mockResolvedValue({
        collectorId: "col-1",
        portfolio: {
          collectorId: "col-1",
          collectorName: "Alice",
          friendCode: "GA-XYZ789",
          totalCards: 120,
          uniqueCards: 45,
          foilCards: 10,
          normalCards: 110,
          dedicatedCards: 60,
          idleCards: 60,
          elements: [{ element: "fire", count: 40 }],
          profileUrl: "https://gatcg.com/u/GA-XYZ789",
        },
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/collection", mockClient);
    expect(mockClient.getPortfolio).toHaveBeenCalledWith(mockUserId);
    expect(res).toContain("Alice's Binder Portfolio");
    expect(res).toContain("Total Cards:** **120**");
    expect(res).toContain("10 ★ Foil");
  });

  it("handles /wantlist add with card suggestions when ambiguous", async () => {
    const mockClient = {
      addWant: vi.fn().mockResolvedValue({
        suggestions: [{ name: "Fireball" }, { name: "Flame Wave" }],
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/wantlist add Flame", mockClient);
    expect(res).toContain('Multiple cards matched "Flame"');
    expect(res).toContain("/wantlist add Fireball");
    expect(res).toContain("/wantlist add Flame Wave");
  });

  it("handles /wantlist add with single exact match", async () => {
    const mockClient = {
      addWant: vi.fn().mockResolvedValue({
        card: { slug: "fireball", name: "Fireball" },
        desiredQuantity: 2,
        foil: true,
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/wantlist add Fireball 2 foil", mockClient);
    expect(mockClient.addWant).toHaveBeenCalledWith(mockUserId, {
      card: "Fireball",
      quantity: 2,
      foil: true,
    });
    expect(res).toContain("Added **Fireball** x2 (★ Foil)");
  });

  it("handles /wantlist remove without card to list personal wants", async () => {
    const mockClient = {
      getPersonalWants: vi.fn().mockResolvedValue({
        personalWants: [
          {
            cardName: "Fireball",
            desiredQuantity: 2,
            foil: true,
          },
        ],
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(mockUserId, "/wantlist remove", mockClient);
    expect(res).toContain("Your Personal Wishlist Cards");
    expect(res).toContain("/wantlist remove Fireball");
  });

  it("handles /wantlist add-omnidex <url>", async () => {
    const mockClient = {
      addWant: vi.fn().mockResolvedValue({
        importedOmnidex: true,
        omnidexStats: {
          addedCardsCount: 3,
          addedCopiesCount: 6,
          skippedCopiesCount: 10,
        },
      }),
    } as unknown as RootBotApi;

    const res = await processRootCommand(
      mockUserId,
      "/wantlist add-omnidex https://omnidex.gg/deck/abc",
      mockClient
    );
    expect(mockClient.addWant).toHaveBeenCalledWith(mockUserId, {
      omnidexUrl: "https://omnidex.gg/deck/abc",
    });
    expect(res).toContain("Omnidex Shortages Imported to Personal Wants!");
    expect(res).toContain("Added **3** unique cards (**6** total copies missing)");
  });
});
