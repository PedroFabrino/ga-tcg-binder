import { DISCORD_MESSAGE_MAX_LENGTH } from "./discord-market-notification-formatter";

const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;

export interface DiscordWebhookSendOptions {
 fetchImpl?: typeof fetch;
 sleep?: (ms: number) => Promise<void>;
 maxRetries?: number;
 maxRetryDelayMs?: number;
}

/**
 * Validates the Discord webhook URL. Returns the normalized URL when it is
 * an https URL on discord.com / discordapp.com with an /api/webhooks/ path,
 * otherwise null. The URL embeds a secret token and must never be logged.
 */
export function validateDiscordWebhookUrl(
 raw: string | null | undefined
): string | null {
 if (!raw) {
  return null;
 }

 let url: URL;
 try {
  url = new URL(raw);
 } catch {
  return null;
 }

 if (url.protocol !== "https:") {
  return null;
 }

 const hostname = url.hostname.toLowerCase();
 if (hostname !== "discord.com" && hostname !== "discordapp.com") {
  return null;
 }

 if (!url.pathname.startsWith("/api/webhooks/")) {
  return null;
 }

 return url.toString();
}

/**
 * Removes the webhook URL and its embedded secret token from a message so
 * error output never leaks credentials.
 */
export function redactWebhookSecret(text: string, webhookUrl: string): string {
 let redacted = text;

 try {
  const url = new URL(webhookUrl);
  redacted = redacted.split(url.toString()).join("[REDACTED_WEBHOOK]");

  const token = url.pathname.split("/").filter(Boolean).pop();
  if (token) {
   redacted = redacted.split(token).join("[REDACTED]");
  }
 } catch {
  // Fall through to the generic pattern below.
 }

 return redacted.replace(
  /https?:\/\/discord(?:app)?\.com\/api\/webhooks\/[^\s"'<>]+/gi,
  "[REDACTED_WEBHOOK]"
 );
}

function describeError(error: unknown): string {
 if (error instanceof Error) {
  return error.message;
 }
 return String(error);
}

function readRetryAfterMs(response: Response): number {
 const header =
  response.headers.get("retry-after") ??
  response.headers.get("x-ratelimit-reset-after");
 if (header) {
  const seconds = Number.parseFloat(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
   return Math.round(seconds * 1000);
  }
 }
 return DEFAULT_RETRY_DELAY_MS;
}

function buildWaitUrl(webhookUrl: string): string {
 const url = new URL(webhookUrl);
 url.searchParams.set("wait", "true");
 return url.toString();
}

/**
 * Posts `content` to a Discord webhook and returns the created message id,
 * or null when delivery failed (non-2xx after retries, or network error).
 * Failures are logged with the webhook secret redacted. `?wait=true` is
 * used so the message id can be persisted.
 */
export async function sendDiscordWebhookMessage(
 webhookUrl: string,
 content: string,
 options: DiscordWebhookSendOptions = {}
): Promise<string | null> {
 if (content.length > DISCORD_MESSAGE_MAX_LENGTH) {
  console.warn(
   `[discord-webhook] Refusing to send ${content.length}-character message (limit ${DISCORD_MESSAGE_MAX_LENGTH})`
  );
  return null;
 }

 const fetchImpl = options.fetchImpl ?? fetch;
 const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
 const maxRetries = options.maxRetries ?? MAX_RETRIES;
 const maxRetryDelayMs = options.maxRetryDelayMs ?? MAX_RETRY_DELAY_MS;
 const url = buildWaitUrl(webhookUrl);

 let attempt = 0;

 while (true) {
  attempt += 1;

  let response: Response;
  try {
   response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     content,
     allowed_mentions: { parse: [] },
    }),
   });
  } catch (error) {
   const message = redactWebhookSecret(
    `Discord webhook request failed: ${describeError(error)}`,
    webhookUrl
   );
   console.warn(`[discord-webhook] ${message}`);
   return null;
  }

  if (response.ok) {
   try {
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === "string" ? body.id : null;
   } catch {
    return null;
   }
  }

  if (response.status === 429 && attempt <= maxRetries) {
   const delay = Math.min(readRetryAfterMs(response), maxRetryDelayMs);
   console.warn(
    `[discord-webhook] Rate limited (429); retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`
   );
   await sleep(delay);
   continue;
  }

  console.warn(
   `[discord-webhook] ${redactWebhookSecret(
    `Discord webhook returned HTTP ${response.status}`,
    webhookUrl
   )}`
  );
  return null;
 }
}
