import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { findCollectorByIdentity } from "@/db/repositories/assistant-repository";

export async function GET(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("provider") !== "root") {
    return NextResponse.json({ error: "INVALID_PROVIDER" }, { status: 400 });
  }

  const providerUserId = searchParams.get("providerUserId");
  if (!providerUserId) {
    return NextResponse.json(
      { error: "MISSING_PROVIDER_USER_ID" },
      { status: 400 }
    );
  }

  const resolved = await findCollectorByIdentity("root", providerUserId);
  if (!resolved) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    collectorId: resolved.collector.id,
    collectorName: resolved.collector.name,
  });
}
