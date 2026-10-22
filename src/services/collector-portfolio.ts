import { getUserCollectionItems } from "../db/repositories/collection-repository";
import { findUserById } from "../db/repositories/auth-repository";
import type { AssistantPortfolioSummary } from "@ga/contracts";

/**
 * Calculates high-level portfolio metrics for a Collector's personal binder.
 */
export async function getCollectorPortfolioSummary(
  collectorId: string,
  database?: unknown
): Promise<AssistantPortfolioSummary> {
  const [items, user] = await Promise.all([
    getUserCollectionItems(collectorId, database as any),
    findUserById(collectorId, database as any),
  ]);

  let totalCards = 0;
  let foilCards = 0;
  let normalCards = 0;
  let dedicatedCards = 0;
  let idleCards = 0;
  const uniqueCardsSet = new Set<string>();
  const elementMap = new Map<string, number>();

  for (const item of items) {
    totalCards += item.quantity;
    uniqueCardsSet.add(item.cardSlug);

    if (item.foil) {
      foilCards += item.quantity;
    } else {
      normalCards += item.quantity;
    }

    if (item.isDedicated) {
      dedicatedCards += item.quantity;
    } else {
      idleCards += item.quantity;
    }

    const elem = (item.element || "norm").toLowerCase();
    elementMap.set(elem, (elementMap.get(elem) || 0) + item.quantity);
  }

  const elements = Array.from(elementMap.entries())
    .map(([element, count]) => ({ element, count }))
    .sort((a, b) => b.count - a.count);

  const friendCode = user?.friendCode || "";
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://gatcg.com";
  const profileUrl = `${baseUrl.replace(/\/+$/, "")}/u/${friendCode}`;

  return {
    collectorId,
    collectorName: user?.name ?? null,
    friendCode,
    totalCards,
    uniqueCards: uniqueCardsSet.size,
    foilCards,
    normalCards,
    dedicatedCards,
    idleCards,
    elements,
    profileUrl,
  };
}
