import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { removeLinkedIdentity } from "@/services/collector-assistant";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const provider = params.provider;
    if (provider !== "discord" && provider !== "root") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const success = await removeLinkedIdentity(userId, provider);
    return NextResponse.json({ success });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
