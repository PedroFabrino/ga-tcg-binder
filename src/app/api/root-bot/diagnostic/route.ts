import { NextResponse } from "next/server";
import { DEFAULT_ROOT_BOT_APP_ID } from "@/services/root-bot-auth";
import { recordRootBotDiagnostic } from "@/db/repositories/root-bot-diagnostic-repository";

/**
 * Unauthenticated-but-app-id-allowlisted startup/poll diagnostic sink. The bot
 * calls this before it has an install token, so Root's broken pod log shipper
 * is not the only way to see what happened.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    appId?: unknown;
    communityId?: unknown;
    stage?: unknown;
    message?: unknown;
  };

  const allowedAppId = process.env.ROOT_BOT_APP_ID || DEFAULT_ROOT_BOT_APP_ID;
  if (
    body.appId !== allowedAppId ||
    typeof body.communityId !== "string" ||
    typeof body.stage !== "string"
  ) {
    return NextResponse.json({ error: "REJECTED" }, { status: 403 });
  }

  await recordRootBotDiagnostic({
    communityId: body.communityId,
    stage: body.stage.slice(0, 120),
    message:
      typeof body.message === "string" ? body.message.slice(0, 2000) : null,
  });

  return NextResponse.json({ ok: true });
}
