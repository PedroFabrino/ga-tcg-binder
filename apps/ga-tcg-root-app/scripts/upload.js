#!/usr/bin/env node
/**
 * Cross-platform upload script — reads ROOT_BOT_AUTH_TOKEN from .env
 * so npm run upload works on both Windows (PowerShell) and Unix shells.
 */
const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

// Load .env from the bot app root
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

const token = process.env.ROOT_BOT_AUTH_TOKEN;
if (!token) {
  console.error(
    "Error: ROOT_BOT_AUTH_TOKEN is not set.\n" +
      "Set it in apps/ga-tcg-root-app/.env or as an environment variable."
  );
  process.exit(1);
}

const packageFile = process.env.PACKAGE_FILE ?? "ga-tcg-root-app.zip";

console.log(`Uploading ${packageFile}...`);
execSync(
  `npx rootsdk upload package -f ${packageFile} --authToken ${token}`,
  { stdio: "inherit", cwd: join(__dirname, "..") }
);
