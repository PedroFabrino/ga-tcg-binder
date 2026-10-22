import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { getLinkedIdentities } from "@/services/collector-assistant";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const identities = await getLinkedIdentities(userId);
    return NextResponse.json({ identities });
  } catch (error: unknown) {
    console.error("[api/settings/identities] Failed to fetch identities:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
