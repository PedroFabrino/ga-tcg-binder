import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { findIdentitiesWithNotificationsEnabled } from "@/db/repositories/assistant-repository";
import { planDealAlerts } from "@/services/discord-deal-notifier";

export async function GET(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const identities = await findIdentitiesWithNotificationsEnabled("root");
  const keepRecipients = new Set(
    identities.map((identity) => identity.providerUserId)
  );

  const result = await planDealAlerts(undefined, {
    destination: `root:${caller.communityId}`,
    keepRecipients,
  });

  return NextResponse.json(result);
}
