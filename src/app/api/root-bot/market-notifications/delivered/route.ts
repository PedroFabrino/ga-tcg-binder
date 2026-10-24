import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { markMarketChunksDelivered } from "@/services/root-bot-service";

export async function POST(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    notificationIds?: unknown;
    messageIds?: unknown;
  };

  if (!Array.isArray(body.notificationIds) || !Array.isArray(body.messageIds)) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "notificationIds and messageIds are required" },
      { status: 400 }
    );
  }

  await markMarketChunksDelivered(
    caller.communityId,
    body.notificationIds.filter((id): id is string => typeof id === "string"),
    body.messageIds.filter((id): id is string => typeof id === "string")
  );

  return NextResponse.json({ ok: true });
}
