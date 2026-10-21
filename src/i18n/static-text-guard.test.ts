import { describe, it, expect } from "vitest";
import { enCatalog, ptBRCatalog } from "@ga/contracts";
import * as fs from "fs";
import * as path from "path";

function getAllKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getPlaceholders(str: string): string[] {
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1)))).sort();
}

function getValueByKey(obj: Record<string, any>, keyPath: string): any {
  const parts = keyPath.split(".");
  let curr = obj;
  for (const p of parts) {
    if (!curr || typeof curr !== "object") return undefined;
    curr = curr[p];
  }
  return curr;
}

function findSourceFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "__tests__") {
        findSourceFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Static Text Policy & i18n Guardrails", () => {
  it("enforces 100% key parity between English and Portuguese catalogs", () => {
    const enKeys = getAllKeys(enCatalog).sort();
    const ptKeys = getAllKeys(ptBRCatalog).sort();

    expect(enKeys).toEqual(ptKeys);
    expect(enKeys.length).toBeGreaterThan(50);
  });

  it("ensures all dictionary values are non-empty strings with matching placeholders", () => {
    const enKeys = getAllKeys(enCatalog);

    for (const key of enKeys) {
      const enVal = getValueByKey(enCatalog, key);
      const ptVal = getValueByKey(ptBRCatalog, key);

      expect(typeof enVal, `Key ${key} in enCatalog should be string`).toBe("string");
      expect(typeof ptVal, `Key ${key} in ptBRCatalog should be string`).toBe("string");
      expect(enVal.trim().length, `Key ${key} in enCatalog must not be empty`).toBeGreaterThan(0);
      expect(ptVal.trim().length, `Key ${key} in ptBRCatalog must not be empty`).toBeGreaterThan(0);

      const enPlaceholders = getPlaceholders(enVal);
      const ptPlaceholders = getPlaceholders(ptVal);
      expect(ptPlaceholders, `Placeholders for key ${key} must match between catalogs`).toEqual(enPlaceholders);
    }
  });

  it("ensures every t('...') key referenced in src/app and src/components exists in catalog", () => {
    const validKeys = new Set(getAllKeys(enCatalog));

    const sourceFiles = [
      ...findSourceFiles(path.resolve(process.cwd(), "src/app")),
      ...findSourceFiles(path.resolve(process.cwd(), "src/components")),
    ];

    expect(sourceFiles.length).toBeGreaterThan(10);

    const tCallRegex = /\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g;
    const missingKeys: { file: string; key: string }[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      let match: RegExpExecArray | null;
      while ((match = tCallRegex.exec(content)) !== null) {
        const key = match[1];
        if (!validKeys.has(key)) {
          missingKeys.push({
            file: path.relative(process.cwd(), file),
            key,
          });
        }
      }
    }

    expect(missingKeys, `Found translation keys missing in @ga/contracts: ${JSON.stringify(missingKeys, null, 2)}`).toHaveLength(0);
  });

  it("verifies that core user-facing web pages wire into the translation system", () => {
    const corePages = [
      "src/app/page.tsx",
      "src/app/collection/page.tsx",
      "src/app/decks/page.tsx",
      "src/app/decks/[id]/page.tsx",
      "src/app/marketplace/page.tsx",
      "src/app/meta/page.tsx",
      "src/app/friends/page.tsx",
      "src/app/catalog/page.tsx",
      "src/app/settings/page.tsx",
      "src/app/login/page.tsx",
    ];

    for (const pageRelPath of corePages) {
      const fullPath = path.resolve(process.cwd(), pageRelPath);
      expect(fs.existsSync(fullPath), `Page ${pageRelPath} should exist`).toBe(true);

      const content = fs.readFileSync(fullPath, "utf-8");
      const hasTranslationHook = content.includes("useTranslation") || content.includes("@ga/contracts");
      expect(hasTranslationHook, `Page ${pageRelPath} must use translation hook or @ga/contracts`).toBe(true);
    }
  });

  it("preserves canonical English Grand Archive game nomenclature across Portuguese translations", () => {
    // Official deck zones per CONTEXT.md and ADR 0011 must remain canonical
    expect(enCatalog.decks.materialDeck).toBe("Material Deck");
    expect(ptBRCatalog.decks.materialDeck).toBe("Material Deck");
    expect(enCatalog.decks.mainDeck).toBe("Main Deck");
    expect(ptBRCatalog.decks.mainDeck).toBe("Main Deck");
    expect(enCatalog.decks.sideboard).toBe("Sideboard");
    expect(ptBRCatalog.decks.sideboard).toBe("Sideboard");

    // Competitive terms mapping check
    expect(ptBRCatalog.shortages.title).toContain("Cartas Necessárias");
    expect(ptBRCatalog.shortages.hardShortageTab).toContain("Compra Necessária");
    expect(ptBRCatalog.shortages.sharedShortageTab).toContain("Revezamento entre Decks");
  });
});
