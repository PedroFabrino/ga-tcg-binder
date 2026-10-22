import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { toggleUserSetHidden, SetGroupNotFoundError } from "@/services/set-shortage";
import { parseSetHideBody } from "@/lib/validation/sets-schemas";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const body = await req.json();
    const validation = parseSetHideBody(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const hiddenSetUuids = await toggleUserSetHidden(
      userId,
      validation.data.groupUuid,
      validation.data.isHidden,
    );

    return NextResponse.json({ success: true, hiddenSetUuids });
  } catch (error: unknown) {
    if (error instanceof SetGroupNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}