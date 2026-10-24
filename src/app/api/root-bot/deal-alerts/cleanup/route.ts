import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { clearCommunityDealAlert } from "@/services/root-bot-service";

export async function POST(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    recipientId?: unknown;
  };
  if (typeof body.recipientId !== "string") {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  await clearCommunityDealAlert(caller.communityId, body.recipientId);

  return NextResponse.json({ ok: true });
}
