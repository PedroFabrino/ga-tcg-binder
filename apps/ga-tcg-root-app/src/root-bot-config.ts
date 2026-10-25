/**
 * Public base URL of the GA Binder web app (the Root bot API host).
 *
 * Root's cloud does not inject `.env`, so this must be compiled into the bot.
 * Set it to your deployed domain before `npm run deploy`. The env override is
 * only for local development/testing.
 */
export const ROOT_BOT_API_BASE_URL =
  process.env.ROOT_BOT_API_BASE_URL ?? "https://ga-tcg-binder.vercel.app";

/**
 * The app's internal GUID. `rootServer.appId` returns the short manifest id
 * (`ADH-…`), but channel access rules need the app GUID. It is public and
 * stable; an env override is allowed for unusual setups.
 */
export const ROOT_BOT_APP_GUID =
  process.env.APP_GUID ?? "0031fee9-f6ef-8a09-a9a6-3d7faa06529b";
