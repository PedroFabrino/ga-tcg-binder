import { MESSAGE_MAX_LENGTH } from "../lib/market-vocabulary";
import { splitMessageContent } from "./market-notification-message";
import type { DiscordEmbed } from "./discord-interactions/types";

export interface DealAlertMessageRef {
  channelId: string;
  messageId: string;
}

/**
 * Normalizes message ID strings stored in the database. Supports single IDs,
 * comma-separated ID lists, and JSON-serialized string arrays.
 */
export function parseMessageIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        );
      }
    } catch {
      // fallback to comma separation below
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Posts a message payload (content and/or embeds) directly to a Discord user's DM channel.
 * Opens the DM channel first if needed.
 */
export async function postDiscordDirectMessage(
  discordUserId: string,
  payload: { content?: string; embeds?: DiscordEmbed[] },
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<DealAlertMessageRef | null> {
  if (!botToken) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    // 1. Open DM channel with recipient
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
      signal: controller.signal,
    });

    if (!dmRes.ok) {
      clearTimeout(timer);
      const errText = await dmRes.text().catch(() => "");
      console.error(`[discord-dm] Failed to open DM channel (${dmRes.status}):`, errText);
      return null;
    }
    const dmData = await dmRes.json();
    const channelId = dmData.id;

    // 2. Post message (embed or plain text) to the DM channel
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => "");
      console.error(`[discord-dm] Failed to post DM message (${msgRes.status}):`, errText);
      return null;
    }

    const msgData = await msgRes.json();
    if (!msgData?.id) {
      return null;
    }
    return { channelId, messageId: msgData.id };
  } catch (err) {
    clearTimeout(timer);
    console.error("[discord-dm] Error sending DM:", err);
    return null;
  }
}

/**
 * Dispatches a private bot DM carrying a Discord embed (e.g. the /wantlist
 * notify confirmation).
 */
export async function sendDiscordDirectMessage(
  discordUserId: string,
  embed: DiscordEmbed,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<boolean> {
  const ref = await postDiscordDirectMessage(
    discordUserId,
    { embeds: [embed] },
    botToken
  );
  return ref !== null;
}

/**
 * Dispatches a private bot DM carrying plain-text content (e.g. deal alerts)
 * and returns the created message reference for later edit/delete. If content
 * exceeds Discord's length boundary, it is split into chunks and sent sequentially.
 */
export async function sendDiscordDirectContent(
  discordUserId: string,
  content: string,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<DealAlertMessageRef | null> {
  const chunks = splitMessageContent(content, MESSAGE_MAX_LENGTH);
  if (chunks.length === 0) {
    return null;
  }

  const sentRefs: DealAlertMessageRef[] = [];
  for (const chunk of chunks) {
    const ref = await postDiscordDirectMessage(discordUserId, { content: chunk }, botToken);
    if (!ref) {
      for (const partial of sentRefs) {
        await deleteDiscordDirectMessage(partial.channelId, partial.messageId, botToken);
      }
      return null;
    }
    sentRefs.push(ref);
  }

  return {
    channelId: sentRefs[0].channelId,
    messageId: sentRefs.map((r) => r.messageId).join(","),
  };
}

/**
 * Deletes a previously sent DM message (or comma-separated list of message IDs).
 * Best-effort: missing messages and network failures are logged and ignored
 * so a stale alert never blocks a new one from being delivered.
 */
export async function deleteDiscordDirectMessage(
  channelId: string,
  messageId: string,
  botToken = process.env.DISCORD_BOT_TOKEN
): Promise<void> {
  if (!botToken) {
    return;
  }

  const messageIds = parseMessageIds(messageId);
  for (const id of messageIds) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bot ${botToken}` },
        }
      );

      if (!res.ok && res.status !== 404) {
        const errText = await res.text().catch(() => "");
        console.error(`[discord-dm] Failed to delete DM message (${res.status}):`, errText);
      }
    } catch (err) {
      console.error("[discord-dm] Error deleting DM message:", err);
    }
  }
}
