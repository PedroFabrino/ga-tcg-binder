import type { Card, ElementKey, SetPrefix } from "../types/card";

type Printing = [SetPrefix, string, string, number, boolean];

function card(slug: string, name: string, element: ElementKey, cardClass: string, type: string, printings: Printing[]): Card {
  return {
    slug,
    name,
    element,
    cardClass,
    type,
    editions: printings.map(([setPrefix, setName, collectorNumber, rarity, foilAvailable]) => ({
      id: `mock-${slug}-${setPrefix}-${collectorNumber}`,
      cardSlug: slug,
      setPrefix,
      setName,
      collectorNumber,
      rarity,
      imageUrl: null,
      foilAvailable,
    })),
  };
}

export const MOCK_CARDS: Card[] = [
  card("lorraine-wandering-warrior", "Lorraine, Wandering Warrior", "NORM", "Warrior", "Champion", [["DOA", "Dawn of Ashes", "001", 4, true]]),
  card("fireball", "Fireball", "FIRE", "Mage", "Action", [["DOA", "Dawn of Ashes", "042", 1, true], ["P24", "Promo 2024", "007", 5, true]]),
  card("tidal-flux", "Tidal Flux", "WATER", "Mage", "Action", [["FTC", "Fractured Crown", "118", 2, true]]),
  card("zephyr-blade", "Zephyr Blade", "WIND", "Warrior", "Weapon", [["ALC", "Alchemical Revolution", "063", 3, true]]),
  card("stoneheart-sentinel", "Stoneheart Sentinel", "EARTH", "Guardian", "Ally", [["MRC", "Mercurial Heart", "091", 2, false]]),
  card("radiant-oath", "Radiant Oath", "LUXEM", "Cleric", "Action", [["FTC", "Fractured Crown", "027", 3, true]]),
  card("umbral-reaper", "Umbral Reaper", "UMBRA", "Assassin", "Ally", [["ALC", "Alchemical Revolution", "144", 4, true]]),
  card("ember-familiar", "Ember Familiar", "FIRE", "Mage", "Ally", [["MRC", "Mercurial Heart", "015", 1, true]]),
  card("gale-of-severance", "Gale of Severance", "WIND", "Ranger", "Action", [["DOA", "Dawn of Ashes", "176", 2, true]]),
  card("crux-sight", "Crux Sight", "NORM", "Cleric", "Item", [["P24", "Promo 2024", "019", 5, true]]),
];
