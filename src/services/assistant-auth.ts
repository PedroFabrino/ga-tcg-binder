import { findCollectorByIdentity } from "../db/repositories/assistant-repository";
import { authenticateRootBot } from "./root-bot-auth";
import type { AssistantProvider } from "@ga/contracts";

export interface AssistantCallerContext {
  collectorId: string;
  collectorName: string | null;
  provider: AssistantProvider;
  providerUserId: string;
}

/**
 * Validates the internal shared assistant token header, or a per-install Root
 * bot bearer token (so the cloud bot can call the same assistant routes without
 * holding the shared secret).
 */
export async function isAssistantAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.ASSISTANT_API_SECRET || process.env.ASSISTANT_TOKEN;
  if (!secret) return true; // Permitted in local development / test without explicit token

  const token = req.headers.get("x-assistant-token");
  if (token === secret) return true;

  if (req.headers.get("authorization")) {
    return (await authenticateRootBot(req)) !== null;
  }

  return false;
}

/**
 * Resolves the authenticated Collector identity for an assistant request.
 */
export async function resolveAssistantCaller(
  providerParam: string | null,
  providerUserIdParam: string | null,
  database?: unknown
): Promise<{ error?: { status: number; code: string; message: string }; context?: AssistantCallerContext }> {
  if (!providerParam || (providerParam !== "discord" && providerParam !== "root")) {
    return {
      error: {
        status: 400,
        code: "INVALID_PROVIDER",
        message: "Query parameter 'provider' must be 'discord' or 'root'",
      },
    };
  }

  if (!providerUserIdParam || providerUserIdParam.trim().length === 0) {
    return {
      error: {
        status: 400,
        code: "MISSING_PROVIDER_USER_ID",
        message: "Query parameter 'providerUserId' is required",
      },
    };
  }

  const resolved = await findCollectorByIdentity(
    providerParam as AssistantProvider,
    providerUserIdParam.trim(),
    database as any
  );

  if (!resolved) {
    return {
      error: {
        status: 404,
        code: "IDENTITY_NOT_LINKED",
        message:
          "No Grand Archive Binder account is linked to this chat account. Use /link <code> to pair your account.",
      },
    };
  }

  return {
    context: {
      collectorId: resolved.collector.id,
      collectorName: resolved.collector.name,
      provider: providerParam as AssistantProvider,
      providerUserId: providerUserIdParam.trim(),
    },
  };
}
