import { NextResponse } from "next/server";
import { issueRootBotToken } from "@/services/root-bot-auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Expected a JSON body" },
      { status: 400 }
    );
  }

  const { appId, communityId } = (body ?? {}) as {
    appId?: unknown;
    communityId?: unknown;
  };

  if (typeof appId !== "string" || typeof communityId !== "string") {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "appId and communityId are required" },
      { status: 400 }
    );
  }

  const issued = await issueRootBotToken(appId, communityId);
  if (!issued) {
    return NextResponse.json(
      {
        error: "INSTALL_REJECTED",
        message: "App id is not allowed for this install",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    token: issued.token,
    communityId: issued.communityId,
  });
}
