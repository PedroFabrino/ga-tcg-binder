import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Allowlist = {
  maxLines: string[];
  restrictedImports: string[];
};

const repositoryRoot = process.cwd();
const srcRoot = path.join(repositoryRoot, "src");
const allowlistPath = path.join(repositoryRoot, "config/architecture-allowlist.json");
const MAX_SOURCE_LINES = 400;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/*
 * This is intentionally separate from config/architecture-allowlist.json.
 * The JSON file may only shrink. Adding a newly-approved exception requires
 * changing this reviewed test as well, rather than silently editing config.
 */
const INITIAL_ALLOWLIST: Allowlist = {
  maxLines: [
    "src/services/marketplace.ts",
    "src/app/marketplace/page.tsx",
    "src/components/collection/MypStoreView.tsx",
    "src/services/meta.ts",
    "src/app/scan/dashboard/page.tsx",
    "src/app/meta/page.tsx",
    "src/db/init.ts",
    "src/services/scanner.ts",
    "src/services/ligastore-parser.ts",
  ],
  restrictedImports: [
    "src/app/api/catalog/route.ts",
    "src/app/api/catalog/sync/route.ts",
    "src/app/api/collection/bulk/route.ts",
    "src/app/api/collection/route.ts",
    "src/app/api/decks/route.ts",
    "src/app/api/decks/shortages/route.ts",
    "src/app/api/decks/[id]/route.ts",
    "src/app/api/decks/[id]/shortage/route.ts",
    "src/app/api/friends/route.ts",
    "src/app/api/friends/[friendId]/idle/route.ts",
    "src/app/api/marketplace/enrich-tcg/route.ts",
    "src/app/api/marketplace/market/route.ts",
    "src/app/api/marketplace/market-sync/route.ts",
    "src/app/api/marketplace/route.ts",
    "src/app/api/marketplace/sync/route.ts",
    "src/app/api/meta/compare/route.ts",
    "src/app/api/meta/route.ts",
    "src/app/api/meta/staples/route.ts",
    "src/app/api/scanner/confirm/route.ts",
    "src/app/api/scanner/identify/route.ts",
    "src/app/api/scanner/process-frame/route.ts",
    "src/app/api/scanner/queue/route.ts",
    "src/app/api/scanner/session/route.ts",
    "src/app/api/scanner/session/[token]/route.ts",
    "src/app/api/scanner/submit/route.ts",
    "src/app/api/sync/pipeline/route.ts",
    "src/auth.ts",
    "src/services/catalog-sync.ts",
    "src/services/catalog.ts",
    "src/services/collection.ts",
    "src/services/ligastore-sync.ts",
    "src/services/marketplace.ts",
    "src/services/meta-staples.ts",
    "src/services/meta.ts",
    "src/services/scanner-match.ts",
    "src/services/scanner-queue.ts",
    "src/services/scanner.ts",
    "src/services/seed.ts",
    "src/services/shortage.ts",
    "src/services/watchlist-state.ts",
  ],
};

function toProjectPath(filePath: string): string {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function isTestFile(filePath: string): boolean {
  const normalized = toProjectPath(filePath);
  return (
    normalized.includes("/__tests__/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized) ||
    normalized.endsWith("test-utils.ts")
  );
}

function walk(directory: string): string[] {
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

function isDatabaseInternalFile(filePath: string): boolean {
  return toProjectPath(filePath).startsWith("src/db/");
}

function resolvesIntoDb(filePath: string, specifier: string): boolean {
  if (specifier === "@/db" || specifier === "@/db/index" || specifier === "@/db/schema") return true;
  if (specifier.startsWith("@/db/repositories/")) return false;
  if (specifier.startsWith("@/db/")) return true;

  if (!specifier.startsWith(".")) return false;

  const resolved = path.resolve(path.dirname(filePath), specifier);
  const relativeToSrc = path.relative(srcRoot, resolved).split(path.sep).join("/");
  if (relativeToSrc.startsWith("db/repositories/")) return false;
  return relativeToSrc === "db" || relativeToSrc.startsWith("db/");
}

function isRestrictedSpecifier(filePath: string, specifier: string): boolean {
  return (
    specifier === "drizzle-orm" ||
    specifier.startsWith("drizzle-orm/") ||
    specifier === "@libsql/client" ||
    specifier.startsWith("@libsql/") ||
    resolvesIntoDb(filePath, specifier)
  );
}

function importsRestrictedModule(filePath: string): boolean {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  let violation = false;
  const checkSpecifier = (node: ts.Expression | ts.ModuleName | undefined) => {
    if (node && ts.isStringLiteral(node) && isRestrictedSpecifier(filePath, node.text)) {
      violation = true;
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      checkSpecifier(node.moduleSpecifier);
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      checkSpecifier(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violation;
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function readAllowlist(): Allowlist {
  return JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as Allowlist;
}

function expectSameMembers(rule: string, actual: string[], allowed: string[]) {
  expect(
    sorted(actual),
    `${rule}: these are the current violations. Fix a file and remove its allowlist entry in the same PR; new violations must be fixed rather than allowlisted.`
  ).toEqual(sorted(allowed));
}

function expectShrinkingOnly(rule: string, configured: string[], baseline: string[]) {
  const additions = configured.filter((entry) => !baseline.includes(entry));
  expect(
    additions,
    `${rule}: new allowlist entries are forbidden. Allowlists may only shrink.`
  ).toEqual([]);
}

describe("architecture guardrails", () => {
  const allowlist = readAllowlist();
  const sourceFiles = walk(srcRoot);

  it("does not permit additions to the reviewed allowlist baseline", () => {
    expectShrinkingOnly("maxLines", allowlist.maxLines, INITIAL_ALLOWLIST.maxLines);
    expectShrinkingOnly(
      "restrictedImports",
      allowlist.restrictedImports,
      INITIAL_ALLOWLIST.restrictedImports
    );

    // This makes the intended review invariant explicit: appending an entry fails.
    expect(() =>
      expectShrinkingOnly(
        "maxLines",
        [...allowlist.maxLines, "src/new-unapproved-offender.ts"],
        INITIAL_ALLOWLIST.maxLines
      )
    ).toThrow();
  });

  it("has an exact, non-stale allowlist for files over 400 lines", () => {
    const offenders = sourceFiles
      .filter((filePath) => !isTestFile(filePath))
      .filter((filePath) => lineCount(filePath) > MAX_SOURCE_LINES)
      .map(toProjectPath);

    expectSameMembers("maxLines", offenders, allowlist.maxLines);
  });

  it("has an exact, non-stale allowlist for direct database imports", () => {
    const offenders = sourceFiles
      .filter((filePath) => !isDatabaseInternalFile(filePath))
      .filter((filePath) => !isTestFile(filePath))
      .filter(importsRestrictedModule)
      .map(toProjectPath);

    expectSameMembers("restrictedImports", offenders, allowlist.restrictedImports);
  });
});
