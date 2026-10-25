import { NextResponse } from "next/server";
import { recordRootBotDiagnostic } from "@/db/repositories/root-bot-diagnostic-repository";

/**
 * Startup/poll diagnostic sink. It deliberately accepts any app id (and records
 * it) because the cloud bot calls it before it has credentials and we need the
 * real reported id when the allowlist is wrong. It only ever inserts an
 * append-only diagnostic row.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    appId?: unknown;
    communityId?: unknown;
    stage?: unknown;
    message?: unknown;
  };

  if (
    typeof body.communityId !== "string" ||
    typeof body.stage !== "string"
  ) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const appId =
    typeof body.appId === "string" && body.appId.length > 0
      ? body.appId
      : "(missing)";
  const detail =
    typeof body.message === "string" ? body.message.slice(0, 2000) : "";

  await recordRootBotDiagnostic({
    communityId: body.communityId,
    stage: body.stage.slice(0, 120),
    message: `${detail} [appId=${appId}]`,
  });

  return NextResponse.json({ ok: true });
}
