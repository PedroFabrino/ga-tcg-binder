import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { markNotificationsDelivered } from "@/db/repositories/notification-delivery-repository";

export async function POST(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const { notificationIds, messageIds } = (body ?? {}) as {
    notificationIds?: unknown;
    messageIds?: unknown;
  };

  if (!Array.isArray(notificationIds) || !Array.isArray(messageIds)) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "notificationIds and messageIds are required" },
      { status: 400 }
    );
  }

  await markNotificationsDelivered(
    notificationIds.filter((id): id is string => typeof id === "string"),
    `root:${caller.communityId}`,
    messageIds.filter((id): id is string => typeof id === "string").join(",")
  );

  return NextResponse.json({ ok: true });
}
