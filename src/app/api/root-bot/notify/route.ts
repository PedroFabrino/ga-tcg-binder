import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { findCollectorByIdentity } from "@/db/repositories/assistant-repository";
import { setWantlistNotificationPreference } from "@/db/repositories/personal-wants-repository";

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

  if (typeof body.providerUserId !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const resolved = await findCollectorByIdentity("root", body.providerUserId);
  if (!resolved) {
    return NextResponse.json(
      { error: "IDENTITY_NOT_LINKED" },
      { status: 404 }
    );
  }

  await setWantlistNotificationPreference(
    resolved.collector.id,
    "root",
    body.enabled
  );

  return NextResponse.json({ ok: true });
}
