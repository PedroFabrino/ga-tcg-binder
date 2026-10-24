import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { setCommunityNotifyPreference } from "@/services/root-bot-service";

export async function POST(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    providerUserId?: unknown;
    enabled?: unknown;
  };

  if (
    typeof body.providerUserId !== "string" ||
    typeof body.enabled !== "boolean"
  ) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const updated = await setCommunityNotifyPreference(
    caller.communityId,
    body.providerUserId,
    body.enabled
  );
  if (!updated) {
    return NextResponse.json(
      { error: "IDENTITY_NOT_LINKED" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
