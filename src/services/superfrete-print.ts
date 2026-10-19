import {
  getShippingTickets,
  updateShippingTicket,
  type ShippingTicketRow,
} from "@/db/repositories/fulfillment-repository";
import { getUserById } from "@/db/repositories/settings-repository";
import { decryptSecret } from "@/lib/crypto";
import { fetchSuperfretePrintUrl } from "./superfrete-client";

export interface PrintableTicketsResult {
  url: string;
  ticketCount: number;
  tickets: ShippingTicketRow[];
}

export async function getPrintableShippingTicketsService(
  userId: string,
  ticketIds?: string[],
  database?: unknown,
  customFetch: typeof fetch = fetch,
  layout: "A4" | "A5" | "A6" = "A5"
): Promise<PrintableTicketsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository parameter
  const dbParam = database as any;
  const user = await getUserById(userId, dbParam);
  if (!user?.superfreteApiKeyEncrypted) {
    throw new Error("SUPERFRETE_API_KEY_NOT_CONFIGURED");
  }

  const apiToken = decryptSecret(user.superfreteApiKeyEncrypted);
  const allTickets = await getShippingTickets(userId, undefined, dbParam);

  let targetTickets = allTickets.filter((t) => Boolean(t.superfreteOrderId));

  if (ticketIds && ticketIds.length > 0) {
    const idSet = new Set(ticketIds);
    targetTickets = targetTickets.filter((t) => idSet.has(t.id));
  } else {
    // For bulk printing:
    // Prefer released and posted tickets.
    const releasedOrPosted = targetTickets.filter(
      (t) => t.status === "released" || t.status === "posted"
    );
    if (releasedOrPosted.length > 0) {
      targetTickets = releasedOrPosted;
    } else {
      // If none are explicitly marked released yet (e.g. user paid in Superfrete without syncing),
      // include pending tickets so Superfrete print API can be attempted.
      targetTickets = targetTickets.filter((t) => t.status !== "unknown");
    }
  }

  if (targetTickets.length === 0) {
    throw new Error("NO_PRINTABLE_TICKETS_FOUND");
  }

  const superfreteOrderIds = Array.from(
    new Set(targetTickets.map((t) => t.superfreteOrderId))
  );

  const url = await fetchSuperfretePrintUrl(apiToken, superfreteOrderIds, customFetch, layout);

  // Update tickets with printUrl and mark status as released if they were pending
  const updatedTickets: ShippingTicketRow[] = [];
  for (const t of targetTickets) {
    const newStatus = t.status === "pending" ? "released" : t.status;
    const updated = await updateShippingTicket(
      userId,
      t.id,
      {
        printUrl: url,
        status: newStatus as "pending" | "released" | "posted" | "unknown",
      },
      dbParam
    );
    if (updated) {
      updatedTickets.push(updated);
    }
  }

  return {
    url,
    ticketCount: targetTickets.length,
    tickets: updatedTickets.length > 0 ? updatedTickets : targetTickets,
  };
}

export async function downloadSuperfretePdfBuffer(
  url: string,
  customFetch: typeof fetch = fetch
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const response = await customFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to download PDF from Superfrete (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "application/pdf";
  const buffer = await response.arrayBuffer();

  return { buffer, contentType };
}
