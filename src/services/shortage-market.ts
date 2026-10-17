import {
  parseBrlPrice,
  calculateNetMarketStock,
  evaluatePriceFairness,
  type PriceFairnessEvaluation,
} from "./marketplace";

export interface MarketShortageAvailability {
  mypAvailableCopies?: number;
  marketAvailableCopies?: number;
  marketLowestPriceBrl?: number;
  marketLowestPriceStr?: string;
  marketProductUrl?: string | null;
  marketTcgPrice?: string | null;
  marketTcgPriceNumeric?: number | null;
  marketPriceFairness?: PriceFairnessEvaluation | null;
  marketVendorName?: string | null;
  marketVendorUrl?: string | null;
}

export interface MarketListingRow {
  cardSlug: string | null;
  editionId: string | null;
  setPrefix: string | null;
  mypItemId: string | null;
  quantity: number;
  price: string;
  priceNumeric: number | null;
  tcgPrice: string | null;
  tcgPriceNumeric: number | null;
  mypProductUrl: string | null;
  vendorName: string | null;
  vendorUrl: string | null;
}

export interface UserMypListingRow {
  cardSlug: string | null;
  editionId: string | null;
  setPrefix: string | null;
  mypItemId: string | null;
  quantity: number;
}

/**
 * Resolves MyP store and market availability, pricing, price fairness, and vendor details for a card.
 */
export function resolveMarketAvailability(
  cardSlug: string,
  marketListings: MarketListingRow[],
  userMypListings: UserMypListingRow[]
): MarketShortageAvailability {
  const userMypCopies = userMypListings
    .filter((m) => m.cardSlug === cardSlug)
    .reduce((sum, m) => sum + m.quantity, 0);

  const relevantMarketRows = marketListings.filter((m) => m.cardSlug === cardSlug);

  let marketAvailableCopies = 0;
  let lowestPriceBrl = Infinity;
  let lowestPriceStr: string | undefined = undefined;
  let marketProductUrl: string | null = null;
  let lowestPriceTcgStr: string | null = null;
  let lowestPriceTcgNum: number | null = null;
  let marketVendorName: string | null = null;
  let marketVendorUrl: string | null = null;

  for (const mRow of relevantMarketRows) {
    const { netExternalStock } = calculateNetMarketStock(mRow, userMypListings);

    if (netExternalStock > 0) {
      marketAvailableCopies += netExternalStock;
      const priceNum = Number(mRow.priceNumeric) || parseBrlPrice(mRow.price);
      if (priceNum < lowestPriceBrl) {
        lowestPriceBrl = priceNum;
        lowestPriceStr = mRow.price;
        marketProductUrl = mRow.mypProductUrl;
        lowestPriceTcgStr = mRow.tcgPrice || null;
        lowestPriceTcgNum =
          mRow.tcgPriceNumeric !== null && mRow.tcgPriceNumeric !== undefined
            ? Number(mRow.tcgPriceNumeric)
            : null;
        marketVendorName = mRow.vendorName || null;
        marketVendorUrl = mRow.vendorUrl || null;
      }
    }
  }

  const marketPriceFairness =
    lowestPriceBrl !== Infinity
      ? evaluatePriceFairness(lowestPriceBrl, lowestPriceTcgNum, lowestPriceTcgStr)
      : null;

  return {
    mypAvailableCopies: userMypCopies > 0 ? userMypCopies : undefined,
    marketAvailableCopies: marketAvailableCopies > 0 ? marketAvailableCopies : undefined,
    marketLowestPriceBrl: lowestPriceBrl === Infinity ? undefined : lowestPriceBrl,
    marketLowestPriceStr: lowestPriceStr,
    marketProductUrl,
    marketTcgPrice: lowestPriceTcgStr,
    marketTcgPriceNumeric: lowestPriceTcgNum,
    marketPriceFairness,
    marketVendorName,
    marketVendorUrl,
  };
}
