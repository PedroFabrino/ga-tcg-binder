"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_BOT_API_BASE_URL = void 0;
/**
 * Public base URL of the GA Binder web app (the Root bot API host).
 *
 * Root's cloud does not inject `.env`, so this must be compiled into the bot.
 * Set it to your deployed domain before `npm run deploy`. The env override is
 * only for local development/testing.
 */
exports.ROOT_BOT_API_BASE_URL = process.env.ROOT_BOT_API_BASE_URL ?? "https://ga-tcg-binder.vercel.app";
