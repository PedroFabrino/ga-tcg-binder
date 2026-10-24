import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { recordCommunityDealAlertDelivery } from "@/services/root-bot-service";

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
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  await recordCommunityDealAlertDelivery(caller.communityId, {
    recipientId,
    channelId,
    messageIds: messageIds.filter(
      (id): id is string => typeof id === "string"
    ),
    lastListingKeys: lastListingKeys.filter(
      (key): key is string => typeof key === "string"
    ),
  });

  return NextResponse.json({ ok: true });
}
