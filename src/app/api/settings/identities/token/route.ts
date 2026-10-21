import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID } from "@/services/seed";
import { generatePairingCodeForCollector } from "@/services/collector-assistant";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const { token, expiresAt } = await generatePairingCodeForCollector(userId);
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
