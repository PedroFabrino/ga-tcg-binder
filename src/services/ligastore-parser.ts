/**
 * Pure LigaStore HTML parser utilities.
 *
 * These parsers intentionally use small, dependency-free regular-expression
 * helpers because they run against server-provided LigaStore HTML fragments.
 */

import {
  DEFAULT_PRICE,
  decodeHtml,
  stripHtml,
  getAttribute,
  findDivContentByClasses,
  normalizePrice,
  priceToNumeric,
  getSpriteText,
  extractRefId,
  decodeLigaStoreSpriteClasses,
} from "./ligastore-html-utils";

export { decodeLigaStoreSpriteClasses } from "./ligastore-html-utils";

export interface ParsedLigaStoreItem {
  rawTitle: string;
  /** Canonical alias for `rawTitle` (expand phase). */
  rawName?: string;
  cardName: string;
  collectorNumber: string;
  setPrefix?: string;
  isFoil: boolean;
  productUrl: string;
  refId: string;
  /** Canonical alias for `refId` (expand phase). */
  itemId?: string | null;
  imageUrl: string;
  price: string;
  priceNumeric: number;
  quantity: number;
  hasPrice?: boolean;
}

export interface ParsedLigaStoreSearchResult {
  items: ParsedLigaStoreItem[];
  totalCount: number;
}

export interface ParsedLigaStoreItemDetails {
  condition: string;
  language: string;
  price: string;
  priceNumeric: number;
  stockQuantity: number;
  editionCode: string | null;
}

