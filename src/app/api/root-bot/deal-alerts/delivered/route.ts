import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { upsertDealAlertMessage } from "@/db/repositories/deal-alert-repository";

export async function POST(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const { recipientId, channelId, messageIds, lastListingKeys } = body;

  if (
    typeof recipientId !== "string" ||
    typeof channelId !== "string" ||
    !Array.isArray(messageIds) ||
    !Array.isArray(lastListingKeys)
  ) {
    return NextResponse.json(
      { error: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  await upsertDealAlertMessage({
    destination: `root:${caller.communityId}`,
    recipientId,
    channelId,
    messageId: messageIds
      .filter((id): id is string => typeof id === "string")
      .join(","),
    lastListingKeys: JSON.stringify(
      lastListingKeys.filter((key): key is string => typeof key === "string")
    ),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
