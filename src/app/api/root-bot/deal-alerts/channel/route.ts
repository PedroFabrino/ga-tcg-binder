import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { getDealAlertMessage } from "@/db/repositories/deal-alert-repository";
import { parseMessageIds } from "@/services/discord-dm-client";

export async function GET(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const recipientId = new URL(request.url).searchParams.get("recipientId");
  if (!recipientId) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const row = await getDealAlertMessage(
    `root:${caller.communityId}`,
    recipientId
  );

  if (!row) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    channelId: row.channelId,
    messageIds: parseMessageIds(row.messageId),
  });
}
