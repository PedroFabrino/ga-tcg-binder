import {
  getShippingTickets,
  updateShippingTicket,
  getShippingTicketsWithOrders,
  type ShippingTicketWithOrders,
} from "@/db/repositories/fulfillment-repository";
import { getUserById } from "@/db/repositories/settings-repository";
import { decryptSecret } from "@/lib/crypto";
import { fetchSuperfreteOrderInfo } from "./superfrete-client";

export function normalizeSuperfreteStatus(
  rawStatus?: string | null
): "pending" | "released" | "posted" | "unknown" {
  if (!rawStatus) return "unknown";
  const s = rawStatus.toLowerCase();
  if (s.includes("pending") || s.includes("pendente") || s.includes("aguardando")) {
    return "pending";
  }
  if (s.includes("release") || s.includes("liberad") || s.includes("paga")) {
    return "released";
  }
  if (s.includes("post") || s.includes("enviad") || s.includes("transito")) {
    return "posted";
  }
  return "unknown";
}

export async function getShippingTicketsWithOrdersService(
  userId: string,
  database?: unknown
): Promise<ShippingTicketWithOrders[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository parameter
  const dbParam = database as any;
  return getShippingTicketsWithOrders(userId, dbParam);
}

export async function syncShippingTicketsService(
  userId: string,
  database?: unknown,
  customFetch: typeof fetch = fetch
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository parameter
  const dbParam = database as any;
  const user = await getUserById(userId, dbParam);
  if (!user?.superfreteApiKeyEncrypted) {
    throw new Error("SUPERFRETE_API_KEY_NOT_CONFIGURED");
  }

  const apiToken = decryptSecret(user.superfreteApiKeyEncrypted);
  const tickets = await getShippingTickets(userId, undefined, dbParam);
  if (tickets.length === 0) return [];

  const updatedTickets = [];

  for (const ticket of tickets) {
    try {
      const info = await fetchSuperfreteOrderInfo(apiToken, ticket.superfreteOrderId, customFetch);
      const normalizedStatus = normalizeSuperfreteStatus(info.status);

      // Preserve existing tracking or printUrl if provider payload omits them
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payload variations
      const rawInfo = info as any;
      const trackingCode = info.tracking || rawInfo.tracking_code || ticket.trackingCode;
      const printUrl = info.print?.url || rawInfo.print_url || ticket.printUrl;

      const updated = await updateShippingTicket(
        userId,
        ticket.id,
        {
          status: normalizedStatus !== "unknown" ? normalizedStatus : (ticket.status as "pending" | "released" | "posted" | "unknown"),
          trackingCode: trackingCode || null,
          printUrl: printUrl || null,
          providerPayloadJson: JSON.stringify(info),
          synchronizedAt: new Date().toISOString(),
        },
        dbParam
      );

      if (updated) {
        updatedTickets.push(updated);
      }
    } catch (err: unknown) {
      // Individual ticket sync failure should not fail whole sync operation
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[Superfrete Sync] Failed for ticket ${ticket.superfreteOrderId}:`, err);
      }
    }
  }

  return updatedTickets;
}
