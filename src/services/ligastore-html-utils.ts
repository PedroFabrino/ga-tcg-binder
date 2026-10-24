/**
 * HTML and sprite parsing utilities for LigaStore markup.
 */

import { decodeHtml } from "./market-crawl";

export { decodeHtml };

export const DEFAULT_PRICE = "R$ 0,00";

export function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

export function getAttribute(tag: string, attribute: string): string {
  const expression = new RegExp(
    `\\b${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "i"
  );
  return decodeHtml(tag.match(expression)?.[2] ?? "");
}

export function hasClass(tag: string, className: string): boolean {
  const classes = getAttribute(tag, "class").split(/\s+/);
  return classes.includes(className);
}

export function findDivContentByClasses(html: string, requiredClasses: string[]): string {
  const divStart = /<div\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = divStart.exec(html))) {
    const openingTag = match[0];
    if (!requiredClasses.every((className) => hasClass(openingTag, className))) {
      continue;
    }

    // Track nesting depth to find the matching closing </div>
    let depth = 1;
    let pos = match.index + openingTag.length;
    const tagPattern = /<\/div>|<div\b[^>]*>/gi;
    tagPattern.lastIndex = pos;

    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagPattern.exec(html))) {
      if (tagMatch[0].startsWith("</div")) {
        depth--;
      } else {
        depth++;
      }
      if (depth === 0) {
        return html.substring(pos, tagMatch.index);
      }
    }

    // No matching closing tag found — return empty
    return "";
  }

  return "";
}

export function normalizePrice(value: string): string {
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

export function priceToNumeric(price: string): number {
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

export function parseClassList(tag: string): string[] {
  return getAttribute(tag, "class").split(/\s+/).filter(Boolean);
}

export function getSpriteText(html: string, spriteClasses: Map<string, string>): string {
  return html.replace(/<[^>]+>/g, (tag) => {
    const classes = parseClassList(tag);
    const digit = classes.map((className) => spriteClasses.get(className) ?? "").join("");
    return digit || " ";
  });
}

export function extractRefId(url: string): string {
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

interface SpriteRule {
  className: string;
  x: number;
  y: number;
  index: number;
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