export function hasPriceBlock(cardHtml: string): boolean {
  return /<div\b[^>]*\bclass=(["'])[^"']*\b(?:price|card-preco)\b[^"']*\1[^>]*>/i.test(cardHtml);
}

export function extractTitle(rawTitle: string): {
  cardName: string;
  collectorNumber: string;
  setPrefix?: string;
} {
  const normalized = stripHtml(rawTitle);
  const collectorMatch = normalized.match(/\s*\(#\s*([a-z\d-]+)\)\s*$/i);

  const collectorNumber = collectorMatch ? collectorMatch[1] : "";
  let working = collectorMatch
    ? normalized.slice(0, collectorMatch.index)
    : normalized;

  // Extract set code if present in parentheses e.g. (ALC1E), (DOA1E), (FTC)
  let setPrefix: string | undefined;
  const setMatch = working.match(/\s*\(([a-z]{3,5}(?:\d[e])?)\)\s*/i);
  if (setMatch) {
    setPrefix = setMatch[1].toUpperCase();
    working = working.replace(setMatch[0], " ");
  }

  // Strip variant/finish parentheses e.g. (CSR), (Curio Foil), (Cur...), (Foil), etc.
  const cleanedName = working
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    cardName: cleanedName || normalized,
    collectorNumber,
    setPrefix,
  };
}

function extractCardBlocks(html: string): string[] {
  const marker = /<div\b(?=[^>]*\bclass=(["'])[^"']*\bcard-item\b[^"']*\1)[^>]*>/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = marker.exec(html))) {
    starts.push(match.index);
  }

  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

function extractPlainOrSpritePrice(
  cardHtml: string,
  spriteClasses: Map<string, string>
): string {
  const priceContainer = findDivContentByClasses(cardHtml, ["card-preco"]);
  const source = priceContainer || cardHtml;

  const plainPrice = normalizePrice(stripHtml(source));
  if (plainPrice !== DEFAULT_PRICE) {
    return plainPrice;
  }

  const spriteText = getSpriteText(source, spriteClasses);
  const spritePrice = normalizePrice(spriteText);
  if (spritePrice !== DEFAULT_PRICE) {
    return spritePrice;
  }

  const dataPrice = source.match(/\bdata-(?:price|preco)\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
  return normalizePrice(dataPrice);
}

export function isOutOfStockHtml(cardHtml: string): boolean {
  if (/\b(?:sem\s+estoque|indispon[íi]vel|esgotado|avise-me|fora\s+de\s+estoque)\b/i.test(cardHtml)) {
    return true;
  }
  if (/\bclass=["'][^"']*\b(?:indisponivel|sem-estoque|btn-aviseme)\b/i.test(cardHtml)) {
    return true;
  }
  const zeroUnidMatch = stripHtml(cardHtml).match(/\b0\s*(?:unid|un)\.?/i);
  if (zeroUnidMatch) {
    return true;
  }
  return false;
}

function extractQuantity(cardHtml: string, spriteClasses: Map<string, string>): number {
  if (isOutOfStockHtml(cardHtml)) {
    return 0;
  }

  const plainMatch = stripHtml(cardHtml).match(/\b(\d+)\s*(?:unid|un)\.?/i);
  if (plainMatch) {
    return Number(plainMatch[1]);
  }

  const maxMatch = cardHtml.match(/\bmax=["'](\d+)["']/i);
  if (maxMatch) {
    return Number(maxMatch[1]);
  }

  const dataMatch = cardHtml.match(/\bdata-(?:qty|quantity|stock)=["'](\d+)["']/i);
  if (dataMatch) {
    return Number(dataMatch[1]);
  }

  const spriteText = getSpriteText(cardHtml, spriteClasses);
  const spriteMatch = spriteText.match(/\b(\d+)\s*unid\.?/i);
  if (spriteMatch) {
    return Number(spriteMatch[1]);
  }

  return 1;
}

/**
 * Extracts the total number of listed items from LigaStore pagination markup.
 */
export function parseLigaStoreTotalCount(html: string): number {
  const match =
    html.match(
      /<td[^>]*class=(['"])[^"']*\btextoMaior\b[^"']*\1[^>]*>[\s\S]*?\bde\s*<b>\s*([\d.,]+)\s*<\/b>/i
    ) ?? html.match(/\bde\s+<b>\s*([\d.,]+)\s*<\/b>/i);

  if (match) {
    const rawDigits = (match[2] ?? match[1]).replace(/[.,]/g, "");
    const count = Number(rawDigits);
    if (Number.isFinite(count) && count > 0) {
      return count;
    }
  }

  const itensTotalMatch = decodeHtml(html).match(/[?&]itens_total=(\d+)/i);
  if (itensTotalMatch) {
    const count = Number(itensTotalMatch[1]);
    if (Number.isFinite(count)) {
      return count;
    }
  }

  return 0;
}

/**
 * Parses a LigaStore product-detail page.
 */
export function parseLigaStoreItemDetails(html: string): ParsedLigaStoreItemDetails {
  const qualityContent = findDivContentByClasses(html, ["table-cards-body-cell", "quality"]) || findDivContentByClasses(html, ["quality"]);
  const condition = (qualityContent.match(/\b(NM|SP|MP|HP|D)\b/i)?.[1] ||
    html.match(/<div[^>]*class=(['"])[^"']*\bquality\b[^"']*\1[^>]*>\s*(NM|SP|MP|HP|D)\s*<\/div>/i)?.[2] ||
    html.match(/\b(NM|SP|MP|HP|D)\b/i)?.[1] || "NM").toUpperCase();

  const languageContent = findDivContentByClasses(html, ["table-cards-body-cell", "tooltip-item", "text-center"]);
  const language = languageContent.match(/<img[^>]*\balt=(['"])(.*?)\1/i)?.[2] ||
    html.match(/<img[^>]*\balt=(['"])(Ingl[êe]s|Portugu[êe]s|EN|PT|JP|Japon[êe]s)\1/i)?.[2] ||
    stripHtml(languageContent) || "EN";

  const isOutOfStock = isOutOfStockHtml(html);
  const stockMatch = html.match(/<div[^>]*class=(['"])[^"']*\btable-cards-body-cell\b[^"']*\btooltip-item\b[^"']*\1[^>]*>\s*(\d+)\s*unid\./i) ||
    html.match(/\b(\d+)\s*unid\./i) ||
    html.match(/\bmax=["'](\d+)["']/i);
  const stockQuantity = isOutOfStock ? 0 : Number(stockMatch?.[2] ?? stockMatch?.[1] ?? 0);

  const priceContent = findDivContentByClasses(html, ["card-preco"]);
  const price = normalizePrice(priceContent || html);

  const editionCode =
    html.match(
      /<span[^>]*class=(['"])[^"']*\bsiglaEdicao\b[^"']*\1[^>]*>\s*([^<]+?)\s*<\/span>/i
    )?.[2]?.trim() ??
    html.match(
      /<(?:a|span)[^>]*class=(['"])[^"']*\b(?:edicao|edition)\b[^"']*\1[^>]*>\s*([^<]+?)\s*<\/(?:a|span)>/i
    )?.[2]?.trim() ??
    null;

  return {
    condition,
    language: stripHtml(language),
    price,
    priceNumeric: priceToNumeric(price),
    stockQuantity,
    editionCode,
  };
}

/**
 * Parses all card-item entries from a LigaStore search-result page.
 */
export function parseLigaStoreSearchPage(html: string): ParsedLigaStoreSearchResult {
  const spriteClasses = decodeLigaStoreSpriteClasses(html);

  const items = extractCardBlocks(html).map((cardHtml): ParsedLigaStoreItem => {
    const anchors = [...cardHtml.matchAll(/<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)];
    const titleAnchor =
      anchors.find((anchor) => stripHtml(anchor[3]).length > 0 && /[?&]refid=/i.test(anchor[2])) ??
      anchors.find((anchor) => stripHtml(anchor[3]).length > 0);
    const productAnchor =
      titleAnchor ?? anchors.find((anchor) => /[?&]refid=/i.test(anchor[2])) ?? anchors[0];

    const productUrl = decodeHtml(productAnchor?.[2] ?? "");
    const rawTitle =
      stripHtml(titleAnchor?.[3] ?? "") ||
      getAttribute(titleAnchor?.[0] ?? "", "title") ||
      stripHtml(productAnchor?.[3] ?? "") ||
      getAttribute(productAnchor?.[0] ?? "", "title");
    const title = extractTitle(rawTitle);

    const imageTag = cardHtml.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const imageUrl =
      getAttribute(imageTag, "data-src") || getAttribute(imageTag, "src");

    const price = extractPlainOrSpritePrice(cardHtml, spriteClasses);

    const hasPrice = hasPriceBlock(cardHtml) && !isOutOfStockHtml(cardHtml);
    const refId = extractRefId(productUrl);
    return {
      rawTitle,
      rawName: rawTitle,
      cardName: title.cardName,
      collectorNumber: title.collectorNumber,
      setPrefix: title.setPrefix,
      isFoil: /<img\b[^>]*\balt=(['"])FOIL\1/i.test(cardHtml),
      productUrl,
      refId,
      itemId: refId,
      imageUrl,
      price,
      priceNumeric: priceToNumeric(price),
      quantity: hasPrice ? Math.max(1, extractQuantity(cardHtml, spriteClasses)) : 0,
      hasPrice,
    };
  });

  return {
    items,
    totalCount: parseLigaStoreTotalCount(html),
  };
}

/**
 * Parses the refId of the most recently added card from a LigaStore
 * latest-additions search page (txt_order=12&ultimas=1).
 *
 * Returns the refId string, or null if the page is empty or unparseable.
 */
export function parseLigaStoreLatestCardRefId(html: string): string | null {
  const blocks = extractCardBlocks(html);
  if (blocks.length > 0) {
    const anchors = [...blocks[0].matchAll(/<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>/gi)];
    const productAnchor = anchors.find((anchor) => /[?&]refid=/i.test(anchor[2]));
    if (productAnchor) {
      const refId = extractRefId(decodeHtml(productAnchor[2]));
      if (refId) return refId;
    }
    const blockMatch = blocks[0].match(/[?&]refid=([^&#"'\s>]+)/i);
    if (blockMatch?.[1]) {
      try {
        return decodeURIComponent(blockMatch[1]);
      } catch {
        return blockMatch[1];
      }
    }
  }

  const match = html.match(/[?&]refid=([^&#"'\s>]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return null;
}

export interface LigaStoreConfig {
  ecomId: string;
  hasWorkingStockFilter: boolean;
  limit: number;
  order: number;
  ultimas: string;
}

export const LIGA_STORE_CONFIGS: Record<string, LigaStoreConfig> = {
  brandao: {
    ecomId: "207836",
    hasWorkingStockFilter: true,
    limit: 30,
    order: 6,
    ultimas: "1",
  },
  tabletopsorocaba: {
    ecomId: "546923",
    hasWorkingStockFilter: false,
    limit: 120,
    order: 1,
    ultimas: "",
  },
  tabletop_sorocaba: {
    ecomId: "546923",
    hasWorkingStockFilter: false,
    limit: 120,
    order: 1,
    ultimas: "",
  },
};

/**
 * Retired (ADR-0025): builds the LigaStore search URL. Kept alongside the
 * retired parser for reference; LigaStore is no longer crawled.
 */
export function buildLigaStoreSearchUrl(
  store: { baseUrl: string | null; tcgId?: string | null; id: string },
  sort: "count" | "latest" = "count"
): string | null {
  if (!store.baseUrl) {
    return null;
  }

  const baseUrl = store.baseUrl.replace(/\/+$/, "");
  const tcgId = store.tcgId ?? "21";
  const config = LIGA_STORE_CONFIGS[store.id.toLowerCase()] || {
    ecomId: store.id,
    hasWorkingStockFilter: true,
    limit: 30,
    order: 6,
    ultimas: "1",
  };

  const storeIdParam = `&id=${encodeURIComponent(config.ecomId)}`;
  const orderParam = sort === "latest" ? "txt_order=12" : `txt_order=${config.order}`;
  const ultimasParam = sort === "latest" ? "ultimas=1" : (config.ultimas ? `ultimas=${config.ultimas}` : "ultimas=");
  const stockParam = config.hasWorkingStockFilter ? "&txt_estoque=1" : "";

  return (
    `${baseUrl}/?view=ecom/itens&page=1&id=${encodeURIComponent(config.ecomId)}&comdesconto=&tcg=${encodeURIComponent(tcgId)}&txt_idioma=&txt_qualid=&${ultimasParam}&txt_filtro_multiestoque=&txt_extras%5B%5D=&${orderParam}&txt_raridade=&txt_cor=&txt_limit=${config.limit}${stockParam}&btFiltrar=Filtrar`
  );
}
