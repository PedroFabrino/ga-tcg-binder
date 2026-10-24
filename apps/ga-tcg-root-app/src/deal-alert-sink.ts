/**
 * Root-side copies of the delivery seam types. The cloud bot must not import
 * from the web app (`src/`), so the shapes it needs live here.
 */

/** A single delivered direct message, referenced for rolling replacement. */
export interface DirectMessageRef {
  channelId: string;
  messageId: string;
}

export interface DealAlertNotificationSummary {
  title: string;
  description: string;
}

/**
 * A delivery seam for per-recipient rolling messages (Deal Alerts). Root
 * satisfies this with a private per-user channel; `notify` is an optional
 * in-app notification ping.
 */
export interface DirectMessageSink {
  send(
    recipient: string,
    content: string,
    previousChannelId?: string
  ): Promise<DirectMessageRef | null>;
  delete(ref: DirectMessageRef): Promise<void>;
  notify?(
    recipient: string,
    summary: DealAlertNotificationSummary
  ): Promise<void>;
}

/** Parses a stored comma-separated (or legacy JSON) message-id list. */
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
      console.warn(
        "[deal-alert-sink] Could not parse message ids as JSON; falling back to comma separation."
      );
    }
  }

  return trimmed
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
