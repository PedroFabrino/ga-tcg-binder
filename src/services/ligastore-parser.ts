/**
 * Pure LigaStore HTML parser utilities.
 *
 * These parsers intentionally use small, dependency-free regular-expression
 * helpers because they run against server-provided LigaStore HTML fragments.
 */

export interface ParsedLigaStoreItem {
  rawTitle: string;
  cardName: string;
  collectorNumber: string;
  isFoil: boolean;
  productUrl: string;
  refId: string;
  imageUrl: string;
  price: string;
  priceNumeric: number;
  quantity: number;
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

interface SpriteRule {
  className: string;
  x: number;
  y: number;
  index: number;
}

const DEFAULT_PRICE = "R$ 0,00";

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16))
    );
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function getAttribute(tag: string, attribute: string): string {
  const expression = new RegExp(
    `\\b${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "i"
  );
  return decodeHtml(tag.match(expression)?.[2] ?? "");
}

function hasClass(tag: string, className: string): boolean {
  const classes = getAttribute(tag, "class").split(/\s+/);
  return classes.includes(className);
}

function findDivContentByClasses(html: string, requiredClasses: string[]): string {
  const expression = /<div\b[^>]*>[\s\S]*?<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(html))) {
    const openingTag = match[0].match(/^<div\b[^>]*>/i)?.[0] ?? "";
    if (requiredClasses.every((className) => hasClass(openingTag, className))) {
      return match[0].replace(/^<div\b[^>]*>/i, "").replace(/<\/div>$/i, "");
    }
  }

  return "";
}

function normalizePrice(value: string): string {
  const match = decodeHtml(value).match(/R\$\s*([\d.]+(?:,\d+)?|\d+(?:\.\d+)?)/i);
  if (!match) {
    return DEFAULT_PRICE;
  }

  const numericPart = match[1].replace(/\./g, "").replace(",", ".");
  const numeric = Number(numericPart);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PRICE;
  }

  return `R$ ${numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function priceToNumeric(price: string): number {
  const match = price.match(/R\$\s*([\d.]+,\d+|\d+(?:\.\d+)?)/i);
  if (!match) {
    return 0;
  }

  const value = match[1].includes(",")
    ? match[1].replace(/\./g, "").replace(",", ".")
    : match[1];

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseClassList(tag: string): string[] {
  return getAttribute(tag, "class").split(/\s+/).filter(Boolean);
}

function getSpriteText(html: string, spriteClasses: Map<string, string>): string {
  return html.replace(/<[^>]+>/g, (tag) => {
    const classes = parseClassList(tag);
    const digit = classes.map((className) => spriteClasses.get(className) ?? "").join("");
    return digit || " ";
  });
}

function extractRefId(url: string): string {
  const match = url.match(/[?&]refid=([^&#"']+)/i);
  if (!match) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function extractTitle(rawTitle: string): { cardName: string; collectorNumber: string } {
  const normalized = stripHtml(rawTitle);
  const collectorMatch = normalized.match(/\s*\(#\s*([a-z\d-]+)\)\s*$/i);

  if (!collectorMatch) {
    return {
      cardName: normalized,
      collectorNumber: "",
    };
  }

  const cardName = normalized
    .slice(0, collectorMatch.index)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

  return {
    cardName,
    collectorNumber: collectorMatch[1],
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

function extractQuantity(cardHtml: string, spriteClasses: Map<string, string>): number {
  const plainMatch = stripHtml(cardHtml).match(/\b(\d+)\s*unid\.?/i);
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
  return spriteMatch ? Number(spriteMatch[1]) : 0;
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
 * Decodes CSS sprite class names into their represented digits.
 */
export function decodeLigaStoreSpriteClasses(html: string): Map<string, string> {
  const styleBlocks = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  const style = styleBlocks.find(
    (block) => /background-position/i.test(block) && /\.[\w-]+\s*\{/i.test(block)
  );

  if (!style) {
    return new Map();
  }

  const rules: SpriteRule[] = [];
  const rulePattern =
    /\.([a-z_][\w-]*)[^{]*\{[^}]*\bbackground-position\s*:\s*(-?\d+)px\s+(-?\d+)px[^}]*\}/gi;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(style))) {
    rules.push({
      className: match[1],
      x: Number(match[2]),
      y: Number(match[3]),
      index: rules.length,
    });
  }

  const decoded = new Map<string, string>();

  for (const rule of rules) {
    const namedDigit =
      rule.className.match(
        /(?:^|[-_])(num(?:ero)?|digit|sprite|price|preco)[-_]?([0-9])$/i
      ) ?? rule.className.match(/(?:^|[-_])([0-9])$/);

    if (namedDigit) {
      decoded.set(rule.className, namedDigit[namedDigit.length - 1]);
    }

    if (/(comma|virgula|decimal)/i.test(rule.className)) {
      decoded.set(rule.className, ",");
    }
  }

  const unmapped = rules.filter((rule) => !decoded.has(rule.className));
  if (rules.length === 10 && unmapped.length > 0) {
    [...rules]
      .sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index)
      .forEach((rule, index) => {
        if (!decoded.has(rule.className)) {
          decoded.set(rule.className, String(index));
        }
      });
  }

  return decoded;
}

/**
 * Parses a LigaStore product-detail page.
 */
export function parseLigaStoreItemDetails(html: string): ParsedLigaStoreItemDetails {
  const qualityContent = findDivContentByClasses(html, [
    "table-cards-body-cell",
    "quality",
  ]) || findDivContentByClasses(html, ["quality"]);
  const condition =
    qualityContent.match(/\b(NM|SP|MP|HP|D)\b/i)?.[1]?.toUpperCase() ??
    html.match(
      /<div[^>]*class=(['"])[^"']*\bquality\b[^"']*\1[^>]*>\s*(NM|SP|MP|HP|D)\s*<\/div>/i
    )?.[2]?.toUpperCase() ??
    html.match(/\b(NM|SP|MP|HP|D)\b/i)?.[1]?.toUpperCase() ??
    "NM";

  const languageContent = findDivContentByClasses(html, [
    "table-cards-body-cell",
    "tooltip-item",
    "text-center",
  ]);
  const language =
    languageContent.match(/<img[^>]*\balt=(['"])(.*?)\1/i)?.[2] ??
    html.match(/<img[^>]*\balt=(['"])(Ingl[êe]s|Portugu[êe]s|EN|PT|JP|Japon[êe]s)\1/i)?.[2] ??
    (stripHtml(languageContent) || "EN");

  const stockMatch =
    html.match(
      /<div[^>]*class=(['"])[^"']*\btable-cards-body-cell\b[^"']*\btooltip-item\b[^"']*\1[^>]*>\s*(\d+)\s*unid\./i
    ) ??
    html.match(/\b(\d+)\s*unid\./i) ??
    html.match(/\bmax=["'](\d+)["']/i);

  const stockQuantity = Number(stockMatch?.[2] ?? stockMatch?.[1] ?? 0);

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

    return {
      rawTitle,
      cardName: title.cardName,
      collectorNumber: title.collectorNumber,
      isFoil: /<img\b[^>]*\balt=(['"])FOIL\1/i.test(cardHtml),
      productUrl,
      refId: extractRefId(productUrl),
      imageUrl,
      price,
      priceNumeric: priceToNumeric(price),
      quantity: extractQuantity(cardHtml, spriteClasses),
    };
  });

  return {
    items,
    totalCount: parseLigaStoreTotalCount(html),
  };
}
