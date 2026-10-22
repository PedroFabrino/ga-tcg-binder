import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { getFeaturedSetsDashboardData } from "@/services/set-shortage";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId =
      req.nextUrl.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;
    const target =
      req.nextUrl.searchParams.get("target") ||
      req.nextUrl.searchParams.get("deckId") ||
      undefined;

    const data = await getFeaturedSetsDashboardData(userId, { target });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
