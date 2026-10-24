import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { getCommunityDealAlertChannel } from "@/services/root-bot-service";

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

  return NextResponse.json(
    await getCommunityDealAlertChannel(caller.communityId, recipientId)
  );
}
