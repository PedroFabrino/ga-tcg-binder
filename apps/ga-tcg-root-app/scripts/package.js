#!/usr/bin/env node
/**
 * Cross-platform package script for Root Bot.
 *
 * Prepares a clean staging environment with only production dependencies
 * so the packaged archive is small (~21MB) instead of 300MB+, avoiding
 * the HTTP 413 (Payload Too Large) error from the Root SDK upload endpoint.
 */
const { execSync } = require("child_process");
const { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, rmSync } = require("fs");
const { join } = require("path");

const cwd = join(__dirname, "..");
const stageDir = join(cwd, ".staging-package");
const outputFile = process.env.PACKAGE_FILE ?? "ga-tcg-root-app.zip";

function run(cmd, dir = cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: dir });
}

console.log("\nPreparing production staging package...");
mkdirSync(stageDir, { recursive: true });

// Copy networking files into staging for local file: dependencies
if (existsSync(join(cwd, "networking"))) {
  rmSync(join(stageDir, "networking"), { recursive: true, force: true });
  cpSync(join(cwd, "networking"), join(stageDir, "networking"), { recursive: true });
}

// 1. Prepare stage package.json with ONLY production dependencies
const botPkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
const stagePkg = {
  name: "@ga/root-app-dist",
  version: botPkg.version,
  private: true,
  dependencies: botPkg.dependencies || {}
};

const stagePkgPath = join(stageDir, "package.json");
const prevPkgContent = existsSync(stagePkgPath) ? readFileSync(stagePkgPath, "utf8") : "";
const newPkgContent = JSON.stringify(stagePkg, null, 2);

if (prevPkgContent !== newPkgContent || !existsSync(join(stageDir, "node_modules"))) {
  writeFileSync(stagePkgPath, newPkgContent);
  console.log("Installing production dependencies into staging...");
  run("npm install --omit=dev --no-audit --prefer-offline", stageDir);
}

// 2. Copy root-manifest.json and compiled dist into staging
copyFileSync(join(cwd, "root-manifest.json"), join(stageDir, "root-manifest.json"));
rmSync(join(stageDir, "dist"), { recursive: true, force: true });
cpSync(join(cwd, "dist"), join(stageDir, "dist"), { recursive: true });

// Copy client/dist into staging if present
if (existsSync(join(cwd, "client/dist"))) {
  rmSync(join(stageDir, "client/dist"), { recursive: true, force: true });
  mkdirSync(join(stageDir, "client"), { recursive: true });
  cpSync(join(cwd, "client/dist"), join(stageDir, "client/dist"), { recursive: true });
}

// 3. Build package inside staging directory
console.log(`\nBuilding Root package: ${outputFile}...`);
run(`npx rootsdk build package -p .staging-package -o ${outputFile}`, cwd);

// 4. Move generated package from staging to root if needed
const stagedZip = join(stageDir, outputFile);
const rootZip = join(cwd, outputFile);
if (existsSync(stagedZip)) {
  copyFileSync(stagedZip, rootZip);
  rmSync(stagedZip, { force: true });
}

console.log(`\nPackage created successfully at ${outputFile}`);
