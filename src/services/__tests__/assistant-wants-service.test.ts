import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addWantToAssistant,
  removeWantFromAssistant,
  getAutocompleteChoices,
  importAssistantDeckFromSource,
} from "../assistant-wants-service";
import * as personalWantsRepo from "../../db/repositories/personal-wants-repository";
import * as catalogRepo from "../../db/repositories/catalog-repository";
import * as omnidexWants from "../omnidex-wants";
import * as omnidex from "../omnidex";
import * as collectorAssistant from "../collector-assistant";

vi.mock("../../db/repositories/personal-wants-repository");
vi.mock("../../db/repositories/catalog-repository");
vi.mock("../omnidex-wants");
vi.mock("../omnidex");
vi.mock("../collector-assistant");

describe("assistant-wants-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addWantToAssistant", () => {
    it("adds a single exact card match to personal wants", async () => {
      vi.mocked(catalogRepo.findCardBySlugOrName).mockResolvedValue({
        id: "card-1",
        slug: "fireball",
        name: "Fireball",
        element: "FIRE",
        type: "ACTION",
        class: "MAGE",
        subtypes: "[]",
      } as any);

      vi.mocked(personalWantsRepo.upsertPersonalWant).mockResolvedValue({
        id: "want-1",
        collectorId: "col-1",
        cardSlug: "fireball",
        desiredQuantity: 2,
        foil: true,
        source: "manual",
      } as any);

      const res = await addWantToAssistant("col-1", {
        cardInput: "Fireball",
        quantity: 2,
        foil: true,
      });

      expect(res.card?.slug).toBe("fireball");
      expect(res.desiredQuantity).toBe(2);
      expect(res.foil).toBe(true);
      expect(personalWantsRepo.upsertPersonalWant).toHaveBeenCalledWith(
        expect.objectContaining({
          collectorId: "col-1",
          cardSlug: "fireball",
          desiredQuantity: 2,
          foil: true,
        }),
        undefined
      );
    });

    it("returns suggestions when query matches multiple cards", async () => {
      vi.mocked(catalogRepo.findCardBySlugOrName).mockResolvedValue(undefined);
      vi.mocked(catalogRepo.searchCardsForAutocomplete).mockResolvedValue([
        { slug: "fireball", name: "Fireball", element: "FIRE", type: "ACTION", class: "MAGE" } as any,
        { slug: "flame-wave", name: "Flame Wave", element: "FIRE", type: "ACTION", class: "MAGE" } as any,
      ]);

      const res = await addWantToAssistant("col-1", {
        cardInput: "Flame",
      });

      expect(res.suggestions).toHaveLength(2);
      expect(res.card).toBeUndefined();
      expect(personalWantsRepo.upsertPersonalWant).not.toHaveBeenCalled();
    });

    it("imports from omnidex url when provided", async () => {
      vi.mocked(omnidex.fetchDeckFromUrl).mockResolvedValue({
        name: "Omni Deck",
        decklist: "1 Fireball\n",
      } as any);

      vi.mocked(omnidexWants.importOmnidexDeckToPersonalWants).mockResolvedValue({
        addedCardsCount: 1,
        addedCopiesCount: 1,
        skippedCopiesCount: 0,
      });

      const res = await addWantToAssistant("col-1", {
        omnidexUrl: "https://omnidex.gg/deck/123",
      });

      expect(res.importedOmnidex).toBe(true);
      expect(res.omnidexStats?.addedCardsCount).toBe(1);
    });
  });

  describe("removeWantFromAssistant", () => {
    it("removes exact match from personal wants", async () => {
      vi.mocked(personalWantsRepo.listPersonalWants).mockResolvedValue([
        {
          id: "w-1",
          collectorId: "col-1",
          cardSlug: "fireball",
          cardName: "Fireball",
          desiredQuantity: 2,
        } as any,
      ]);

      vi.mocked(personalWantsRepo.removePersonalWant).mockResolvedValue({
        success: true,
        removed: true,
        remainingQuantity: 0,
      });

      const res = await removeWantFromAssistant("col-1", {
        cardInput: "Fireball",
      });

      expect(res.success).toBe(true);
      expect(res.removed).toBe(true);
      expect(res.cardName).toBe("Fireball");
    });

    it("returns suggestions when multiple wants match query", async () => {
      vi.mocked(personalWantsRepo.listPersonalWants).mockResolvedValue([
        {
          id: "w-1",
          collectorId: "col-1",
          cardSlug: "fire-sword",
          cardName: "Fire Sword",
          desiredQuantity: 2,
        } as any,
        {
          id: "w-2",
          collectorId: "col-1",
          cardSlug: "fire-shield",
          cardName: "Fire Shield",
          desiredQuantity: 1,
        } as any,
      ]);

      const res = await removeWantFromAssistant("col-1", {
        cardInput: "Fire",
      });

      expect(res.suggestions).toHaveLength(2);
      expect(res.success).toBe(false);
    });
  });

  describe("getAutocompleteChoices", () => {
    it("searches catalog cards for card autocomplete", async () => {
      vi.mocked(catalogRepo.searchCardsForAutocomplete).mockResolvedValue([
        { slug: "fireball", name: "Fireball", element: "FIRE", type: "ACTION", class: "MAGE" } as any,
      ]);

      const choices = await getAutocompleteChoices("col-1", "card", "fire");
      expect(choices).toEqual([
        { name: "Fireball", value: "fireball", element: "FIRE", type: "ACTION" },
      ]);
    });

    it("searches personal wants for wants autocomplete", async () => {
      vi.mocked(personalWantsRepo.listPersonalWants).mockResolvedValue([
        {
          cardSlug: "fireball",
          cardName: "Fireball",
          desiredQuantity: 3,
          element: "FIRE",
          type: "ACTION",
          foil: false,
        } as any,
      ]);

      const choices = await getAutocompleteChoices("col-1", "wants", "fire");
      expect(choices).toHaveLength(1);
      expect(choices[0].name).toBe("Fireball");
      expect(choices[0].quantity).toBe(3);
    });
  });

  describe("importAssistantDeckFromSource", () => {
    it("imports deck from url", async () => {
      vi.mocked(omnidex.fetchDeckFromUrl).mockResolvedValue({
        name: "My Rai Deck",
        decklist: "1 Rai\n",
      } as any);

      vi.mocked(omnidexWants.importOmnidexDeckToCollection).mockResolvedValue({
        id: "deck-123",
        name: "My Rai Deck",
      });

      const res = await importAssistantDeckFromSource("col-1", {
        url: "https://silvie.gg/deck/abc",
      });

      expect(res.id).toBe("deck-123");
      expect(res.name).toBe("My Rai Deck");
    });
  });
});
