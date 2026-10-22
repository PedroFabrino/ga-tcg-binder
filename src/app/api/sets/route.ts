import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { calculateFeaturedSetSummaries } from "@/services/set-shortage";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId =
      req.nextUrl.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    const groups = await calculateFeaturedSetSummaries(userId);
    const hiddenCount = groups.filter((group) => group.isHidden).length;

    return NextResponse.json({ groups, hiddenCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}