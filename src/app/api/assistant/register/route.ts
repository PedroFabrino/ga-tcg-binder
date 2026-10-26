import { NextRequest, NextResponse } from "next/server";
import { isAssistantAuthorized } from "@/services/assistant-auth";
import { registerAssistantUser } from "@/services/assistant-wants-service";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { noteRootCommunityMember } from "@/services/root-bot-service";
import type { AssistantProvider } from "@ga/contracts";

export async function POST(req: NextRequest) {
  if (!(await isAssistantAuthorized(req))) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid assistant authentication token" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider : null;
  const providerUserId = typeof body.providerUserId === "string" ? body.providerUserId : null;
  const providerUsername = typeof body.providerUsername === "string" ? body.providerUsername : null;

  if (provider !== "discord" && provider !== "root") {
    return NextResponse.json({ error: "INVALID_PROVIDER", message: "Provider must be discord or root" }, { status: 400 });
  }

  if (!providerUserId || !providerUserId.trim()) {
    return NextResponse.json({ error: "MISSING_PROVIDER_USER_ID", message: "providerUserId is required" }, { status: 400 });
  }

  if (provider === "root") {
    const caller = await authenticateRootBot(req);
    if (caller) {
      await noteRootCommunityMember(caller.communityId, providerUserId);
    }
  }

  try {
    const result = await registerAssistantUser({
      provider: provider as AssistantProvider,
      providerUserId: providerUserId.trim(),
      providerUsername,
    });

    return NextResponse.json({
      success: true,
      collector: result.collector,
      created: result.created,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to register collector";
    return NextResponse.json({ error: "REGISTRATION_FAILED", message }, { status: 400 });
  }
}
