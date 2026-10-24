import { NextResponse } from "next/server";
import { isAssistantAuthorized } from "@/services/assistant-auth";
import { revokeCommunityInstall } from "@/services/root-bot-service";

/**
 * Operator-only revocation. Requires the existing shared assistant secret (not
 * the install token itself, which a compromised bot may hold).
 */
export async function POST(request: Request) {
  if (!(await isAssistantAuthorized(request))) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Missing operator credentials" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    appId?: unknown;
    communityId?: unknown;
  };

  if (typeof body.appId !== "string" || typeof body.communityId !== "string") {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  await revokeCommunityInstall(body.appId, body.communityId);

  return NextResponse.json({ ok: true });
}
