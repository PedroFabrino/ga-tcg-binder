import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enCatalog } from "@ga/contracts";

const repositoryRoot = process.cwd();
const tableRoot = path.join(repositoryRoot, "apps", "table");
const tableSrc = path.join(tableRoot, "src");
const MAX_SOURCE_LINES = 400;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function toProjectPath(filePath: string): string {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function isTestFile(filePath: string): boolean {
  const normalized = toProjectPath(filePath);
  return normalized.includes("/__tests__/") || /\.(test|spec)\.[jt]sx?$/.test(normalized);
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function lineCount(filePath: string): number {
  const text = fs.readFileSync(filePath, "utf8");
  if (text.length === 0) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

describe("apps/table architecture guardrails", () => {
  const sourceFiles = walk(tableSrc);
  const validKeys = new Set(getAllKeys(enCatalog as unknown as Record<string, unknown>));

  it("keeps every source file at or under 400 lines", () => {
    const offenders = sourceFiles
      .filter((filePath) => !isTestFile(filePath))
      .filter((filePath) => lineCount(filePath) > MAX_SOURCE_LINES)
      .map(toProjectPath);
    expect(offenders).toEqual([]);
  });

  it("references only translation keys that exist in the catalog", () => {
    const appFiles = walk(path.join(tableSrc, "app"));
    const tCallRegex = /\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g;
    const missingKeys: { file: string; key: string }[] = [];

    for (const file of appFiles) {
      const content = fs.readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = tCallRegex.exec(content)) !== null) {
        if (!validKeys.has(match[1])) {
          missingKeys.push({ file: toProjectPath(file), key: match[1] });
        }
      }
    }

    expect(missingKeys).toEqual([]);
  });

  it("wires every page and layout into the translation system", () => {
    const pages = [
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/app/t/[code]/page.tsx",
      "src/app/t/[code]/stage/page.tsx",
      "src/app/t/[code]/overlay/page.tsx",
    ];

    for (const rel of pages) {
      const fullPath = path.join(tableRoot, rel);
      expect(fs.existsSync(fullPath), `Page ${rel} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf8");
      // A thin route may delegate its strings to the shared translated surface.
      const wired =
        content.includes("useTranslation") ||
        content.includes("@ga/contracts") ||
        content.includes("TablePageContent");
      expect(wired, `Page ${rel} must use the translation hook or @ga/contracts`).toBe(true);
    }
  });
});
