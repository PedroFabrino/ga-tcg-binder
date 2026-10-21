import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID } from "@/services/seed";
import { getLinkedIdentities } from "@/services/collector-assistant";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const identities = await getLinkedIdentities(userId);
    return NextResponse.json({ identities });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
